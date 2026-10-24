import "server-only";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/server/db/client";
import { matches, profiles, teams, tournamentParticipants, tournaments } from "@/server/db/schema";
import { getChampion } from "../tournaments/queries";

/** Lado de un partido en los listados (nombre y enlace). */
export interface SideRef {
  participantId: string;
  name: string;
  tag: string | null;
  logoMediaId: string | null;
  href: string | null;
}

export interface MatchListItem {
  id: string;
  status: (typeof matches.$inferSelect)["status"];
  scheduledAt: Date | null;
  confirmedAt: Date | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: string | null;
  isForfeit: boolean;
  bestOf: number;
  a: SideRef | null;
  b: SideRef | null;
  tournament: { name: string; slug: string; isDemo: boolean };
}

const pa = alias(tournamentParticipants, "pa");
const pb = alias(tournamentParticipants, "pb");
const ta = alias(teams, "ta");
const tb = alias(teams, "tb");
const ua = alias(profiles, "ua");
const ub = alias(profiles, "ub");

function side(
  participantId: string | null,
  team: { name: string; tag: string; slug: string; logo: string | null } | null,
  player: { name: string; handle: string; avatar: string | null } | null,
): SideRef | null {
  if (!participantId) return null;
  return {
    participantId,
    name: team?.name ?? player?.name ?? "—",
    tag: team?.tag ?? null,
    logoMediaId: team?.logo ?? player?.avatar ?? null,
    href: team ? `/equipos/${team.slug}` : player ? `/jugadores/${player.handle}` : null,
  };
}

/** Partidos con sus dos lados resueltos, para listados (portada, panel, perfiles). */
export async function listMatches(options: {
  where: ReturnType<typeof and>;
  order: "recent" | "upcoming";
  limit: number;
}): Promise<MatchListItem[]> {
  const db = await getDb();
  const rows = await db
    .select({
      m: matches,
      tName: tournaments.name,
      tSlug: tournaments.slug,
      tDemo: tournaments.isDemo,
      aTeam: { name: ta.name, tag: ta.tag, slug: ta.slug, logo: ta.logoMediaId },
      bTeam: { name: tb.name, tag: tb.tag, slug: tb.slug, logo: tb.logoMediaId },
      aPlayer: { name: ua.displayName, handle: ua.handle, avatar: ua.avatarMediaId },
      bPlayer: { name: ub.displayName, handle: ub.handle, avatar: ub.avatarMediaId },
    })
    .from(matches)
    .innerJoin(tournaments, eq(tournaments.id, matches.tournamentId))
    .leftJoin(pa, eq(pa.id, matches.participantAId))
    .leftJoin(pb, eq(pb.id, matches.participantBId))
    .leftJoin(ta, eq(ta.id, pa.teamId))
    .leftJoin(tb, eq(tb.id, pb.teamId))
    .leftJoin(ua, eq(ua.userId, pa.userId))
    .leftJoin(ub, eq(ub.userId, pb.userId))
    .where(options.where)
    .orderBy(options.order === "recent" ? desc(matches.confirmedAt) : asc(matches.scheduledAt))
    .limit(options.limit);
  return rows.map((r) => ({
    id: r.m.id,
    status: r.m.status,
    scheduledAt: r.m.scheduledAt,
    confirmedAt: r.m.confirmedAt,
    scoreA: r.m.scoreA,
    scoreB: r.m.scoreB,
    winnerId: r.m.winnerId,
    isForfeit: r.m.isForfeit,
    bestOf: r.m.bestOf,
    a: side(r.m.participantAId, r.aTeam, r.aPlayer),
    b: side(r.m.participantBId, r.bTeam, r.bPlayer),
    tournament: { name: r.tName, slug: r.tSlug, isDemo: r.tDemo },
  }));
}

const publicTournament = eq(tournaments.visibility, "public");

export function latestResults(limit = 6) {
  return listMatches({
    where: and(publicTournament, eq(matches.status, "confirmed"), eq(matches.isBye, false)),
    order: "recent",
    limit,
  });
}

export function upcomingMatches(limit = 6) {
  return listMatches({
    where: and(
      publicTournament,
      eq(tournaments.status, "in_progress"),
      inArray(matches.status, ["scheduled", "in_progress"]),
      gte(matches.scheduledAt, new Date(Date.now() - 3 * 60 * 60 * 1000)),
    ),
    order: "upcoming",
    limit,
  });
}

/** Condición: el usuario está en la plantilla inscrita de alguno de los dos lados del partido. */
function involves(userId: string) {
  return sql`exists (
    select 1 from ${tournamentParticipants} p
      join tournament_registration_members rm on rm.registration_id = p.registration_id
     where (p.id = ${matches.participantAId} or p.id = ${matches.participantBId}) and rm.user_id = ${userId}
  )`;
}

