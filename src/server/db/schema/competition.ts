import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import {
  bracketKind,
  disputeStatus,
  matchSide,
  matchStatus,
  resultStatus,
  stageStatus,
  tournamentFormat,
} from "./enums";
import { media } from "./people";
import { tournamentParticipants, tournaments } from "./tournaments";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/**
 * Fase de la competición. Casi todos los torneos tienen una sola fase (su formato); el sistema suizo
 * encadena dos: la fase suiza (1) y la eliminatoria con los clasificados (2).
 */
export const tournamentStages = pgTable(
  "tournament_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    format: tournamentFormat("format").notNull(),
    status: stageStatus("status").notNull().default("in_progress"),
    generatedById: text("generated_by_id").references(() => users.id, { onDelete: "set null" }),
    /** Se incrementa con cada cambio en el cuadro: serializa las escrituras concurrentes. */
    version: integer("version").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("stages_tournament_number_uq").on(t.tournamentId, t.number)],
).enableRLS();

/** Ronda de un cuadro o jornada de una liga. El nombre visible se calcula, no se guarda. */
export const tournamentRounds = pgTable(
  "tournament_rounds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stageId: uuid("stage_id")
      .notNull()
      .references(() => tournamentStages.id, { onDelete: "cascade" }),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    bracket: bracketKind("bracket").notNull(),
    number: integer("number").notNull(),
    bestOf: integer("best_of").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("rounds_stage_bracket_number_uq").on(t.stageId, t.bracket, t.number),
    index("rounds_tournament_idx").on(t.tournamentId),
    check("rounds_best_of_ck", sql`${t.bestOf} in (1, 2, 3, 5, 7)`),
  ],
).enableRLS();

