import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { championOf, planCorrection, recordResult } from "@/domain/competition/elimination";
import { checkSeriesScore, gamesMatchScore, winsNeeded } from "@/domain/competition/series";
import type { EngineMatch, Side } from "@/domain/competition/types";
import { canManageTournament, canResolveDisputes, canValidateResults, reportingSide } from "@/domain/permissions";
import { formatDateTime } from "@/lib/format";
import { audit } from "@/server/audit";
import type { CurrentUser } from "@/server/auth/session";
import { type DbOrTx, getDb, type Tx } from "@/server/db/client";
import {
  disputes,
  matches,
  matchGames,
  matchResults,
  profiles,
  registrationMembers,
  resultEvidence,
  teams,
  tournamentParticipants,
  tournamentRules,
  tournaments,
  tournamentStages,
} from "@/server/db/schema";
import { AppError, forbidden, isUniqueViolation, notFound } from "@/server/errors";
import { enforceRateLimit } from "@/server/rate-limit";
import { idleStatus, type LoadedStage, lockAndLoadStage, type MatchRow, persistEngineChanges } from "../competition/stage-store";
import { storeImage } from "../media/service";
import { notify } from "../notifications/service";
import { lockTournament } from "../tournaments/service";

type TournamentRow = typeof tournaments.$inferSelect;

export interface SideInfo {
  participantId: string;
  name: string;
  /** Quien puede comunicar resultados y abrir disputas: el capitán (o el jugador, si es individual). */
  representativeIds: string[];
  /** Plantilla inscrita y capitán: destinatarios de los avisos y posibles MVP. */
  memberIds: string[];
}

/** Datos de los dos bandos de un partido. */
export async function loadSides(
  db: DbOrTx,
  match: Pick<MatchRow, "participantAId" | "participantBId">,
): Promise<{ a: SideInfo | null; b: SideInfo | null }> {
  const load = async (participantId: string | null): Promise<SideInfo | null> => {
    if (!participantId) return null;
    const [p] = await db
      .select({
        registrationId: tournamentParticipants.registrationId,
        userId: tournamentParticipants.userId,
        teamName: teams.name,
        captainId: teams.captainId,
        playerName: profiles.displayName,
      })
      .from(tournamentParticipants)
      .leftJoin(teams, eq(teams.id, tournamentParticipants.teamId))
      .leftJoin(profiles, eq(profiles.userId, tournamentParticipants.userId))
      .where(eq(tournamentParticipants.id, participantId));
    if (!p) return null;
    const roster = await db
      .select({ userId: registrationMembers.userId })
      .from(registrationMembers)
      .where(eq(registrationMembers.registrationId, p.registrationId));
    const representative = p.captainId ?? p.userId!;
    return {
      participantId,
      name: p.teamName ?? p.playerName ?? "—",
      representativeIds: [representative],
      memberIds: [...new Set([representative, ...roster.map((r) => r.userId)])],
    };
  };
  const [a, b] = await Promise.all([load(match.participantAId), load(match.participantBId)]);
  return { a, b };
}

interface MatchContext {
  tournament: TournamentRow;
  rules: typeof tournamentRules.$inferSelect;
  loaded: LoadedStage;
  match: LoadedStage["rows"] extends Map<string, infer R> ? R : never;
  sides: { a: SideInfo | null; b: SideInfo | null };
}

/**
 * Bloquea, en este orden, el torneo y la fase del partido, y carga todo lo necesario. Todas las escrituras
 * sobre partidos siguen el mismo orden, así que nunca se bloquean entre sí.
 */
async function lockMatch(tx: Tx, matchId: string): Promise<MatchContext> {
  const [ref] = await tx
    .select({ tournamentId: matches.tournamentId, stageId: matches.stageId })
    .from(matches)
    .where(eq(matches.id, matchId));
  if (!ref) throw notFound();
  const tournament = await lockTournament(tx, ref.tournamentId);
  const loaded = await lockAndLoadStage(tx, ref.stageId);
  const match = loaded.rows.get(matchId)!;
  const [rules] = await tx.select().from(tournamentRules).where(eq(tournamentRules.tournamentId, ref.tournamentId));
  const sides = await loadSides(tx, match);
  return { tournament, rules: rules!, loaded, match, sides };
}

