import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { canCreateTournament, canManageTournament } from "@/domain/permissions";
import { canTransition, scheduleProblems, tournamentPhase } from "@/domain/tournament/phase";
import { startBlockers } from "@/domain/tournament/registration";
import type { MessageKey } from "@/i18n";
import { randomSuffix, slugify } from "@/lib/slug";
import { audit } from "@/server/audit";
import type { CurrentUser } from "@/server/auth/session";
import { type DbOrTx, getDb, type Tx } from "@/server/db/client";
import {
  registrationMembers,
  teams,
  tournamentParticipants,
  tournamentRegistrations,
  tournamentRules,
  tournaments,
  tournamentStages,
} from "@/server/db/schema";
import { AppError, forbidden, notFound } from "@/server/errors";
import { enforceRateLimit } from "@/server/rate-limit";
import { generateStage } from "../competition/stage-store";
import { deleteMedia, storeImage } from "../media/service";
import { notify } from "../notifications/service";
import type { TournamentInput } from "./schemas";

type TournamentRow = typeof tournaments.$inferSelect;

export async function lockTournament(tx: Tx, tournamentId: string): Promise<TournamentRow> {
  const [row] = await tx.select().from(tournaments).where(eq(tournaments.id, tournamentId)).for("update");
  if (!row) throw notFound();
  return row;
}

async function getRules(tx: DbOrTx, tournamentId: string) {
  const [rules] = await tx.select().from(tournamentRules).where(eq(tournamentRules.tournamentId, tournamentId));
  if (!rules) throw notFound();
  return rules;
}

function tournamentValues(input: TournamentInput) {
  return {
    name: input.name,
    summary: input.summary,
    description: input.description,
    rulesText: input.rulesText,
    prizeDescription: input.prizeDescription,
    format: input.format,
    participantType: input.participantType,
    visibility: input.visibility,
    region: input.region,
    registrationOpensAt: input.registrationOpensAt,
    registrationClosesAt: input.registrationClosesAt,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    minParticipants: input.minParticipants,
    maxParticipants: input.maxParticipants,
  };
}

function rulesValues(input: TournamentInput) {
  return {
    // En un torneo individual la «plantilla» es el propio jugador.
    teamSize: input.participantType === "solo" ? 1 : input.teamSize,
    maxSubstitutes: input.participantType === "solo" ? 0 : input.maxSubstitutes,
    bestOf: input.bestOf,
    bestOfFinal: input.bestOfFinal,
    pointsWin: input.pointsWin,
    pointsLoss: input.pointsLoss,
    pointsForfeitLoss: input.pointsForfeitLoss,
    tiebreakers: input.tiebreakers,
    leagueLegs: input.leagueLegs,
    grandFinalReset: input.grandFinalReset,
    approvalMode: input.approvalMode,
    waitlistEnabled: input.waitlistEnabled,
    requireRiotId: input.requireRiotId,
  };
}

/** Código de acceso de un torneo privado: aleatorio, sin caracteres confusos. */
function newAccessCode(): string {
  return `${randomSuffix(5)}${randomSuffix(5)}`;
}

function accessCodeFor(visibility: "public" | "private", current: string | null): string | null {
  if (visibility === "public") return null;
  return current ?? newAccessCode();
}

async function uniqueTournamentSlug(tx: DbOrTx, name: string): Promise<string> {
  const base = slugify(name, 60);
  const [taken] = await tx.select({ id: tournaments.id }).from(tournaments).where(eq(tournaments.slug, base));
  return taken ? `${base}-${randomSuffix(4)}` : base;
}