/** Partidos del usuario: pendientes de jugar (con rivales conocidos) o ya jugados. */
export function myMatches(userId: string, mode: "upcoming" | "played", limit = 20) {
  return mode === "upcoming"
    ? listMatches({
        where: and(
          involves(userId),
          eq(tournaments.status, "in_progress"),
          inArray(matches.status, ["pending", "scheduled", "in_progress", "awaiting_validation", "disputed"]),
          sql`${matches.participantAId} is not null and ${matches.participantBId} is not null`,
        ),
        order: "upcoming",
        limit,
      })
    : listMatches({
        where: and(involves(userId), eq(matches.status, "confirmed"), eq(matches.isBye, false)),
        order: "recent",
        limit,
      });
}

/** Cifras reales para la portada (nada inventado: si es cero, es cero). */
export async function platformStats(): Promise<{ tournaments: number; open: number; teams: number; matches: number }> {
  const db = await getDb();
  const result = (await db.execute(sql`
    select
      (select count(*)::int from ${tournaments} where visibility = 'public' and status in ('published', 'in_progress', 'completed')) as tournaments,
      (select count(*)::int from ${tournaments} where visibility = 'public' and status = 'published'
         and registration_opens_at <= now() and registration_closes_at > now()) as open,
      (select count(*)::int from ${teams} where status = 'active') as teams,
      (select count(*)::int from ${matches} where status = 'confirmed' and not is_bye) as matches
  `)) as unknown as { rows: { tournaments: number; open: number; teams: number; matches: number }[] };
  return result.rows[0] ?? { tournaments: 0, open: 0, teams: 0, matches: 0 };
}

export interface TeamRankingRow {
  teamId: string;
  name: string;
  tag: string;
  slug: string;
  logoMediaId: string | null;
  played: number;
  wins: number;
  losses: number;
  titles: number;
  isDemo: boolean;
}

/**
 * Ranking de equipos calculado con los partidos confirmados de torneos públicos (los BYE no cuentan).
 * Orden: títulos, victorias, porcentaje de victorias y menos derrotas.
 */
export async function teamRanking(limit = 50): Promise<TeamRankingRow[]> {
  const db = await getDb();
  const result = (await db.execute(sql`
    with sides as (
      select p.team_id, (m.winner_id = m.participant_a_id) as won
        from ${matches} m
        join ${tournamentParticipants} p on p.id = m.participant_a_id
        join ${tournaments} t on t.id = m.tournament_id
       where m.status = 'confirmed' and not m.is_bye and t.visibility = 'public'
      union all
      select p.team_id, (m.winner_id = m.participant_b_id) as won
        from ${matches} m
        join ${tournamentParticipants} p on p.id = m.participant_b_id
        join ${tournaments} t on t.id = m.tournament_id
       where m.status = 'confirmed' and not m.is_bye and t.visibility = 'public'
    )
    select s.team_id as "teamId", tm.name, tm.tag, tm.slug, tm.logo_media_id as "logoMediaId", tm.is_demo as "isDemo",
           count(*)::int as played,
           (count(*) filter (where s.won))::int as wins,
           (count(*) filter (where not s.won))::int as losses
      from sides s
      join ${teams} tm on tm.id = s.team_id
     where s.team_id is not null
     group by s.team_id, tm.name, tm.tag, tm.slug, tm.logo_media_id, tm.is_demo
  `)) as unknown as { rows: Omit<TeamRankingRow, "titles">[] };

  // Títulos: campeones de los torneos terminados (se calculan a partir de su cuadro o su clasificación).
  const completed = await db
    .select({ id: tournaments.id, format: tournaments.format, status: tournaments.status })
    .from(tournaments)
    .where(and(eq(tournaments.status, "completed"), publicTournament, eq(tournaments.participantType, "team")));
  const titles = new Map<string, number>();
  for (const t of completed) {
    const champion = await getChampion(t);
    if (!champion) continue;
    const [p] = await db.select({ teamId: tournamentParticipants.teamId }).from(tournamentParticipants).where(eq(tournamentParticipants.id, champion.id));
    if (p?.teamId) titles.set(p.teamId, (titles.get(p.teamId) ?? 0) + 1);
  }

  return result.rows
    .map((r) => ({ ...r, titles: titles.get(r.teamId) ?? 0 }))
    .sort(
      (x, y) =>
        y.titles - x.titles ||
        y.wins - x.wins ||
        y.wins / Math.max(1, y.played) - x.wins / Math.max(1, x.played) ||
        x.losses - y.losses ||
        x.name.localeCompare(y.name),
    )
    .slice(0, limit);
}