function sideNames(ctx: MatchContext) {
  return { a: ctx.sides.a?.name ?? "—", b: ctx.sides.b?.name ?? "—" };
}

function audienceOf(ctx: MatchContext): string[] {
  return [...(ctx.sides.a?.memberIds ?? []), ...(ctx.sides.b?.memberIds ?? [])];
}

const matchLink = (ctx: MatchContext) => `/torneos/${ctx.tournament.slug}/partidos/${ctx.match.id}`;

function assertVersion(match: MatchRow, expected: number): void {
  if (match.version !== expected) throw new AppError("conflict", "errors.concurrentChange");
}

function assertInProgress(t: TournamentRow): void {
  if (t.status !== "in_progress") throw new AppError("invalid_state", "errors.tournamentNotEditable");
}

const hasBoth = (m: MatchRow) => m.participantAId !== null && m.participantBId !== null;

export interface ScoreInput {
  scoreA: number;
  scoreB: number;
  isForfeit: boolean;
  /** Ganador de cada partida, en orden (opcional). */
  gameWinners: Side[] | null;
  mvpUserId: string | null;
}

/** Valida marcador, detalle de partidas y MVP contra las reglas del partido. Devuelve el bando ganador. */
function validateScore(ctx: MatchContext, input: ScoreInput): Side {
  const check = checkSeriesScore(ctx.match.bestOf, input.scoreA, input.scoreB);
  if (!check.ok) {
    throw new AppError("validation", "errors.invalidScore", { bestOf: ctx.match.bestOf, needed: winsNeeded(ctx.match.bestOf) });
  }
  if (input.gameWinners && input.gameWinners.length > 0 && !gamesMatchScore(ctx.match.bestOf, input.scoreA, input.scoreB, input.gameWinners)) {
    throw new AppError("validation", "errors.gameDetailsMismatch");
  }
  if (input.mvpUserId && !audienceOf(ctx).includes(input.mvpUserId)) {
    throw new AppError("validation", "errors.mvpNotInMatch");
  }
  return check.winner;
}

async function attachEvidence(
  tx: Tx,
  actor: CurrentUser,
  target: { resultId?: string; disputeId?: string; matchId: string },
  evidence: { files: File[]; url: string | null },
): Promise<void> {
  for (const file of evidence.files.slice(0, 4)) {
    const mediaId = await storeImage(tx, file, { ownerId: actor.id, kind: "evidence", isPublic: false });
    await tx.insert(resultEvidence).values({ ...target, mediaId, uploadedById: actor.id });
  }
  if (evidence.url) await tx.insert(resultEvidence).values({ ...target, url: evidence.url, uploadedById: actor.id });
}

// ---------------------------------------------------------------------------------------------------------
// Programación
// ---------------------------------------------------------------------------------------------------------

export async function scheduleMatch(
  actor: CurrentUser,
  input: { matchId: string; scheduledAt: Date | null; version: number },
): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const ctx = await lockMatch(tx, input.matchId);
    if (!canManageTournament(actor, ctx.tournament)) throw forbidden();
    assertInProgress(ctx.tournament);
    if (ctx.match.status === "confirmed" || ctx.match.status === "void") throw new AppError("invalid_state", "errors.matchNotPlayable");
    assertVersion(ctx.match, input.version);

    const busy = ["in_progress", "awaiting_validation", "disputed"].includes(ctx.match.status);
    await tx
      .update(matches)
      .set({
        scheduledAt: input.scheduledAt,
        status: busy ? ctx.match.status : idleStatus(hasBoth(ctx.match), input.scheduledAt),
        version: sql`${matches.version} + 1`,
      })
      .where(eq(matches.id, ctx.match.id));

    if (input.scheduledAt && hasBoth(ctx.match)) {
      const type = ctx.match.scheduledAt ? "matchRescheduled" : "matchScheduled";
      await notify(tx, audienceOf(ctx), type, { ...sideNames(ctx), date: formatDateTime(input.scheduledAt) }, matchLink(ctx));
    }
    await audit(tx, {
      actorId: actor.id,
      action: "match.schedule",
      entityType: "match",
      entityId: ctx.match.id,
      tournamentId: ctx.tournament.id,
      data: { before: ctx.match.scheduledAt, after: input.scheduledAt },
    });
  });
}