/** Usuarios afectados por un torneo: plantillas inscritas (y, si se pide, las pendientes). */
export async function tournamentAudience(
  tx: DbOrTx,
  tournamentId: string,
  statuses: ("approved" | "pending" | "waitlisted")[] = ["approved"],
): Promise<string[]> {
  const rows = await tx
    .select({ userId: registrationMembers.userId, captainId: teams.captainId })
    .from(registrationMembers)
    .innerJoin(tournamentRegistrations, eq(tournamentRegistrations.id, registrationMembers.registrationId))
    .leftJoin(teams, eq(teams.id, tournamentRegistrations.teamId))
    .where(and(eq(registrationMembers.tournamentId, tournamentId), inArray(tournamentRegistrations.status, statuses)));
  return [...new Set(rows.flatMap((r) => [r.userId, ...(r.captainId ? [r.captainId] : [])]))];
}

async function countRegistrations(tx: DbOrTx, tournamentId: string, statuses?: string[]): Promise<number> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(tournamentRegistrations)
    .where(
      and(
        eq(tournamentRegistrations.tournamentId, tournamentId),
        statuses ? inArray(tournamentRegistrations.status, statuses as never[]) : undefined,
      ),
    );
  return row?.count ?? 0;
}

export async function createTournament(actor: CurrentUser, input: TournamentInput): Promise<{ id: string; slug: string }> {
  if (!canCreateTournament(actor)) throw forbidden();
  const db = await getDb();
  await enforceRateLimit(db, "createTournament", actor.id);
  return db.transaction(async (tx) => {
    const slug = await uniqueTournamentSlug(tx, input.name);
    const [row] = await tx
      .insert(tournaments)
      .values({
        ...tournamentValues(input),
        slug,
        organizerId: actor.id,
        status: "draft",
        accessCode: accessCodeFor(input.visibility, null),
      })
      .returning({ id: tournaments.id, slug: tournaments.slug });
    await tx.insert(tournamentRules).values({ tournamentId: row!.id, ...rulesValues(input) });
    await audit(tx, {
      actorId: actor.id,
      action: "tournament.create",
      entityType: "tournament",
      entityId: row!.id,
      tournamentId: row!.id,
      data: { after: { ...input } },
    });
    return row!;
  });
}

const LOCKED_TOURNAMENT_FIELDS = ["format", "participantType", "minParticipants", "maxParticipants"] as const;
const LOCKED_RULE_FIELDS = ["teamSize", "maxSubstitutes", "bestOf", "bestOfFinal", "leagueLegs", "grandFinalReset"] as const;

export async function updateTournament(
  actor: CurrentUser,
  tournamentId: string,
  expectedVersion: number,
  input: TournamentInput,
): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const current = await lockTournament(tx, tournamentId);
    if (!canManageTournament(actor, current)) throw forbidden();
    if (current.status === "completed" || current.status === "cancelled") {
      throw new AppError("invalid_state", "errors.tournamentNotEditable");
    }
    if (current.version !== expectedVersion) throw new AppError("conflict", "errors.concurrentChange");
    const rules = await getRules(tx, tournamentId);
    const nextValues = tournamentValues(input);
    const nextRules = rulesValues(input);

    if (current.status === "in_progress") {
      const changed =
        LOCKED_TOURNAMENT_FIELDS.some((f) => current[f] !== nextValues[f]) ||
        LOCKED_RULE_FIELDS.some((f) => rules[f] !== nextRules[f]);
      if (changed) throw new AppError("invalid_state", "errors.fieldLockedAfterStart");
    }
    if (current.participantType !== input.participantType && (await countRegistrations(tx, tournamentId)) > 0) {
      throw new AppError("invalid_state", "errors.participantTypeLocked");
    }
    const approved = await countRegistrations(tx, tournamentId, ["approved"]);
    if (input.maxParticipants < approved) {
      throw new AppError("invalid_state", "errors.maxBelowApproved", { count: approved }, { maxParticipants: "errors.maxBelowApproved" });
    }

    const updated = await tx
      .update(tournaments)
      .set({
        ...nextValues,
        accessCode: accessCodeFor(input.visibility, current.accessCode),
        version: sql`${tournaments.version} + 1`,
      })
      .where(and(eq(tournaments.id, tournamentId), eq(tournaments.version, expectedVersion)))
      .returning({ id: tournaments.id });
    if (updated.length === 0) throw new AppError("conflict", "errors.concurrentChange");
    await tx.update(tournamentRules).set(nextRules).where(eq(tournamentRules.tournamentId, tournamentId));

    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const [key, value] of Object.entries({ ...nextValues, ...nextRules })) {
      const source: Record<string, unknown> = key in nextValues ? current : rules;
      const previous = source[key];
      if (JSON.stringify(previous) !== JSON.stringify(value)) {
        before[key] = previous;
        after[key] = value;
      }
    }
    await audit(tx, {
      actorId: actor.id,
      action: "tournament.update",
      entityType: "tournament",
      entityId: tournamentId,
      tournamentId,
      data: { before, after },
    });
  });
}

