import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import {
  profiles,
  registrationMembers,
  teamMembers,
  teams,
  tournamentParticipants,
  tournamentRegistrations,
  tournaments,
  users,
} from "@/server/db/schema";
import { getChampion } from "../tournaments/queries";

export async function getOwnProfile(userId: string) {
  const db = await getDb();
  const [row] = await db.select().from(profiles).where(eq(profiles.userId, userId));
  return row ?? null;
}

/** Estadísticas reales de un jugador: partidos confirmados de las plantillas en las que estuvo inscrito. */
export async function playerStats(userId: string): Promise<{ played: number; wins: number; mvps: number }> {
  const db = await getDb();
  const result = (await db.execute(sql`
    select count(*)::int as played,
           (count(*) filter (where m.winner_id = p.id))::int as wins,
           (count(*) filter (where m.mvp_user_id = ${userId}))::int as mvps
      from matches m
      join tournament_participants p on p.id in (m.participant_a_id, m.participant_b_id)
      join tournament_registration_members rm on rm.registration_id = p.registration_id
     where rm.user_id = ${userId} and m.status = 'confirmed' and not m.is_bye
  `)) as unknown as { rows: { played: number; wins: number; mvps: number }[] };
  return result.rows[0] ?? { played: 0, wins: 0, mvps: 0 };
}

export interface TournamentHistoryItem {
  tournamentId: string;
  name: string;
  slug: string;
  status: (typeof tournaments.$inferSelect)["status"];
  format: (typeof tournaments.$inferSelect)["format"];
  startsAt: Date;
  teamName: string | null;
  teamSlug: string | null;
  isChampion: boolean;
}

/** Torneos públicos en los que el jugador estuvo en una plantilla aprobada. */
export async function playerTournamentHistory(userId: string): Promise<TournamentHistoryItem[]> {
  const db = await getDb();
  const rows = await db
    .select({
      tournamentId: tournaments.id,
      name: tournaments.name,
      slug: tournaments.slug,
      status: tournaments.status,
      format: tournaments.format,
      startsAt: tournaments.startsAt,
      teamName: teams.name,
      teamSlug: teams.slug,
      participantId: tournamentParticipants.id,
    })
    .from(registrationMembers)
    .innerJoin(tournamentRegistrations, eq(tournamentRegistrations.id, registrationMembers.registrationId))
    .innerJoin(tournaments, eq(tournaments.id, tournamentRegistrations.tournamentId))
    .leftJoin(teams, eq(teams.id, tournamentRegistrations.teamId))
    .leftJoin(tournamentParticipants, eq(tournamentParticipants.registrationId, tournamentRegistrations.id))
    .where(and(eq(registrationMembers.userId, userId), eq(tournamentRegistrations.status, "approved"), eq(tournaments.visibility, "public")))
    .orderBy(desc(tournaments.startsAt));
  const out: TournamentHistoryItem[] = [];
  for (const row of rows) {
    const champion = row.status === "completed" ? await getChampion({ id: row.tournamentId, format: row.format, status: row.status }) : null;
    out.push({ ...row, isChampion: !!champion && champion.id === row.participantId });
  }
  return out;
}

export async function getPublicProfile(handle: string) {
  const db = await getDb();
  const [row] = await db
    .select({ profile: profiles, createdAt: users.createdAt, suspendedAt: users.suspendedAt })
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.userId))
    .where(eq(profiles.handle, handle));
  if (!row || !row.profile.isPublic || row.suspendedAt) return null;
  const memberships = await db
    .select({ id: teams.id, name: teams.name, tag: teams.tag, slug: teams.slug, logoMediaId: teams.logoMediaId, captainId: teams.captainId, joinedAt: teamMembers.joinedAt })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(and(eq(teamMembers.userId, row.profile.userId), eq(teams.status, "active")));
  const [stats, history] = await Promise.all([playerStats(row.profile.userId), playerTournamentHistory(row.profile.userId)]);
  return { ...row.profile, memberSince: row.createdAt, teams: memberships, stats, history };
}

/** Jugadores públicos para el mapa del sitio. */
export async function sitemapProfiles() {
  const db = await getDb();
  return db
    .select({ handle: profiles.handle, updatedAt: profiles.updatedAt })
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.userId))
    .where(and(eq(profiles.isPublic, true), sql`${users.suspendedAt} is null`));
}