/** Marca el partido como «en juego» (informativo para el público). */
export async function markInProgress(actor: CurrentUser, input: { matchId: string; version: number }): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const ctx = await lockMatch(tx, input.matchId);
    if (!canManageTournament(actor, ctx.tournament)) throw forbidden();
    assertInProgress(ctx.tournament);
    if (!hasBoth(ctx.match) || !["pending", "scheduled"].includes(ctx.match.status)) {
      throw new AppError("invalid_state", "errors.matchNotPlayable");
    }
    assertVersion(ctx.match, input.version);
    await tx.update(matches).set({ status: "in_progress", version: sql`${matches.version} + 1` }).where(eq(matches.id, ctx.match.id));
    await audit(tx, { actorId: actor.id, action: "match.start", entityType: "match", entityId: ctx.match.id, tournamentId: ctx.tournament.id });
  });
}

// ---------------------------------------------------------------------------------------------------------
// Resultados comunicados por los capitanes
// ---------------------------------------------------------------------------------------------------------

const REPORTABLE: MatchRow["status"][] = ["pending", "scheduled", "in_progress", "awaiting_validation"];

export async function reportResult(
  actor: CurrentUser,
  input: ScoreInput & { matchId: string; notes: string | null; evidenceFiles: File[]; evidenceUrl: string | null },
): Promise<void> {
  const db = await getDb();
  await enforceRateLimit(db, "reportResult", actor.id);
  await db.transaction(async (tx) => {
    const ctx = await lockMatch(tx, input.matchId);
    const side = reportingSide(actor, ctx.sides);
    if (!side) throw new AppError("forbidden", "errors.notAParticipant");
    assertInProgress(ctx.tournament);
    if (ctx.match.status === "disputed") throw new AppError("invalid_state", "errors.matchLocked");
    if (!hasBoth(ctx.match) || !REPORTABLE.includes(ctx.match.status)) throw new AppError("invalid_state", "errors.matchNotPlayable");
    validateScore(ctx, input);

    const participantId = ctx.sides[side]!.participantId;
    // Si este bando ya había comunicado otro resultado, el nuevo lo sustituye (queda en el historial).
    await tx
      .update(matchResults)
      .set({ status: "superseded" })
      .where(
        and(
          eq(matchResults.matchId, ctx.match.id),
          eq(matchResults.reportingParticipantId, participantId),
          eq(matchResults.status, "pending"),
        ),
      );
    const [result] = await tx
      .insert(matchResults)
      .values({
        matchId: ctx.match.id,
        reportedById: actor.id,
        reportingParticipantId: participantId,
        scoreA: input.scoreA,
        scoreB: input.scoreB,
        isForfeit: input.isForfeit,
        gameWinners: input.gameWinners?.length ? input.gameWinners : null,
        mvpUserId: input.mvpUserId,
        notes: input.notes,
      })
      .returning({ id: matchResults.id });
    await attachEvidence(tx, actor, { resultId: result!.id, matchId: ctx.match.id }, { files: input.evidenceFiles, url: input.evidenceUrl });
    await tx
      .update(matches)
      .set({ status: "awaiting_validation", version: sql`${matches.version} + 1` })
      .where(eq(matches.id, ctx.match.id));

    const opponent = side === "a" ? ctx.sides.b : ctx.sides.a;
    await notify(
      tx,
      [ctx.tournament.organizerId, ...(opponent?.representativeIds ?? [])],
      "resultReported",
      { ...sideNames(ctx), scoreA: input.scoreA, scoreB: input.scoreB },
      matchLink(ctx),
    );
    await audit(tx, {
      actorId: actor.id,
      action: "match.result.report",
      entityType: "match_result",
      entityId: result!.id,
      tournamentId: ctx.tournament.id,
      data: { matchId: ctx.match.id, side, scoreA: input.scoreA, scoreB: input.scoreB, isForfeit: input.isForfeit },
    });
  });
}