export async function setTournamentBanner(actor: CurrentUser, tournamentId: string, file: File | null): Promise<void> {
  const db = await getDb();
  if (file) await enforceRateLimit(db, "upload", actor.id);
  await db.transaction(async (tx) => {
    const t = await lockTournament(tx, tournamentId);
    if (!canManageTournament(actor, t)) throw forbidden();
    const mediaId = file ? await storeImage(tx, file, { ownerId: actor.id, kind: "tournament_banner", isPublic: true }) : null;
    await tx.update(tournaments).set({ bannerMediaId: mediaId }).where(eq(tournaments.id, tournamentId));
    await deleteMedia(tx, t.bannerMediaId);
    await audit(tx, { actorId: actor.id, action: "tournament.banner", entityType: "tournament", entityId: tournamentId, tournamentId });
  });
}

export async function publishTournament(actor: CurrentUser, tournamentId: string): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const t = await lockTournament(tx, tournamentId);
    if (!canManageTournament(actor, t)) throw forbidden();
    if (!canTransition(t.status, "published")) throw new AppError("invalid_state", "errors.invalidTransition");
    if (scheduleProblems(t).length > 0) throw new AppError("validation", "errors.scheduleInvalid");
    await tx
      .update(tournaments)
      .set({ status: "published", publishedAt: new Date(), version: sql`${tournaments.version} + 1` })
      .where(eq(tournaments.id, tournamentId));
    await audit(tx, { actorId: actor.id, action: "tournament.publish", entityType: "tournament", entityId: tournamentId, tournamentId });
  });
}

/** Retirar la publicación: solo mientras nadie se haya inscrito. */
export async function revertToDraft(actor: CurrentUser, tournamentId: string): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const t = await lockTournament(tx, tournamentId);
    if (!canManageTournament(actor, t)) throw forbidden();
    if (t.status !== "published") throw new AppError("invalid_state", "errors.invalidTransition");
    if ((await countRegistrations(tx, tournamentId)) > 0) throw new AppError("invalid_state", "errors.registrationsExist");
    await tx
      .update(tournaments)
      .set({ status: "draft", publishedAt: null, version: sql`${tournaments.version} + 1` })
      .where(eq(tournaments.id, tournamentId));
    await audit(tx, { actorId: actor.id, action: "tournament.unpublish", entityType: "tournament", entityId: tournamentId, tournamentId });
  });
}

export async function closeRegistrations(actor: CurrentUser, tournamentId: string): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const t = await lockTournament(tx, tournamentId);
    if (!canManageTournament(actor, t)) throw forbidden();
    const now = new Date();
    if (tournamentPhase(t, now) !== "registration_open") throw new AppError("invalid_state", "errors.cannotCloseRegistrations");
    const closesAt = now < t.startsAt ? now : t.startsAt;
    await tx
      .update(tournaments)
      .set({ registrationClosesAt: closesAt, version: sql`${tournaments.version} + 1` })
      .where(eq(tournaments.id, tournamentId));
    await audit(tx, {
      actorId: actor.id,
      action: "tournament.registrations.close",
      entityType: "tournament",
      entityId: tournamentId,
      tournamentId,
      data: { before: t.registrationClosesAt, after: closesAt },
    });
  });
}

