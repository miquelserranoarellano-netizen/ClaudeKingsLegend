import type { TournamentPhase } from "./phase";

/**
 * Reglas de inscripción, sin acceso a datos: el servidor reúne los hechos y estas funciones deciden.
 * Cada motivo de rechazo tiene un código; el texto para el usuario está en el diccionario de idioma.
 */

export type RegistrationBlocker =
  | "registration_not_open"
  | "already_registered"
  | "not_captain"
  | "team_inactive"
  | "roster_too_small"
  | "roster_too_large"
  | "not_team_member"
  | "player_already_registered"
  | "missing_riot_id"
  | "account_suspended"
  | "tournament_full";

export interface TeamRegistrationFacts {
  phase: TournamentPhase;
  /** Lo pide la organización (puede inscribir fuera de plazo mientras no haya empezado). */
  byOrganizer: boolean;
  alreadyRegistered: boolean;
  actorIsCaptain: boolean;
  teamActive: boolean;
  teamSize: number;
  maxSubstitutes: number;
  requireRiotId: boolean;
  /** Jugadores elegidos para la plantilla: exactamente `teamSize` titulares y hasta `maxSubstitutes` suplentes. */
  roster: {
    userId: string;
    isSubstitute: boolean;
    isTeamMember: boolean;
    hasRiotId: boolean;
    suspended: boolean;
    /** Ya está en otra inscripción activa de este torneo. */
    registeredElsewhere: boolean;
  }[];
}

export function teamRegistrationBlockers(f: TeamRegistrationFacts): RegistrationBlocker[] {
  const blockers = new Set<RegistrationBlocker>();
  const windowOk = f.phase === "registration_open" || (f.byOrganizer && f.phase === "registration_closed");
  if (!windowOk) blockers.add("registration_not_open");
  if (f.alreadyRegistered) blockers.add("already_registered");
  if (!f.actorIsCaptain && !f.byOrganizer) blockers.add("not_captain");
  if (!f.teamActive) blockers.add("team_inactive");

  // Un jugador repetido en la lista cuenta una sola vez (como titular si alguna vez lo es).
  const byUser = new Map<string, boolean>();
  for (const p of f.roster) byUser.set(p.userId, (byUser.get(p.userId) ?? true) && p.isSubstitute);
  const starters = [...byUser.values()].filter((sub) => !sub).length;
  const substitutes = byUser.size - starters;
  if (starters < f.teamSize) blockers.add("roster_too_small");
  if (starters > f.teamSize || substitutes > f.maxSubstitutes) blockers.add("roster_too_large");
  for (const player of f.roster) {
    if (!player.isTeamMember) blockers.add("not_team_member");
    if (player.registeredElsewhere) blockers.add("player_already_registered");
    if (f.requireRiotId && !player.hasRiotId) blockers.add("missing_riot_id");
    if (player.suspended) blockers.add("account_suspended");
  }
  return [...blockers];
}

export interface SoloRegistrationFacts {
  phase: TournamentPhase;
  byOrganizer: boolean;
  alreadyRegistered: boolean;
  requireRiotId: boolean;
  hasRiotId: boolean;
  suspended: boolean;
}

export function soloRegistrationBlockers(f: SoloRegistrationFacts): RegistrationBlocker[] {
  const blockers: RegistrationBlocker[] = [];
  const windowOk = f.phase === "registration_open" || (f.byOrganizer && f.phase === "registration_closed");
  if (!windowOk) blockers.push("registration_not_open");
  if (f.alreadyRegistered) blockers.push("already_registered");
  if (f.requireRiotId && !f.hasRiotId) blockers.push("missing_riot_id");
  if (f.suspended) blockers.push("account_suspended");
  return blockers;
}

export type InitialRegistrationStatus = "approved" | "pending" | "waitlisted";

/**
 * Estado con el que entra una inscripción válida:
 * - Aprobación automática: aprobada si quedan plazas.
 * - Aprobación manual: pendiente de revisión si quedan plazas.
 * - Sin plazas: a la lista de espera si está activada; si no, se rechaza (`tournament_full`).
 */
export function initialRegistrationStatus(input: {
  approvalMode: "manual" | "automatic";
  approvedCount: number;
  maxParticipants: number;
  waitlistEnabled: boolean;
}): InitialRegistrationStatus | "tournament_full" {
  const hasRoom = input.approvedCount < input.maxParticipants;
  if (hasRoom) return input.approvalMode === "automatic" ? "approved" : "pending";
  return input.waitlistEnabled ? "waitlisted" : "tournament_full";
}

/** Retirarse solo es posible antes de que empiece la competición. */
export function canWithdraw(phase: TournamentPhase): boolean {
  return phase === "registration_upcoming" || phase === "registration_open" || phase === "registration_closed";
}

export type StartBlocker = "not_published" | "registration_still_open" | "too_few_participants" | "too_many_participants";

/** Condiciones para generar el cuadro e iniciar la competición. */
export function startBlockers(input: {
  phase: TournamentPhase;
  approvedCount: number;
  minParticipants: number;
  maxParticipants: number;
}): StartBlocker[] {
  const blockers: StartBlocker[] = [];
  if (input.phase === "registration_open" || input.phase === "registration_upcoming") {
    blockers.push("registration_still_open");
  } else if (input.phase !== "registration_closed") {
    blockers.push("not_published");
  }
  if (input.approvedCount < input.minParticipants) blockers.push("too_few_participants");
  if (input.approvedCount > input.maxParticipants) blockers.push("too_many_participants");
  return blockers;
}