/** El capitán rival da por bueno el resultado comunicado por el otro bando. */
export async function confirmOpponentReport(actor: CurrentUser, resultId: string): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [ref] = await tx.select({ matchId: matchResults.matchId }).from(matchResults).where(eq(matchResults.id, resultId));
    if (!ref) throw notFound();
    const ctx = await lockMatch(tx, ref.matchId);
    const [result] = await tx.select().from(matchResults).where(eq(matchResults.id, resultId)).for("update");
    const side = reportingSide(actor, ctx.sides);
    if (!side) throw new AppError("forbidden", "errors.notAParticipant");
    if (!result || result.status !== "pending") throw new AppError("invalid_state", "errors.noPendingResult");
    if (result.reportingParticipantId === ctx.sides[side]!.participantId) throw forbidden();
    await tx
      .update(matchResults)
      .set({ opponentConfirmedAt: new Date(), opponentConfirmedById: actor.id })
      .where(eq(matchResults.id, resultId));
    await audit(tx, {
      actorId: actor.id,
      action: "match.result.agree",
      entityType: "match_result",
      entityId: resultId,
      tournamentId: ctx.tournament.id,
    });
  });
}

// ---------------------------------------------------------------------------------------------------------
// Validación y corrección por la organización
// ---------------------------------------------------------------------------------------------------------

async function writeGames(tx: Tx, ctx: MatchContext, gameWinners: Side[] | null): Promise<void> {
  await tx.delete(matchGames).where(eq(matchGames.matchId, ctx.match.id));
  if (!gameWinners?.length) return;
  await tx.insert(matchGames).values(
    gameWinners.map((side, index) => ({
      matchId: ctx.match.id,
      gameNumber: index + 1,
      winnerId: side === "a" ? ctx.match.participantAId! : ctx.match.participantBId!,
    })),
  );
}

/** Cierra o reabre la competición según el estado del cuadro tras un cambio. */
async function syncCompletion(tx: Tx, ctx: MatchContext, engine: EngineMatch[]): Promise<boolean> {
  const finished =
    ctx.tournament.format === "league"
      ? engine.every((m) => m.status !== "open")
      : championOf(engine) !== null;
  const now = new Date();
  if (finished && ctx.tournament.status === "in_progress") {
    await tx.update(tournamentStages).set({ status: "completed" }).where(eq(tournamentStages.id, ctx.loaded.stage.id));
    await tx
      .update(tournaments)
      .set({ status: "completed", completedAt: now, version: sql`${tournaments.version} + 1` })
      .where(eq(tournaments.id, ctx.tournament.id));
  } else if (!finished && ctx.tournament.status === "completed") {
    // Una corrección (p. ej. de la gran final) ha reabierto un partido: la competición sigue.
    await tx.update(tournamentStages).set({ status: "in_progress" }).where(eq(tournamentStages.id, ctx.loaded.stage.id));
    await tx
      .update(tournaments)
      .set({ status: "in_progress", completedAt: null, version: sql`${tournaments.version} + 1` })
      .where(eq(tournaments.id, ctx.tournament.id));
  }
  return finished;
}

