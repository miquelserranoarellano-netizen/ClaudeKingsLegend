import "server-only";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { profiles, registrationMembers, teams, tournamentRegistrations, tournaments } from "@/server/db/schema";

/** Inscripciones en las que participa el usuario (como jugador de la plantilla, capitán o en solitario). */
export async function myRegistrations(userId: string) {
  const db = await getDb();
  return db
    .select({
      id: tournamentRegistrations.id,
      status: tournamentRegistrations.status,
      decisionReason: tournamentRegistrations.decisionReason,
      createdAt: tournamentRegistrations.createdAt,
      tournamentName: tournaments.name,
      tournamentSlug: tournaments.slug,
      tournamentStatus: tournaments.status,
      registrationOpensAt: tournaments.registrationOpensAt,
      registrationClosesAt: tournaments.registrationClosesAt,
      startsAt: tournaments.startsAt,
      format: tournaments.format,
      teamName: teams.name,
      teamSlug: teams.slug,
      captainId: teams.captainId,
      soloUserId: tournamentRegistrations.userId,
    })
    .from(tournamentRegistrations)
    .innerJoin(tournaments, eq(tournaments.id, tournamentRegistrations.tournamentId))
    .leftJoin(teams, eq(teams.id, tournamentRegistrations.teamId))
    .where(
      or(
        eq(tournamentRegistrations.userId, userId),
        eq(teams.captainId, userId),
        sql`exists (select 1 from ${registrationMembers} rm where rm.registration_id = ${tournamentRegistrations.id} and rm.user_id = ${userId})`,
      ),
    )
    .orderBy(desc(tournaments.startsAt));
}

export interface RegistrationView {
  id: string;
  status: (typeof tournamentRegistrations.$inferSelect)["status"];
  createdAt: Date;
  statusChangedAt: Date;
  note: string | null;
  decisionReason: string | null;
  entrantName: string;
  entrantHref: string | null;
  teamTag: string | null;
  teamLogo: string | null;
  roster: { userId: string; displayName: string; handle: string; riotId: string | null; isSubstitute: boolean }[];
}

/** Inscripciones de un torneo con su plantilla (para la organización y la vista de participantes). */
export async function tournamentRegistrationList(
  tournamentId: string,
  statuses?: (typeof tournamentRegistrations.$inferSelect)["status"][],
): Promise<RegistrationView[]> {
  const db = await getDb();
  const regs = await db
    .select({
      reg: tournamentRegistrations,
      teamName: teams.name,
      teamSlug: teams.slug,
      teamTag: teams.tag,
      teamLogo: teams.logoMediaId,
      playerName: profiles.displayName,
      playerHandle: profiles.handle,
    })
    .from(tournamentRegistrations)
    .leftJoin(teams, eq(teams.id, tournamentRegistrations.teamId))
    .leftJoin(profiles, eq(profiles.userId, tournamentRegistrations.userId))
    .where(and(eq(tournamentRegistrations.tournamentId, tournamentId), statuses ? inArray(tournamentRegistrations.status, statuses) : undefined))
    .orderBy(asc(tournamentRegistrations.statusChangedAt));
  if (regs.length === 0) return [];
  const members = await db
    .select({
      registrationId: registrationMembers.registrationId,
      userId: registrationMembers.userId,
      isSubstitute: registrationMembers.isSubstitute,
      displayName: profiles.displayName,
      handle: profiles.handle,
      riotGameName: profiles.riotGameName,
      riotTagLine: profiles.riotTagLine,
    })
    .from(registrationMembers)
    .innerJoin(profiles, eq(profiles.userId, registrationMembers.userId))
    .where(inArray(registrationMembers.registrationId, regs.map((r) => r.reg.id)))
    .orderBy(asc(registrationMembers.isSubstitute), asc(profiles.displayName));
  return regs.map(({ reg, ...r }) => ({
    id: reg.id,
    status: reg.status,
    createdAt: reg.createdAt,
    statusChangedAt: reg.statusChangedAt,
    note: reg.note,
    decisionReason: reg.decisionReason,
    entrantName: r.teamName ?? r.playerName ?? "—",
    entrantHref: r.teamSlug ? `/equipos/${r.teamSlug}` : r.playerHandle ? `/jugadores/${r.playerHandle}` : null,
    teamTag: r.teamTag,
    teamLogo: r.teamLogo,
    roster: members
      .filter((m) => m.registrationId === reg.id)
      .map((m) => ({
        userId: m.userId,
        displayName: m.displayName,
        handle: m.handle,
        riotId: m.riotGameName ? `${m.riotGameName}#${m.riotTagLine}` : null,
        isSubstitute: m.isSubstitute,
      })),
  }));
}

/** Inscripción activa del usuario (o de un equipo que capitanea) en un torneo concreto. */
export async function viewerRegistration(tournamentId: string, userId: string) {
  const db = await getDb();
  const [row] = await db
    .select({
      id: tournamentRegistrations.id,
      status: tournamentRegistrations.status,
      teamName: teams.name,
      teamId: teams.id,
      captainId: teams.captainId,
      userId: tournamentRegistrations.userId,
      decisionReason: tournamentRegistrations.decisionReason,
    })
    .from(tournamentRegistrations)
    .leftJoin(teams, eq(teams.id, tournamentRegistrations.teamId))
    .where(
      and(
        eq(tournamentRegistrations.tournamentId, tournamentId),
        inArray(tournamentRegistrations.status, ["pending", "approved", "waitlisted", "rejected"]),
        or(
          eq(tournamentRegistrations.userId, userId),
          eq(teams.captainId, userId),
          sql`exists (select 1 from ${registrationMembers} rm where rm.registration_id = ${tournamentRegistrations.id} and rm.user_id = ${userId})`,
        ),
      ),
    )
    .orderBy(desc(tournamentRegistrations.statusChangedAt))
    .limit(1);
  return row ?? null;
}
