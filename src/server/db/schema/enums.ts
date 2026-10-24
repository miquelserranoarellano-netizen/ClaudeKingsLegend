import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Estados y categorías como tipos enumerados de Postgres: la base de datos rechaza cualquier valor que no
 * esté aquí, y TypeScript conoce la lista exacta. Añadir un valor exige una migración (es intencionado).
 */

/** Rol global en la plataforma. «Capitán» no es un rol global: se deriva de `teams.captain_id`. */
export const userRole = pgEnum("user_role", ["user", "organizer", "admin"]);

/** Posiciones de League of Legends. */
export const lolPosition = pgEnum("lol_position", ["top", "jungle", "mid", "bottom", "support", "fill"]);

export const mediaKind = pgEnum("media_kind", ["avatar", "team_logo", "tournament_banner", "evidence"]);

export const teamStatus = pgEnum("team_status", ["active", "disbanded"]);

export const invitationStatus = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "declined",
  "cancelled",
  "expired",
]);

export const tournamentFormat = pgEnum("tournament_format", [
  "single_elimination",
  "double_elimination",
  "league",
]);

export const participantType = pgEnum("participant_type", ["team", "solo"]);

export const tournamentVisibility = pgEnum("tournament_visibility", ["public", "private"]);

/**
 * Estado guardado del torneo. La fase que ve el público (inscripción próxima, abierta, cerrada…) se
 * deriva de este estado y de las fechas en `src/domain/tournament/phase.ts`.
 */
export const tournamentStatus = pgEnum("tournament_status", [
  "draft",
  "published",
  "in_progress",
  "completed",
  "cancelled",
]);

export const approvalMode = pgEnum("approval_mode", ["manual", "automatic"]);

export const registrationStatus = pgEnum("registration_status", [
  "pending",
  "approved",
  "rejected",
  "waitlisted",
  "withdrawn",
]);

export const participantStatus = pgEnum("participant_status", ["active", "disqualified"]);

export const stageStatus = pgEnum("stage_status", ["in_progress", "completed"]);

export const bracketKind = pgEnum("bracket_kind", ["winners", "losers", "grand_final", "league"]);

export const matchSide = pgEnum("match_side", ["a", "b"]);

/**
 * Estado de un enfrentamiento:
 * - `pending`: pendiente (faltan rivales o fecha).
 * - `scheduled`: programado (rivales y fecha conocidos).
 * - `in_progress`: en juego.
 * - `awaiting_validation`: hay un resultado comunicado que espera la validación de la organización.
 * - `disputed`: hay una disputa abierta (incidencia).
 * - `confirmed`: resultado confirmado (o ganado por BYE).
 * - `void`: no se disputará (dos BYE, o reinicio de la gran final no necesario).
 */
export const matchStatus = pgEnum("match_status", [
  "pending",
  "scheduled",
  "in_progress",
  "awaiting_validation",
  "disputed",
  "confirmed",
  "void",
]);

export const resultStatus = pgEnum("result_status", ["pending", "accepted", "rejected", "superseded"]);

export const disputeStatus = pgEnum("dispute_status", ["open", "resolved", "rejected"]);

export const announcementStatus = pgEnum("announcement_status", ["draft", "published"]);