export async function validateResult(
  actor: CurrentUser,
  input: { matchId: string; version: number } & ({ resultId: string } | { manual: ScoreInput & { notes: string | null } }),
): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const ctx = await lockMatch(tx, input.matchId);
    if (!canValidateResults(actor, ctx.tournament)) throw forbidden();
    assertInProgress(ctx.tournament);
    if (ctx.match.status === "disputed") throw new AppError("invalid_state", "errors.matchLocked");
    if (!hasBoth(ctx.match) || ctx.match.status === "confirmed" || ctx.match.status === "void") {
      throw new AppError("invalid_state", "errors.matchNotPlayable");
    }
    assertVersion(ctx.match, input.version);

    let score: ScoreInput;
    let acceptedId: string;
    if ("resultId" in input) {
      const [result] = await tx.select().from(matchResults).where(eq(matchResults.id, input.resultId)).for("update");
      if (!result || result.matchId !== ctx.match.id || result.status !== "pending") {
        throw new AppError("invalid_state", "errors.noPendingResult");
      }
      score = {
        scoreA: result.scoreA,
        scoreB: result.scoreB,
        isForfeit: result.isForfeit,
        gameWinners: (result.gameWinners as Side[] | null) ?? null,
        mvpUserId: result.mvpUserId,
      };
      acceptedId = result.id;
    } else {
      score = input.manual;
      const [created] = await tx
        .insert(matchResults)
        .values({
          matchId: ctx.match.id,
          reportedById: actor.id,
          reportingParticipantId: null,
          scoreA: score.scoreA,
          scoreB: score.scoreB,
          isForfeit: score.isForfeit,
          gameWinners: score.gameWinners?.length ? score.gameWinners : null,
          mvpUserId: score.mvpUserId,
          notes: input.manual.notes,
          status: "pending",
        })
        .returning({ id: matchResults.id });
      acceptedId = created!.id;
    }
    const winner = validateScore(ctx, score);

    const change = recordResult(ctx.loaded.engine, ctx.match.id, winner);
    await persistEngineChanges(tx, ctx.loaded, change.matches, change.changedIds, ctx.match.id);
    const now = new Date();
    const updated = await tx
      .update(matches)
      .set({
        status: "confirmed",
        winnerId: winner === "a" ? ctx.match.participantAId : ctx.match.participantBId,
        scoreA: score.scoreA,
        scoreB: score.scoreB,
        isForfeit: score.isForfeit,
        mvpUserId: score.mvpUserId,
        confirmedAt: now,
        confirmedById: actor.id,
        version: sql`${matches.version} + 1`,
      })
      .where(and(eq(matches.id, ctx.match.id), eq(matches.version, input.version)))
      .returning({ id: matches.id });
    if (updated.length === 0) throw new AppError("conflict", "errors.concurrentChange");

    await tx
      .update(matchResults)
      .set({ status: "accepted", reviewedById: actor.id, reviewedAt: now })
      .where(eq(matchResults.id, acceptedId));
    await tx
      .update(matchResults)
      .set({ status: "superseded", reviewedById: actor.id, reviewedAt: now })
      .where(and(eq(matchResults.matchId, ctx.match.id), eq(matchResults.status, "pending")));
    await writeGames(tx, ctx, score.gameWinners);
    await syncCompletion(tx, ctx, change.matches);

    await notify(tx, audienceOf(ctx), "resultConfirmed", { ...sideNames(ctx), scoreA: score.scoreA, scoreB: score.scoreB }, matchLink(ctx));
    await audit(tx, {
      actorId: actor.id,
      action: "match.result.confirm",
      entityType: "match",
      entityId: ctx.match.id,
      tournamentId: ctx.tournament.id,
      data: { resultId: acceptedId, after: score, advanced: change.changedIds.filter((id) => id !== ctx.match.id) },
    });
  });
}

/**
 * Corrige un resultado ya confirmado. Solo la organización, con motivo, y solo si los partidos posteriores
 * afectados no se han jugado (ni tienen un resultado comunicado o una disputa abierta).
 */