export async function cancelTournament(actor: CurrentUser, tournamentId: string, reason: string): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const t = await lockTournament(tx, tournamentId);
    if (!canManageTournament(actor, t)) throw forbidden();
    if (!canTransition(t.status, "cancelled")) throw new AppError("invalid_state", "errors.invalidTransition");
    await tx
      .update(tournaments)
      .set({ status: "cancelled", cancelledAt: new Date(), cancelReason: reason, version: sql`${tournaments.version} + 1` })
      .where(eq(tournaments.id, tournamentId));
    const audience = await tournamentAudience(tx, tournamentId, ["approved", "pending", "waitlisted"]);
    await notify(tx, audience, "tournamentCancelled", { tournament: t.name, reason }, `/torneos/${t.slug}`);
    await audit(tx, {
      actorId: actor.id,
      action: "tournament.cancel",
      entityType: "tournament",
      entityId: tournamentId,
      tournamentId,
      data: { reason, previousStatus: t.status },
    });
  });
}

/** Invalida el enlace de invitación de un torneo privado y genera otro. */
export async function regenerateAccessCode(actor: CurrentUser, tournamentId: string): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const t = await lockTournament(tx, tournamentId);
    if (!canManageTournament(actor, t)) throw forbidden();
    if (t.visibility !== "private") throw new AppError("invalid_state", "errors.invalidTransition");
    await tx.update(tournaments).set({ accessCode: newAccessCode() }).where(eq(tournaments.id, tournamentId));
    await audit(tx, { actorId: actor.id, action: "tournament.access_code", entityType: "tournament", entityId: tournamentId, tournamentId });
  });
}

/** Solo borradores sin inscripciones; cualquier otro torneo se cancela, no se borra. */
export async function deleteDraft(actor: CurrentUser, tournamentId: string): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const t = await lockTournament(tx, tournamentId);
    if (!canManageTournament(actor, t)) throw forbidden();
    if (t.status !== "draft") throw new AppError("invalid_state", "errors.invalidTransition");
    if ((await countRegistrations(tx, tournamentId)) > 0) throw new AppError("invalid_state", "errors.registrationsExist");
    // La entrada de auditoría va antes del borrado (después, su referencia al torneo pasa a `null`).
    await audit(tx, {
      actorId: actor.id,
      action: "tournament.delete",
      entityType: "tournament",
      entityId: tournamentId,
      tournamentId,
      data: { name: t.name, slug: t.slug },
    });
    await tx.delete(tournaments).where(eq(tournaments.id, tournamentId));
    await deleteMedia(tx, t.bannerMediaId);
  });
}

/** Ordena a los participantes antes de generar el cuadro (1 = mejor cabeza de serie). */
export async function setSeeds(
  actor: CurrentUser,
  tournamentId: string,
  seeds: { participantId: string; seed: number }[],
): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const t = await lockTournament(tx, tournamentId);
    if (!canManageTournament(actor, t)) throw forbidden();
    if (t.status !== "published") throw new AppError("invalid_state", "errors.alreadyGenerated");
    const participants = await tx
      .select({ id: tournamentParticipants.id })
      .from(tournamentParticipants)
      .where(eq(tournamentParticipants.tournamentId, tournamentId));
    const ids = new Set(participants.map((p) => p.id));
    const values = seeds.map((s) => s.seed);
    const valid =
      seeds.length === participants.length &&
      seeds.every((s) => ids.has(s.participantId)) &&
      new Set(values).size === values.length &&
      values.every((v) => v >= 1 && v <= participants.length);
    if (!valid) throw new AppError("validation", "errors.invalidSeeds", { count: participants.length });

    await tx.update(tournamentParticipants).set({ seed: null }).where(eq(tournamentParticipants.tournamentId, tournamentId));
    for (const s of seeds) {
      await tx.update(tournamentParticipants).set({ seed: s.seed }).where(eq(tournamentParticipants.id, s.participantId));
    }
    await audit(tx, { actorId: actor.id, action: "tournament.seeds", entityType: "tournament", entityId: tournamentId, tournamentId, data: { seeds } });
  });
}

