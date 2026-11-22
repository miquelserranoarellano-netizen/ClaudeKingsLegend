import "server-only";
import { randomUUID } from "node:crypto";
import { asc, eq, sql } from "drizzle-orm";
import { generateDoubleElimination, generateSingleElimination } from "@/domain/competition/elimination";
import { generateRoundRobin } from "@/domain/competition/round-robin";
import { planSwissRound, type SwissGame, type SwissRoundPlan, swissQualifiers, swissRecords, WORLDS_SWISS } from "@/domain/competition/swiss";
import type { BracketKind, EngineMatch } from "@/domain/competition/types";
import type { Tx } from "@/server/db/client";
import { matches, tournamentRounds, tournamentStages } from "@/server/db/schema";

/**
 * Puente entre el motor puro (`src/domain/competition`) y la base de datos: genera y guarda una fase,
 * carga el cuadro como `EngineMatch[]` y escribe solo los partidos que el motor ha cambiado.
 */

export type MatchRow = typeof matches.$inferSelect;
export type MatchStatus = MatchRow["status"];

/** Estados «en curso» que el motor no conoce y que se respetan al recalcular un partido abierto. */
const BUSY_STATUSES: MatchStatus[] = ["in_progress", "awaiting_validation", "disputed"];

/** Estado de un partido sin resultado según lo que se sabe de él. */
export function idleStatus(hasBothParticipants: boolean, scheduledAt: Date | null): MatchStatus {
  return hasBothParticipants && scheduledAt ? "scheduled" : "pending";
}

