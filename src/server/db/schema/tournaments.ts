import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import {
  approvalMode,
  participantStatus,
  participantType,
  registrationStatus,
  tournamentFormat,
  tournamentStatus,
  tournamentVisibility,
} from "./enums";
import { media, teams } from "./people";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const tournaments = pgTable(
  "tournaments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    /** Frase corta para las tarjetas. */
    summary: text("summary"),
    description: text("description"),
    /** Reglamento en texto. La configuración estructurada está en `tournament_rules`. */
    rulesText: text("rules_text"),
    prizeDescription: text("prize_description"),
    bannerMediaId: uuid("banner_media_id").references(() => media.id, { onDelete: "set null" }),
    organizerId: text("organizer_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    format: tournamentFormat("format").notNull(),
    participantType: participantType("participant_type").notNull().default("team"),
    visibility: tournamentVisibility("visibility").notNull().default("public"),
    /**
     * Torneos privados: código que acompaña al enlace de invitación (`?codigo=`). Sin él, solo lo ven la
     * organización, los administradores y quienes ya participan.
     */
    accessCode: text("access_code"),
    status: tournamentStatus("status").notNull().default("draft"),
    /** Servidor de juego (EUW, EUNE…). Informativo. */
    region: text("region"),
    registrationOpensAt: timestamp("registration_opens_at", { withTimezone: true }).notNull(),
    registrationClosesAt: timestamp("registration_closes_at", { withTimezone: true }).notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    minParticipants: integer("min_participants").notNull(),
    maxParticipants: integer("max_participants").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    isDemo: boolean("is_demo").notNull().default(false),
    /** Control de concurrencia optimista: cada edición lo incrementa. */
    version: integer("version").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("tournaments_status_starts_idx").on(t.status, t.startsAt),
    index("tournaments_organizer_idx").on(t.organizerId),
    check("tournaments_participants_ck", sql`${t.minParticipants} >= 2 and ${t.maxParticipants} >= ${t.minParticipants} and ${t.maxParticipants} <= 256`),
    check("tournaments_dates_ck", sql`${t.registrationOpensAt} < ${t.registrationClosesAt} and ${t.registrationClosesAt} <= ${t.startsAt}`),
    check("tournaments_ends_ck", sql`${t.endsAt} is null or ${t.endsAt} >= ${t.startsAt}`),
  ],
);

/** Configuración estructurada de la competición (1:1 con `tournaments`). */
export const tournamentRules = pgTable(
  "tournament_rules",
  {
    tournamentId: uuid("tournament_id")
      .primaryKey()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    /** Titulares por equipo (5 en la Grieta del Invocador). */
    teamSize: integer("team_size").notNull().default(5),
    maxSubstitutes: integer("max_substitutes").notNull().default(2),
    /** Formato de serie general y de la final (o gran final). */
    bestOf: integer("best_of").notNull().default(1),
    bestOfFinal: integer("best_of_final").notNull().default(3),
    /** Liga: puntos por victoria, por derrota y por derrota por incomparecencia. */
    pointsWin: integer("points_win").notNull().default(3),
    pointsLoss: integer("points_loss").notNull().default(0),
    pointsForfeitLoss: integer("points_forfeit_loss").notNull().default(0),
    /** Liga: desempates en orden (ver `src/domain/competition/standings.ts`). */
    tiebreakers: text("tiebreakers")
      .array()
      .notNull()
      .default(sql`array['head_to_head','game_difference','games_won']::text[]`),
    /** Liga: 1 = solo ida, 2 = ida y vuelta. */
    leagueLegs: integer("league_legs").notNull().default(1),
    /** Doble eliminación: si gana la final quien viene del cuadro de perdedores, se juega otra serie. */
    grandFinalReset: boolean("grand_final_reset").notNull().default(true),
    approvalMode: approvalMode("approval_mode").notNull().default("manual"),
    waitlistEnabled: boolean("waitlist_enabled").notNull().default(true),
    /** Todos los jugadores inscritos deben tener un Riot ID en su perfil. */
    requireRiotId: boolean("require_riot_id").notNull().default(true),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("rules_team_size_ck", sql`${t.teamSize} between 1 and 5`),
    check("rules_subs_ck", sql`${t.maxSubstitutes} between 0 and 5`),
    check("rules_best_of_ck", sql`${t.bestOf} in (1, 3, 5, 7) and ${t.bestOfFinal} in (1, 3, 5, 7)`),
    check("rules_legs_ck", sql`${t.leagueLegs} in (1, 2)`),
    check("rules_points_ck", sql`${t.pointsWin} > ${t.pointsLoss} and ${t.pointsLoss} >= ${t.pointsForfeitLoss}`),
  ],
);

export const tournamentRegistrations = pgTable(
  "tournament_registrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    /** Inscripción por equipo… */
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "restrict" }),
    /** …o individual. Exactamente uno de los dos. */
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    submittedById: text("submitted_by_id").references(() => users.id, { onDelete: "set null" }),
    status: registrationStatus("status").notNull(),
    /** Momento del último cambio de estado: ordena la lista de espera. */
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true }).notNull().defaultNow(),
    note: text("note"),
    reviewedById: text("reviewed_by_id").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    decisionReason: text("decision_reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // Una inscripción por equipo (o jugador) y torneo: si se retira y vuelve, se reutiliza la fila.
    uniqueIndex("registrations_team_uq").on(t.tournamentId, t.teamId),
    uniqueIndex("registrations_user_uq").on(t.tournamentId, t.userId),
    index("registrations_tournament_status_idx").on(t.tournamentId, t.status),
    check("registrations_one_entrant_ck", sql`(${t.teamId} is null) <> (${t.userId} is null)`),
  ],
);

/**
 * Plantilla inscrita: qué jugadores juegan el torneo con cada inscripción. La unicidad
 * (torneo, jugador) impide que alguien juegue el mismo torneo con dos equipos.
 */
export const registrationMembers = pgTable(
  "tournament_registration_members",
  {
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => tournamentRegistrations.id, { onDelete: "cascade" }),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    isSubstitute: boolean("is_substitute").notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.registrationId, t.userId] }),
    uniqueIndex("registration_members_tournament_user_uq").on(t.tournamentId, t.userId),
  ],
);

/** Participante confirmado (inscripción aprobada). La semilla se asigna al generar el cuadro. */
export const tournamentParticipants = pgTable(
  "tournament_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    registrationId: uuid("registration_id")
      .notNull()
      .unique()
      .references(() => tournamentRegistrations.id, { onDelete: "restrict" }),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "restrict" }),
    userId: text("user_id").references(() => users.id, { onDelete: "restrict" }),
    seed: integer("seed"),
    status: participantStatus("status").notNull().default("active"),
    createdAt: createdAt(),
  },
  (t) => [
    index("participants_tournament_idx").on(t.tournamentId),
    index("participants_team_idx").on(t.teamId),
    index("participants_user_idx").on(t.userId),
    uniqueIndex("participants_seed_uq").on(t.tournamentId, t.seed).where(sql`${t.seed} is not null`),
    check("participants_one_entrant_ck", sql`(${t.teamId} is null) <> (${t.userId} is null)`),
  ],
);
