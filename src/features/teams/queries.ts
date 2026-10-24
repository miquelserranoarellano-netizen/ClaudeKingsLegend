import "server-only";
import { and, asc, desc, eq, gt, ilike, inArray, or, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import {
  profiles,
  teamInvitations,
  teamMembers,
  teams,
  tournamentParticipants,
  tournamentRegistrations,
  tournaments,
  users,
} from "@/server/db/schema";
import { getChampion } from "../tournaments/queries";

export type TeamRow = typeof teams.$inferSelect;

export interface TeamMemberView {
  userId: string;
  handle: string;
  displayName: string;
  avatarMediaId: string | null;
  riotId: string | null;
  position: string | null;
  mainPosition: string | null;
  isPublic: boolean;
  joinedAt: Date;
  isCaptain: boolean;
}

export async function getTeamMembers(teamId: string, captainId: string): Promise<TeamMemberView[]> {
  const db = await getDb();
  const rows = await db
    .select({
      userId: teamMembers.userId,
      handle: profiles.handle,
      displayName: profiles.displayName,
      avatarMediaId: profiles.avatarMediaId,
      riotGameName: profiles.riotGameName,
      riotTagLine: profiles.riotTagLine,
      position: teamMembers.position,
      mainPosition: profiles.mainPosition,
      isPublic: profiles.isPublic,
      joinedAt: teamMembers.joinedAt,
    })
    .from(teamMembers)
    .innerJoin(profiles, eq(profiles.userId, teamMembers.userId))
    .where(eq(teamMembers.teamId, teamId))
    .orderBy(asc(teamMembers.joinedAt));
  return rows
    .map((r) => ({
      userId: r.userId,
      handle: r.handle,
      displayName: r.displayName,
      avatarMediaId: r.avatarMediaId,
      riotId: r.riotGameName ? `${r.riotGameName}#${r.riotTagLine}` : null,
      position: r.position,
      mainPosition: r.mainPosition,
      isPublic: r.isPublic,
      joinedAt: r.joinedAt,
      isCaptain: r.userId === captainId,
    }))
    .sort((a, b) => Number(b.isCaptain) - Number(a.isCaptain));
}

export interface TeamHistoryItem {
  tournamentId: string;
  name: string;
  slug: string;
  status: (typeof tournaments.$inferSelect)["status"];
  format: (typeof tournaments.$inferSelect)["format"];
  startsAt: Date;
  wins: number;
  losses: number;
  isChampion: boolean;
}

/** Historial competitivo del equipo: torneos públicos en los que participó y su balance. */
export async function teamHistory(teamId: string): Promise<TeamHistoryItem[]> {
  const db = await getDb();
  const rows = await db
    .select({
      participantId: tournamentParticipants.id,
      tournamentId: tournaments.id,
      name: tournaments.name,
      slug: tournaments.slug,
      status: tournaments.status,
      format: tournaments.format,
      startsAt: tournaments.startsAt,
      wins: sql<number>`(select count(*)::int from matches m where m.status = 'confirmed' and not m.is_bye and m.winner_id = ${tournamentParticipants.id})`,
      played: sql<number>`(select count(*)::int from matches m where m.status = 'confirmed' and not m.is_bye and (m.participant_a_id = ${tournamentParticipants.id} or m.participant_b_id = ${tournamentParticipants.id}))`,
    })
    .from(tournamentParticipants)
    .innerJoin(tournaments, eq(tournaments.id, tournamentParticipants.tournamentId))
    .where(and(eq(tournamentParticipants.teamId, teamId), eq(tournaments.visibility, "public")))
    .orderBy(desc(tournaments.startsAt));
  const out: TeamHistoryItem[] = [];
  for (const r of rows) {
    const champion = r.status === "completed" ? await getChampion({ id: r.tournamentId, format: r.format, status: r.status }) : null;
    out.push({ ...r, losses: r.played - r.wins, isChampion: champion?.id === r.participantId });
  }
  return out;
}

export async function getTeamBySlug(slug: string) {
  const db = await getDb();
  const [team] = await db
    .select({ team: teams, captainName: profiles.displayName, captainHandle: profiles.handle })
    .from(teams)
    .innerJoin(profiles, eq(profiles.userId, teams.captainId))
    .where(eq(teams.slug, slug));
  return team ?? null;
}

export async function getTeamById(teamId: string) {
  const db = await getDb();
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
  return team ?? null;
}

export async function listTeams(filters: { q?: string; page?: number }) {
  const db = await getDb();
  const pageSize = 24;
  const page = Math.max(1, filters.page ?? 1);
  const q = filters.q?.replace(/[%_\\]/g, "\\$&");
  const where = and(eq(teams.status, "active"), q ? or(ilike(teams.name, `%${q}%`), ilike(teams.tag, `%${q}%`)) : undefined);
  const [rows, [count]] = await Promise.all([
    db
      .select({
        id: teams.id,
        name: teams.name,
        tag: teams.tag,
        slug: teams.slug,
        logoMediaId: teams.logoMediaId,
        description: teams.description,
        isDemo: teams.isDemo,
        members: sql<number>`(select count(*)::int from ${teamMembers} tm where tm.team_id = ${teams.id})`,
      })
      .from(teams)
      .where(where)
      .orderBy(asc(teams.name))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(teams).where(where),
  ]);
  const total = count?.total ?? 0;
  return { items: rows, page, pageCount: Math.max(1, Math.ceil(total / pageSize)), total };
}

/** Equipos del usuario (activos), con su número de miembros y si es el capitán. */
export async function myTeams(userId: string) {
  const db = await getDb();
  return db
    .select({
      id: teams.id,
      name: teams.name,
      tag: teams.tag,
      slug: teams.slug,
      logoMediaId: teams.logoMediaId,
      captainId: teams.captainId,
      members: sql<number>`(select count(*)::int from ${teamMembers} tm where tm.team_id = ${teams.id})`,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(and(eq(teamMembers.userId, userId), eq(teams.status, "active")))
    .orderBy(asc(teams.name));
}

/** Invitaciones pendientes y vigentes que ha recibido el usuario. */
export async function myInvitations(userId: string) {
  const db = await getDb();
  return db
    .select({
      id: teamInvitations.id,
      message: teamInvitations.message,
      createdAt: teamInvitations.createdAt,
      expiresAt: teamInvitations.expiresAt,
      teamName: teams.name,
      teamTag: teams.tag,
      teamSlug: teams.slug,
      teamLogo: teams.logoMediaId,
      inviterName: profiles.displayName,
    })
    .from(teamInvitations)
    .innerJoin(teams, eq(teams.id, teamInvitations.teamId))
    .leftJoin(profiles, eq(profiles.userId, teamInvitations.invitedById))
    .where(
      and(
        eq(teamInvitations.inviteeId, userId),
        eq(teamInvitations.status, "pending"),
        gt(teamInvitations.expiresAt, new Date()),
        eq(teams.status, "active"),
      ),
    )
    .orderBy(desc(teamInvitations.createdAt));
}

/** Invitaciones enviadas por un equipo (pendientes). */
export async function teamPendingInvitations(teamId: string) {
  const db = await getDb();
  return db
    .select({
      id: teamInvitations.id,
      createdAt: teamInvitations.createdAt,
      expiresAt: teamInvitations.expiresAt,
      inviteeName: profiles.displayName,
      inviteeHandle: profiles.handle,
    })
    .from(teamInvitations)
    .innerJoin(profiles, eq(profiles.userId, teamInvitations.inviteeId))
    .where(and(eq(teamInvitations.teamId, teamId), eq(teamInvitations.status, "pending"), gt(teamInvitations.expiresAt, new Date())))
    .orderBy(desc(teamInvitations.createdAt));
}

/** Inscripciones del equipo (para su página de gestión). */
export async function teamRegistrations(teamId: string) {
  const db = await getDb();
  return db
    .select({
      id: tournamentRegistrations.id,
      status: tournamentRegistrations.status,
      createdAt: tournamentRegistrations.createdAt,
      tournamentName: tournaments.name,
      tournamentSlug: tournaments.slug,
      tournamentStatus: tournaments.status,
      startsAt: tournaments.startsAt,
    })
    .from(tournamentRegistrations)
    .innerJoin(tournaments, eq(tournaments.id, tournamentRegistrations.tournamentId))
    .where(eq(tournamentRegistrations.teamId, teamId))
    .orderBy(desc(tournaments.startsAt));
}

/** Equipos que capitanea el usuario, con sus miembros, para el formulario de inscripción. */
export async function captainTeamsWithMembers(userId: string) {
  const db = await getDb();
  const owned = await db
    .select({ id: teams.id, name: teams.name, tag: teams.tag, captainId: teams.captainId })
    .from(teams)
    .where(and(eq(teams.captainId, userId), eq(teams.status, "active")))
    .orderBy(asc(teams.name));
  if (owned.length === 0) return [];
  const members = await db
    .select({
      teamId: teamMembers.teamId,
      userId: teamMembers.userId,
      displayName: profiles.displayName,
      handle: profiles.handle,
      hasRiotId: sql<boolean>`${profiles.riotGameName} is not null`,
      suspended: sql<boolean>`${users.suspendedAt} is not null`,
    })
    .from(teamMembers)
    .innerJoin(profiles, eq(profiles.userId, teamMembers.userId))
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(inArray(teamMembers.teamId, owned.map((t) => t.id)))
    .orderBy(asc(teamMembers.joinedAt));
  return owned.map((team) => ({ ...team, members: members.filter((m) => m.teamId === team.id) }));
}

export async function sitemapTeams() {
  const db = await getDb();
  return db.select({ slug: teams.slug, updatedAt: teams.updatedAt }).from(teams).where(eq(teams.status, "active"));
}