export async function correctResult(
  actor: CurrentUser,
  input: ScoreInput & { matchId: string; version: number; reason: string },
): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const ctx = await lockMatch(tx, input.matchId);
    if (!canValidateResults(actor, ctx.tournament)) throw forbidden();
    if (ctx.tournament.status !== "in_progress" && ctx.tournament.status !== "completed") {
      throw new AppError("invalid_state", "errors.tournamentNotEditable");
    }
    if (ctx.match.status !== "confirmed" || ctx.match.isBye) throw new AppError("invalid_state", "errors.matchNotPlayable");
    if (!input.reason.trim()) throw new AppError("validation", "errors.correctionReasonRequired");
    assertVersion(ctx.match, input.version);
    const winner = validateScore(ctx, input);

    const pending = await tx
      .select({ matchId: matchResults.matchId })
      .from(matchResults)
      .innerJoin(matches, eq(matches.id, matchResults.matchId))
      .where(and(eq(matches.stageId, ctx.loaded.stage.id), eq(matchResults.status, "pending")));
    const locked = new Set(pending.map((p) => p.matchId));
    for (const row of ctx.loaded.rows.values()) {
      if (["in_progress", "awaiting_validation", "disputed"].includes(row.status)) locked.add(row.id);
    }
    const plan = planCorrection(ctx.loaded.engine, ctx.match.id, winner, (id) => locked.has(id));
    if (!plan.ok) throw new AppError("invalid_state", "errors.correctionBlocked");

    await persistEngineChanges(tx, ctx.loaded, plan.change.matches, plan.change.changedIds, ctx.match.id);
    const now = new Date();
    const updated = await tx
      .update(matches)
      .set({
        winnerId: winner === "a" ? ctx.match.participantAId : ctx.match.participantBId,
        scoreA: input.scoreA,
        scoreB: input.scoreB,
        isForfeit: input.isForfeit,
        mvpUserId: input.mvpUserId,
        confirmedAt: now,
        confirmedById: actor.id,
        version: sql`${matches.version} + 1`,
      })
      .where(and(eq(matches.id, ctx.match.id), eq(matches.version, input.version)))
      .returning({ id: matches.id });
    if (updated.length === 0) throw new AppError("conflict", "errors.concurrentChange");

    await tx
      .update(matchResults)
      .set({ status: "superseded" })
      .where(and(eq(matchResults.matchId, ctx.match.id), eq(matchResults.status, "accepted")));
    await tx.insert(matchResults).values({
      matchId: ctx.match.id,
      reportedById: actor.id,
      reportingParticipantId: null,
      scoreA: input.scoreA,
      scoreB: input.scoreB,
      isForfeit: input.isForfeit,
      gameWinners: input.gameWinners?.length ? input.gameWinners : null,
      mvpUserId: input.mvpUserId,
      notes: input.reason,
      status: "accepted",
      reviewedById: actor.id,
      reviewedAt: now,
    });
    await writeGames(tx, ctx, input.gameWinners);
    await syncCompletion(tx, ctx, plan.change.matches);

    await notify(
      tx,
      audienceOf(ctx),
      "resultCorrected",
      { ...sideNames(ctx), scoreA: input.scoreA, scoreB: input.scoreB, reason: input.reason },
      matchLink(ctx),
    );
    await audit(tx, {
      actorId: actor.id,
      action: "match.result.correct",
      entityType: "match",
      entityId: ctx.match.id,
      tournamentId: ctx.tournament.id,
      data: {
        reason: input.reason,
        before: { winnerId: ctx.match.winnerId, scoreA: ctx.match.scoreA, scoreB: ctx.match.scoreB, isForfeit: ctx.match.isForfeit },
        after: { winner, scoreA: input.scoreA, scoreB: input.scoreB, isForfeit: input.isForfeit },
        affected: plan.change.changedIds.filter((id) => id !== ctx.match.id),
      },
    });
  });
}

// ---------------------------------------------------------------------------------------------------------
// Disputas
// ---------------------------------------------------------------------------------------------------------

export async function openDispute(
  actor: CurrentUser,
  input: { matchId: string; reason: string; resultId: string | null; evidenceFiles: File[]; evidenceUrl: string | null },
): Promise<void> {
  const db = await getDb();
  await enforceRateLimit(db, "openDispute", actor.id);
  await db.transaction(async (tx) => {
    const ctx = await lockMatch(tx, input.matchId);
    const side = reportingSide(actor, ctx.sides);
    if (!side) throw new AppError("forbidden", "errors.notAParticipant");
    assertInProgress(ctx.tournament);
    if (ctx.match.status === "disputed") throw new AppError("conflict", "errors.disputeAlreadyOpen");
    if (!hasBoth(ctx.match) || !REPORTABLE.includes(ctx.match.status)) throw new AppError("invalid_state", "errors.matchNotPlayable");
    if (input.resultId) {
      const [result] = await tx.select({ matchId: matchResults.matchId }).from(matchResults).where(eq(matchResults.id, input.resultId));
      if (!result || result.matchId !== ctx.match.id) throw notFound();
    }

    const [dispute] = await tx
      .insert(disputes)
      .values({
        matchId: ctx.match.id,
        tournamentId: ctx.tournament.id,
        openedById: actor.id,
        participantId: ctx.sides[side]!.participantId,
        resultId: input.resultId,
        reason: input.reason,
      })
      .returning({ id: disputes.id })
      .catch((error) => {
        if (isUniqueViolation(error)) throw new AppError("conflict", "errors.disputeAlreadyOpen");
        throw error;
      });
    await attachEvidence(tx, actor, { disputeId: dispute!.id, matchId: ctx.match.id }, { files: input.evidenceFiles, url: input.evidenceUrl });
    await tx.update(matches).set({ status: "disputed", version: sql`${matches.version} + 1` }).where(eq(matches.id, ctx.match.id));

    const opponent = side === "a" ? ctx.sides.b : ctx.sides.a;
    await notify(
      tx,
      [ctx.tournament.organizerId, ...(opponent?.representativeIds ?? [])],
      "disputeOpened",
      { ...sideNames(ctx), reason: input.reason },
      matchLink(ctx),
    );
    await audit(tx, {
      actorId: actor.id,
      action: "dispute.open",
      entityType: "dispute",
      entityId: dispute!.id,
      tournamentId: ctx.tournament.id,
      data: { matchId: ctx.match.id, side, reason: input.reason },
    });
  });
}

