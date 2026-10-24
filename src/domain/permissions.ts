/**
 * Matriz de permisos, en funciones puras. El servidor obtiene los hechos (rol, si es capitán, si es el
 * organizador…) de la base de datos y pregunta aquí. Ocultar un botón en la interfaz es solo comodidad:
 * cada acción de servidor vuelve a llamar a estas funciones. La tabla completa está en docs/PERMISOS.md.
 *
 * Roles: visitante (sin sesión), usuario registrado, capitán de equipo (por equipo), organizador de
 * torneo (rol global que permite crear torneos; gestiona los suyos) y administrador (todo).
 */

export type GlobalRole = "user" | "organizer" | "admin";

export interface Actor {
  id: string;
  role: GlobalRole;
  suspended: boolean;
}

export const isAdmin = (actor: Actor | null): boolean => actor?.role === "admin" && !actor.suspended;

export function canCreateTournament(actor: Actor | null): boolean {
  return !!actor && !actor.suspended && (actor.role === "organizer" || actor.role === "admin");
}

/** Gestionar un torneo concreto: editarlo, publicarlo, revisar inscripciones, validar resultados… */
export function canManageTournament(actor: Actor | null, tournament: { organizerId: string }): boolean {
  if (!actor || actor.suspended) return false;
  return actor.role === "admin" || (actor.role !== "user" && tournament.organizerId === actor.id);
}

/**
 * Torneos privados: solo los ven la organización, los administradores, quienes participan y quien llega con
 * el código de acceso del enlace de invitación. Los borradores, solo quien los gestiona.
 */
export function canViewTournament(
  actor: Actor | null,
  tournament: { organizerId: string; visibility: "public" | "private"; status: string },
  access: { isParticipant: boolean; hasAccessCode: boolean },
): boolean {
  const manager = canManageTournament(actor, tournament);
  if (tournament.status === "draft") return manager;
  if (tournament.visibility === "public") return true;
  return manager || access.isParticipant || access.hasAccessCode;
}

export function canAccessAdminArea(actor: Actor | null): boolean {
  return canCreateTournament(actor);
}

export function canManagePlatform(actor: Actor | null): boolean {
  return isAdmin(actor);
}

/** Editar el equipo, invitar, expulsar, inscribirlo en torneos: su capitán (o un administrador). */
export function canManageTeam(actor: Actor | null, team: { captainId: string; status: string }): boolean {
  if (!actor || actor.suspended) return false;
  if (actor.role === "admin") return true;
  return team.status === "active" && team.captainId === actor.id;
}

export function canCreateTeam(actor: Actor | null): boolean {
  return !!actor && !actor.suspended;
}

/**
 * Comunicar un resultado o abrir una disputa: el capitán de uno de los dos equipos (o el propio jugador en
 * torneos individuales). Devuelve el bando que representa, o `null`.
 */
export function reportingSide(
  actor: Actor | null,
  sides: { a: { representativeIds: string[] } | null; b: { representativeIds: string[] } | null },
): "a" | "b" | null {
  if (!actor || actor.suspended) return null;
  if (sides.a?.representativeIds.includes(actor.id)) return "a";
  if (sides.b?.representativeIds.includes(actor.id)) return "b";
  return null;
}

/** Validar y corregir resultados, programar partidos y resolver disputas: quien gestiona el torneo. */
export const canValidateResults = canManageTournament;
export const canResolveDisputes = canManageTournament;