export interface StageConfig {
  format: "single_elimination" | "double_elimination" | "league" | "swiss";
  bestOf: number;
  bestOfFinal: number;
  leagueLegs: number;
  grandFinalReset: boolean;
  /** Suizo: series de los partidos decisivos y de la eliminatoria final. */
  swissDeciderBestOf: number;
  playoffBestOf: number;
  /** Liga: la primera jornada se programa en esta fecha y cada una de las siguientes, una semana después. */
  startsAt: Date;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Genera la primera fase (rondas y partidos) y la guarda. Devuelve el id de la fase. */
export async function generateStage(
  tx: Tx,
  input: { tournamentId: string; actorId: string; config: StageConfig; participantIdsBySeed: string[] },
): Promise<string> {
  const { tournamentId, config } = input;
  if (config.format === "single_elimination" || config.format === "double_elimination") {
    return insertEliminationStage(tx, {
      tournamentId,
      actorId: input.actorId,
      number: 1,
      format: config.format,
      participantIdsBySeed: input.participantIdsBySeed,
      bestOf: config.bestOf,
      bestOfFinal: config.bestOfFinal,
      grandFinalReset: config.grandFinalReset,
    });
  }

  const [stage] = await tx
    .insert(tournamentStages)
    .values({ tournamentId, number: 1, format: config.format, status: "in_progress", generatedById: input.actorId })
    .returning({ id: tournamentStages.id });
  const stageId = stage!.id;

  if (config.format === "swiss") {
    const plan = planSwissRound(input.participantIdsBySeed, [], WORLDS_SWISS);
    await insertSwissRound(tx, { tournamentId, stageId, plan: plan!, bestOf: config.bestOf, deciderBestOf: config.swissDeciderBestOf });
    return stageId;
  }

  // Liga: una jornada por semana (la organización puede moverlas después, partido a partido o por jornadas).
  const rounds = generateRoundRobin(input.participantIdsBySeed, config.leagueLegs === 2 ? 2 : 1);
  for (const round of rounds) {
    const [row] = await tx
      .insert(tournamentRounds)
      .values({ stageId, tournamentId, bracket: "league", number: round.number, bestOf: config.bestOf })
      .returning({ id: tournamentRounds.id });
    if (round.pairings.length === 0) continue;
    const scheduledAt = new Date(config.startsAt.getTime() + (round.number - 1) * WEEK_MS);
    await tx.insert(matches).values(
      round.pairings.map((pairing, position) => ({
        tournamentId,
        stageId,
        roundId: row!.id,
        position,
        participantAId: pairing.a,
        participantBId: pairing.b,
        bestOf: config.bestOf,
        scheduledAt,
        status: idleStatus(true, scheduledAt),
      })),
    );
  }
  return stageId;
}

/** Guarda un cuadro de eliminación (simple o doble) como fase `number` del torneo. */
export async function insertEliminationStage(
  tx: Tx,
  input: {
    tournamentId: string;
    actorId: string;
    number: number;
    format: "single_elimination" | "double_elimination";
    participantIdsBySeed: string[];
    bestOf: number;
    bestOfFinal: number;
    grandFinalReset: boolean;
  },
): Promise<string> {
  const { tournamentId } = input;
  const [stage] = await tx
    .insert(tournamentStages)
    .values({ tournamentId, number: input.number, format: input.format, status: "in_progress", generatedById: input.actorId })
    .returning({ id: tournamentStages.id });
  const stageId = stage!.id;

  const engine =
    input.format === "single_elimination"
      ? generateSingleElimination(input.participantIdsBySeed, randomUUID)
      : generateDoubleElimination(input.participantIdsBySeed, randomUUID, { grandFinalReset: input.grandFinalReset });

  const lastWinnersRound = Math.max(...engine.filter((m) => m.bracket === "winners").map((m) => m.round));
  const isFinalRound = (bracket: BracketKind, round: number) =>
    bracket === "grand_final" || (input.format === "single_elimination" && bracket === "winners" && round === lastWinnersRound);

  const roundKeys = [...new Set(engine.map((m) => `${m.bracket}:${m.round}`))];
  const roundIds = new Map<string, { id: string; bestOf: number }>();
  for (const key of roundKeys) {
    const [bracket, round] = key.split(":") as [BracketKind, string];
    const bestOf = isFinalRound(bracket, Number(round)) ? input.bestOfFinal : input.bestOf;
    const [row] = await tx
      .insert(tournamentRounds)
      .values({ stageId, tournamentId, bracket, number: Number(round), bestOf })
      .returning({ id: tournamentRounds.id });
    roundIds.set(key, { id: row!.id, bestOf });
  }

  const now = new Date();
  // Una sola sentencia: las referencias entre partidos (siguiente partido) se comprueban al final de ella.
  await tx.insert(matches).values(
    engine.map((m) => {
      const round = roundIds.get(`${m.bracket}:${m.round}`)!;
      return {
        id: m.id,
        tournamentId,
        stageId,
        roundId: round.id,
        position: m.position,
        participantAId: m.a,
        participantBId: m.b,
        slotADead: m.aDead,
        slotBDead: m.bDead,
        status: (m.status === "done" ? "confirmed" : m.status === "void" ? "void" : "pending") as MatchStatus,
        winnerId: m.winner ? m[m.winner] : null,
        isBye: m.isBye,
        bestOf: round.bestOf,
        nextMatchId: m.next?.matchId ?? null,
        nextSlot: m.next?.slot ?? null,
        loserNextMatchId: m.loserNext?.matchId ?? null,
        loserNextSlot: m.loserNext?.slot ?? null,
        confirmedAt: m.status === "done" ? now : null,
      };
    }),
  );
  return stageId;
}

/** Guarda una ronda suiza: los cruces (BO3 si son decisivos) y, si lo hay, el BYE ya ganado. */
async function insertSwissRound(
  tx: Tx,
  input: { tournamentId: string; stageId: string; plan: SwissRoundPlan; bestOf: number; deciderBestOf: number },
): Promise<void> {
  const { tournamentId, stageId, plan } = input;
  const [round] = await tx
    .insert(tournamentRounds)
    .values({ stageId, tournamentId, bracket: "swiss", number: plan.round, bestOf: input.bestOf })
    .returning({ id: tournamentRounds.id });
  const rows: (typeof matches.$inferInsert)[] = plan.pairings.map((pairing, position) => ({
    tournamentId,
    stageId,
    roundId: round!.id,
    position,
    participantAId: pairing.a,
    participantBId: pairing.b,
    bestOf: pairing.decider ? input.deciderBestOf : input.bestOf,
    status: "pending" as const,
  }));
  if (plan.bye) {
    rows.push({
      tournamentId,
      stageId,
      roundId: round!.id,
      position: plan.pairings.length,
      participantAId: plan.bye,
      participantBId: null,
      slotBDead: true,
      isBye: true,
      winnerId: plan.bye,
      bestOf: input.bestOf,
      status: "confirmed",
      confirmedAt: new Date(),
    });
  }
  if (rows.length > 0) await tx.insert(matches).values(rows);
}

/** Partidos de la fase suiza como los ve el motor. */
export function swissGames(engine: EngineMatch[]): SwissGame[] {
  return engine
    .filter((m) => m.bracket === "swiss" && m.a !== null)
    .map((m) => ({
      round: m.round,
      a: m.a!,
      b: m.isBye ? null : m.b,
      winner: m.status === "done" ? m.winner : null,
    }));
}

/**
 * Tras confirmar un resultado del suizo: si la ronda ha terminado, empareja la siguiente; si ya no queda
 * nadie en juego, cierra el suizo y genera la eliminatoria con los clasificados (fase 2), sembrados por
 * su balance (los 3-0 primero).
 */
export async function advanceSwiss(
  tx: Tx,
  input: { tournamentId: string; actorId: string; stageId: string; engine: EngineMatch[]; participantIdsBySeed: string[]; config: StageConfig },
): Promise<"waiting" | "next_round" | "playoffs"> {
  const games = swissGames(input.engine);
  if (games.some((g) => g.b !== null && g.winner === null)) return "waiting";
  const plan = planSwissRound(input.participantIdsBySeed, games, WORLDS_SWISS);
  if (plan) {
    await insertSwissRound(tx, { tournamentId: input.tournamentId, stageId: input.stageId, plan, bestOf: input.config.bestOf, deciderBestOf: input.config.swissDeciderBestOf });
    return "next_round";
  }
  const qualifiers = swissQualifiers(swissRecords(input.participantIdsBySeed, games, WORLDS_SWISS));
  if (qualifiers.length < 2) throw new Error("El suizo ha terminado con menos de dos clasificados.");
  await tx.update(tournamentStages).set({ status: "completed" }).where(eq(tournamentStages.id, input.stageId));
  await insertEliminationStage(tx, {
    tournamentId: input.tournamentId,
    actorId: input.actorId,
    number: 2,
    format: "single_elimination",
    participantIdsBySeed: qualifiers,
    bestOf: input.config.playoffBestOf,
    bestOfFinal: input.config.bestOfFinal,
    grandFinalReset: false,
  });
  return "playoffs";
}

export interface LoadedStage {
  stage: typeof tournamentStages.$inferSelect;
  rows: Map<string, MatchRow & { bracket: BracketKind; roundNumber: number }>;
  engine: EngineMatch[];
}

/**
 * Bloquea la fase (`for update`) y carga su cuadro. Todas las escrituras sobre un cuadro pasan por aquí,
 * así que dos validaciones simultáneas del mismo torneo se ejecutan una detrás de otra.
 */
export async function lockAndLoadStage(tx: Tx, stageId: string): Promise<LoadedStage> {
  const [stage] = await tx.select().from(tournamentStages).where(eq(tournamentStages.id, stageId)).for("update");
  if (!stage) throw new Error(`Fase inexistente: ${stageId}`);
  const list = await tx
    .select({ match: matches, bracket: tournamentRounds.bracket, roundNumber: tournamentRounds.number })
    .from(matches)
    .innerJoin(tournamentRounds, eq(tournamentRounds.id, matches.roundId))
    .where(eq(matches.stageId, stageId))
    .orderBy(asc(tournamentRounds.number), asc(matches.position));

  const rows = new Map(list.map(({ match, bracket, roundNumber }) => [match.id, { ...match, bracket, roundNumber }]));
  const engine: EngineMatch[] = list.map(({ match: r, bracket, roundNumber }) => ({
    id: r.id,
    bracket,
    round: roundNumber,
    position: r.position,
    a: r.participantAId,
    b: r.participantBId,
    aDead: r.slotADead,
    bDead: r.slotBDead,
    status: r.status === "confirmed" ? "done" : r.status === "void" ? "void" : "open",
    winner: r.winnerId ? (r.winnerId === r.participantAId ? "a" : "b") : null,
    isBye: r.isBye,
    next: r.nextMatchId ? { matchId: r.nextMatchId, slot: r.nextSlot! } : null,
    loserNext: r.loserNextMatchId ? { matchId: r.loserNextMatchId, slot: r.loserNextSlot! } : null,
  }));
  return { stage, rows, engine };
}

/**
 * Escribe en la base de datos los partidos que el motor ha cambiado (salvo `skipId`, que el llamante
 * actualiza con sus propios datos: marcador, MVP…). Incrementa la versión de cada uno y de la fase.
 */
export async function persistEngineChanges(
  tx: Tx,
  loaded: LoadedStage,
  after: EngineMatch[],
  changedIds: string[],
  skipId?: string,
): Promise<void> {
  const byId = new Map(after.map((m) => [m.id, m]));
  const now = new Date();
  for (const id of changedIds) {
    if (id === skipId) continue;
    const m = byId.get(id)!;
    const row = loaded.rows.get(id)!;
    const hasBoth = m.a !== null && m.b !== null;
    let status: MatchStatus;
    if (m.status === "void") status = "void";
    else if (m.status === "done") status = "confirmed";
    else if (hasBoth && BUSY_STATUSES.includes(row.status)) status = row.status;
    else status = idleStatus(hasBoth, row.scheduledAt);

    const played = m.status === "done" && !m.isBye;
    await tx
      .update(matches)
      .set({
        participantAId: m.a,
        participantBId: m.b,
        slotADead: m.aDead,
        slotBDead: m.bDead,
        isBye: m.isBye,
        status,
        winnerId: m.winner ? m[m.winner] : null,
        // Un partido que vuelve a estar abierto (p. ej. el reinicio de la gran final) no conserva marcador.
        scoreA: played ? row.scoreA : null,
        scoreB: played ? row.scoreB : null,
        confirmedAt: m.status === "done" ? (row.confirmedAt ?? now) : null,
        version: sql`${matches.version} + 1`,
      })
      .where(eq(matches.id, id));
  }
  await tx
    .update(tournamentStages)
    .set({ version: sql`${tournamentStages.version} + 1` })
    .where(eq(tournamentStages.id, loaded.stage.id));
}