export const matches = pgTable(
  "matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    stageId: uuid("stage_id")
      .notNull()
      .references(() => tournamentStages.id, { onDelete: "cascade" }),
    roundId: uuid("round_id")
      .notNull()
      .references(() => tournamentRounds.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    participantAId: uuid("participant_a_id").references(() => tournamentParticipants.id, {
      onDelete: "restrict",
    }),
    participantBId: uuid("participant_b_id").references(() => tournamentParticipants.id, {
      onDelete: "restrict",
    }),
    /** El hueco no se llenará nunca (BYE). */
    slotADead: boolean("slot_a_dead").notNull().default(false),
    slotBDead: boolean("slot_b_dead").notNull().default(false),
    status: matchStatus("status").notNull().default("pending"),
    bestOf: integer("best_of").notNull(),
    winnerId: uuid("winner_id").references(() => tournamentParticipants.id, { onDelete: "restrict" }),
    scoreA: integer("score_a"),
    scoreB: integer("score_b"),
    isBye: boolean("is_bye").notNull().default(false),
    isForfeit: boolean("is_forfeit").notNull().default(false),
    mvpUserId: text("mvp_user_id").references(() => users.id, { onDelete: "set null" }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    /** Adónde va el ganador / el perdedor (doble eliminación). */
    nextMatchId: uuid("next_match_id").references((): AnyPgColumn => matches.id, { onDelete: "set null" }),
    nextSlot: matchSide("next_slot"),
    loserNextMatchId: uuid("loser_next_match_id").references((): AnyPgColumn => matches.id, {
      onDelete: "set null",
    }),
    loserNextSlot: matchSide("loser_next_slot"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    confirmedById: text("confirmed_by_id").references(() => users.id, { onDelete: "set null" }),
    /** Control de concurrencia optimista para la edición de un partido concreto. */
    version: integer("version").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("matches_round_position_uq").on(t.roundId, t.position),
    index("matches_tournament_status_idx").on(t.tournamentId, t.status),
    index("matches_participant_a_idx").on(t.participantAId),
    index("matches_participant_b_idx").on(t.participantBId),
    index("matches_scheduled_idx").on(t.scheduledAt),
    // Cargar una fase completa y seguir los enlaces del cuadro (y al borrarlo, comprobar quién apunta a quién).
    index("matches_stage_idx").on(t.stageId),
    index("matches_next_idx").on(t.nextMatchId).where(sql`${t.nextMatchId} is not null`),
    index("matches_loser_next_idx").on(t.loserNextMatchId).where(sql`${t.loserNextMatchId} is not null`),
    check("matches_best_of_ck", sql`${t.bestOf} in (1, 2, 3, 5, 7)`),
    check(
      "matches_winner_ck",
      sql`${t.winnerId} is null or ${t.winnerId} = ${t.participantAId} or ${t.winnerId} = ${t.participantBId}`,
    ),
    check("matches_distinct_ck", sql`${t.participantAId} is null or ${t.participantAId} <> ${t.participantBId}`),
  ],
).enableRLS();

/** Partidas individuales dentro de una serie (opcional: solo si se comunica el detalle). */
export const matchGames = pgTable(
  "match_games",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    gameNumber: integer("game_number").notNull(),
    winnerId: uuid("winner_id")
      .notNull()
      .references(() => tournamentParticipants.id, { onDelete: "restrict" }),
    durationSeconds: integer("duration_seconds"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("match_games_number_uq").on(t.matchId, t.gameNumber),
    check("match_games_duration_ck", sql`${t.durationSeconds} is null or ${t.durationSeconds} between 60 and 10800`),
  ],
).enableRLS();

/**
 * Resultado comunicado por un capitán (o introducido por la organización). Nunca se borra: si se
 * sustituye, queda como `superseded`, y así se conserva quién dijo qué y cuándo.
 */
export const matchResults = pgTable(
  "match_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    reportedById: text("reported_by_id").references(() => users.id, { onDelete: "set null" }),
    /** Bando que lo comunica. `null` si lo introduce la organización. */
    reportingParticipantId: uuid("reporting_participant_id").references(() => tournamentParticipants.id, {
      onDelete: "restrict",
    }),
    scoreA: integer("score_a").notNull(),
    scoreB: integer("score_b").notNull(),
    isForfeit: boolean("is_forfeit").notNull().default(false),
    /** Ganador de cada partida, en orden ("a" / "b"), si se comunica. */
    gameWinners: text("game_winners").array(),
    mvpUserId: text("mvp_user_id").references(() => users.id, { onDelete: "set null" }),
    notes: text("notes"),
    status: resultStatus("status").notNull().default("pending"),
    /** El capitán rival está de acuerdo con este resultado. */
    opponentConfirmedAt: timestamp("opponent_confirmed_at", { withTimezone: true }),
    opponentConfirmedById: text("opponent_confirmed_by_id").references(() => users.id, { onDelete: "set null" }),
    reviewedById: text("reviewed_by_id").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("match_results_match_idx").on(t.matchId, t.status),
    uniqueIndex("match_results_pending_uq")
      .on(t.matchId, t.reportingParticipantId)
      .where(sql`${t.status} = 'pending'`),
  ],
).enableRLS();

export const resultEvidence = pgTable(
  "result_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resultId: uuid("result_id").references(() => matchResults.id, { onDelete: "cascade" }),
    disputeId: uuid("dispute_id").references((): AnyPgColumn => disputes.id, { onDelete: "cascade" }),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id").references(() => media.id, { onDelete: "cascade" }),
    /** Enlace externo (por ejemplo, a un vídeo). Solo https. */
    url: text("url"),
    description: text("description"),
    uploadedById: text("uploaded_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("result_evidence_match_idx").on(t.matchId),
    // `/media/[id]` busca la evidencia por su imagen para decidir quién puede verla.
    index("result_evidence_media_idx").on(t.mediaId).where(sql`${t.mediaId} is not null`),
    index("result_evidence_result_idx").on(t.resultId).where(sql`${t.resultId} is not null`),
    index("result_evidence_dispute_idx").on(t.disputeId).where(sql`${t.disputeId} is not null`),
    check("result_evidence_source_ck", sql`${t.mediaId} is not null or ${t.url} is not null`),
    check("result_evidence_owner_ck", sql`${t.resultId} is not null or ${t.disputeId} is not null`),
  ],
).enableRLS();

export const disputes = pgTable(
  "disputes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    openedById: text("opened_by_id").references(() => users.id, { onDelete: "set null" }),
    participantId: uuid("participant_id").references(() => tournamentParticipants.id, { onDelete: "restrict" }),
    /** Resultado al que se refiere la disputa, si lo hay. */
    resultId: uuid("result_id").references(() => matchResults.id, { onDelete: "set null" }),
    reason: text("reason").notNull(),
    status: disputeStatus("status").notNull().default("open"),
    resolution: text("resolution"),
    resolvedById: text("resolved_by_id").references(() => users.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // Una sola disputa abierta por partido.
    uniqueIndex("disputes_open_uq").on(t.matchId).where(sql`${t.status} = 'open'`),
    index("disputes_tournament_status_idx").on(t.tournamentId, t.status),
    // Historial de disputas de un partido (abiertas y cerradas) en su página.
    index("disputes_match_idx").on(t.matchId),
  ],
).enableRLS();