/**
 * Genera el cuadro o el calendario e inicia la competición. Antes comprueba que las inscripciones están
 * cerradas y que el número de participantes aprobados está dentro de los límites del torneo.
 */
export async function startTournament(actor: CurrentUser, tournamentId: string): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const t = await lockTournament(tx, tournamentId);
    if (!canManageTournament(actor, t)) throw forbidden();
    const rules = await getRules(tx, tournamentId);

    const participants = await tx
      .select({ id: tournamentParticipants.id, seed: tournamentParticipants.seed })
      .from(tournamentParticipants)
      .where(and(eq(tournamentParticipants.tournamentId, tournamentId), eq(tournamentParticipants.status, "active")))
      .orderBy(sql`${tournamentParticipants.seed} asc nulls last`, asc(tournamentParticipants.createdAt));

    const blockers = startBlockers({
      phase: tournamentPhase(t, new Date()),
      approvedCount: participants.length,
      minParticipants: t.minParticipants,
      maxParticipants: t.maxParticipants,
    });
    if (blockers.length > 0) {
      throw new AppError("invalid_state", `startBlockers.${blockers[0]}` as MessageKey, {
        min: t.minParticipants,
        max: t.maxParticipants,
        count: participants.length,
      });
    }
    const [existing] = await tx
      .select({ id: tournamentStages.id })
      .from(tournamentStages)
      .where(eq(tournamentStages.tournamentId, tournamentId));
    if (existing) throw new AppError("invalid_state", "errors.alreadyGenerated");

    // Semillas definitivas: las fijadas por la organización y, detrás, el orden de aprobación.
    await tx.update(tournamentParticipants).set({ seed: null }).where(eq(tournamentParticipants.tournamentId, tournamentId));
    for (const [index, p] of participants.entries()) {
      await tx.update(tournamentParticipants).set({ seed: index + 1 }).where(eq(tournamentParticipants.id, p.id));
    }

    await generateStage(tx, {
      tournamentId,
      actorId: actor.id,
      participantIdsBySeed: participants.map((p) => p.id),
      config: {
        format: t.format,
        bestOf: rules.bestOf,
        bestOfFinal: rules.bestOfFinal,
        leagueLegs: rules.leagueLegs,
        grandFinalReset: rules.grandFinalReset,
      },
    });

    await tx
      .update(tournaments)
      .set({ status: "in_progress", startedAt: new Date(), version: sql`${tournaments.version} + 1` })
      .where(eq(tournaments.id, tournamentId));

    // Las solicitudes que quedaban pendientes o en espera se cierran y liberan a sus jugadores.
    const leftover = await tx
      .update(tournamentRegistrations)
      .set({
        status: "rejected",
        statusChangedAt: new Date(),
        decisionReason: "Las inscripciones se cerraron al empezar el torneo.",
        reviewedAt: new Date(),
      })
      .where(and(eq(tournamentRegistrations.tournamentId, tournamentId), inArray(tournamentRegistrations.status, ["pending", "waitlisted"])))
      .returning({ id: tournamentRegistrations.id });
    if (leftover.length > 0) {
      await tx.delete(registrationMembers).where(inArray(registrationMembers.registrationId, leftover.map((r) => r.id)));
    }

    const audience = await tournamentAudience(tx, tournamentId);
    await notify(tx, audience, "tournamentStarted", { tournament: t.name }, `/torneos/${t.slug}`);
    await audit(tx, {
      actorId: actor.id,
      action: "tournament.start",
      entityType: "tournament",
      entityId: tournamentId,
      tournamentId,
      data: { participants: participants.length, closedRegistrations: leftover.length },
    });
  });
}