export async function resolveDispute(
  actor: CurrentUser,
  input: { disputeId: string; outcome: "resolved" | "rejected"; resolution: string },
): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [ref] = await tx.select({ matchId: disputes.matchId }).from(disputes).where(eq(disputes.id, input.disputeId));
    if (!ref) throw notFound();
    const ctx = await lockMatch(tx, ref.matchId);
    if (!canResolveDisputes(actor, ctx.tournament)) throw forbidden();
    const [dispute] = await tx.select().from(disputes).where(eq(disputes.id, input.disputeId)).for("update");
    if (!dispute || dispute.status !== "open") throw new AppError("invalid_state", "errors.disputeNotOpen");

    const now = new Date();
    await tx
      .update(disputes)
      .set({ status: input.outcome, resolution: input.resolution, resolvedById: actor.id, resolvedAt: now })
      .where(eq(disputes.id, dispute.id));

    const pendingResults = await tx
      .select({ id: matchResults.id })
      .from(matchResults)
      .where(and(eq(matchResults.matchId, ctx.match.id), eq(matchResults.status, "pending")));
    if (ctx.match.status === "disputed") {
      await tx
        .update(matches)
        .set({
          status: pendingResults.length > 0 ? "awaiting_validation" : idleStatus(hasBoth(ctx.match), ctx.match.scheduledAt),
          version: sql`${matches.version} + 1`,
        })
        .where(eq(matches.id, ctx.match.id));
    }
    await notify(tx, audienceOf(ctx), "disputeResolved", { ...sideNames(ctx), resolution: input.resolution }, matchLink(ctx));
    await audit(tx, {
      actorId: actor.id,
      action: `dispute.${input.outcome}`,
      entityType: "dispute",
      entityId: dispute.id,
      tournamentId: ctx.tournament.id,
      data: { resolution: input.resolution },
    });
  });
}

/** Programa a la vez todos los partidos sin resultado de una jornada o ronda. */
export async function scheduleRound(actor: CurrentUser, input: { roundId: string; scheduledAt: Date }): Promise<number> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const roundMatches = await tx
      .select({ id: matches.id, version: matches.version, status: matches.status })
      .from(matches)
      .where(eq(matches.roundId, input.roundId));
    if (roundMatches.length === 0) throw notFound();
    const ctx = await lockMatch(tx, roundMatches[0]!.id);
    if (!canManageTournament(actor, ctx.tournament)) throw forbidden();
    assertInProgress(ctx.tournament);
    const open = roundMatches.filter((m) => !["confirmed", "void"].includes(m.status)).map((m) => m.id);
    if (open.length === 0) return 0;
    for (const id of open) {
      const row = ctx.loaded.rows.get(id)!;
      const busy = ["in_progress", "awaiting_validation", "disputed"].includes(row.status);
      await tx
        .update(matches)
        .set({
          scheduledAt: input.scheduledAt,
          status: busy ? row.status : idleStatus(hasBoth(row), input.scheduledAt),
          version: sql`${matches.version} + 1`,
        })
        .where(eq(matches.id, id));
      if (hasBoth(row)) {
        const sides = await loadSides(tx, row);
        await notify(
          tx,
          [...(sides.a?.memberIds ?? []), ...(sides.b?.memberIds ?? [])],
          row.scheduledAt ? "matchRescheduled" : "matchScheduled",
          { a: sides.a?.name ?? "—", b: sides.b?.name ?? "—", date: formatDateTime(input.scheduledAt) },
          `/torneos/${ctx.tournament.slug}/partidos/${id}`,
        );
      }
    }
    await audit(tx, {
      actorId: actor.id,
      action: "round.schedule",
      entityType: "stage",
      entityId: input.roundId,
      tournamentId: ctx.tournament.id,
      data: { scheduledAt: input.scheduledAt, matches: open.length },
    });
    return open.length;
  });
}
