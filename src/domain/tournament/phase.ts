/**
 * Fase visible de un torneo, derivada del estado guardado y de las fechas. No se guarda: así nunca queda
 * desfasada (por ejemplo, «inscripciones abiertas» cuando ya cerraron).
 */

export type TournamentStatus = "draft" | "published" | "in_progress" | "completed" | "cancelled";

export type TournamentPhase =
  | "draft"
  | "registration_upcoming"
  | "registration_open"
  | "registration_closed"
  | "in_progress"
  | "completed"
  | "cancelled";

/** Agrupación para el explorador y las tarjetas. */
export type TournamentCategory = "open" | "upcoming" | "live" | "finished" | "cancelled" | "draft";

export interface PhaseInput {
  status: TournamentStatus;
  registrationOpensAt: Date;
  registrationClosesAt: Date;
}

export function tournamentPhase(t: PhaseInput, now: Date): TournamentPhase {
  switch (t.status) {
    case "draft":
    case "in_progress":
    case "completed":
    case "cancelled":
      return t.status;
    case "published":
      if (now < t.registrationOpensAt) return "registration_upcoming";
      if (now < t.registrationClosesAt) return "registration_open";
      return "registration_closed";
  }
}

export function phaseCategory(phase: TournamentPhase): TournamentCategory {
  switch (phase) {
    case "registration_open":
      return "open";
    case "registration_upcoming":
    case "registration_closed":
      return "upcoming";
    case "in_progress":
      return "live";
    case "completed":
      return "finished";
    case "cancelled":
      return "cancelled";
    case "draft":
      return "draft";
  }
}

export interface ScheduleInput {
  registrationOpensAt: Date;
  registrationClosesAt: Date;
  startsAt: Date;
  endsAt: Date | null;
  minParticipants: number;
  maxParticipants: number;
}

export type ScheduleProblem =
  | "registration_order"
  | "start_before_close"
  | "end_before_start"
  | "participants_order"
  | "participants_range";

/** Coherencia de fechas y plazas (la base de datos repite estas reglas como restricciones). */
export function scheduleProblems(s: ScheduleInput): ScheduleProblem[] {
  const problems: ScheduleProblem[] = [];
  if (!(s.registrationOpensAt < s.registrationClosesAt)) problems.push("registration_order");
  if (s.startsAt < s.registrationClosesAt) problems.push("start_before_close");
  if (s.endsAt && s.endsAt < s.startsAt) problems.push("end_before_start");
  if (s.minParticipants > s.maxParticipants) problems.push("participants_order");
  if (s.minParticipants < 2 || s.maxParticipants > 256) problems.push("participants_range");
  return problems;
}

/** Transiciones de estado permitidas (las acciones de servidor comprueban esto antes de escribir). */
const TRANSITIONS: Record<TournamentStatus, TournamentStatus[]> = {
  draft: ["published"],
  published: ["in_progress", "cancelled", "draft"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function canTransition(from: TournamentStatus, to: TournamentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Campos que dejan de poder editarse cuando el cuadro ya existe. */
export const LOCKED_AFTER_START = [
  "format",
  "participantType",
  "minParticipants",
  "maxParticipants",
  "teamSize",
  "maxSubstitutes",
  "leagueLegs",
  "grandFinalReset",
  "bestOf",
  "bestOfFinal",
] as const;
