import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { cache } from "react";
import { championOf } from "@/domain/competition/elimination";
import { type RoundName, roundName } from "@/domain/competition/round-names";
import { computeStandings, type StandingRow, type Tiebreaker } from "@/domain/competition/standings";
import type { BracketKind, EngineMatch } from "@/domain/competition/types";
import { type Actor, canManageTournament, canViewTournament } from "@/domain/permissions";
import { phaseCategory, type TournamentCategory, tournamentPhase, type TournamentPhase } from "@/domain/tournament/phase";
import { getDb } from "@/server/db/client";
import {
  matches,
  profiles,
  registrationMembers,
  teams,
  tournamentParticipants,
  tournamentRegistrations,
  tournamentRounds,
  tournamentRules,
  tournaments,
  users,
} from "@/server/db/schema";

type TournamentRow = typeof tournaments.$inferSelect;
export type RulesRow = typeof tournamentRules.$inferSelect;

export interface TournamentCard {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  format: TournamentRow["format"];
  participantType: TournamentRow["participantType"];
  status: TournamentRow["status"];
  phase: TournamentPhase;
  category: TournamentCategory;
  visibility: TournamentRow["visibility"];
  region: string | null;
  bannerMediaId: string | null;
  registrationOpensAt: Date;
  registrationClosesAt: Date;
  startsAt: Date;
  endsAt: Date | null;
  /** Momento real en que empezó (puede adelantarse a `startsAt`). */
  startedAt: Date | null;
  minParticipants: number;
  maxParticipants: number;
  approvedCount: number;
  prizeDescription: string | null;
  isDemo: boolean;
  organizerName: string;
}

const approvedCountSql = sql<number>`(select count(*)::int from ${tournamentRegistrations} r where r.tournament_id = ${tournaments.id} and r.status = 'approved')`;
const requestCountSql = sql<number>`(select count(*)::int from ${tournamentRegistrations} r where r.tournament_id = ${tournaments.id} and r.status <> 'withdrawn')`;

const cardColumns = {
  id: tournaments.id,
  slug: tournaments.slug,
  name: tournaments.name,
  summary: tournaments.summary,
  format: tournaments.format,
  participantType: tournaments.participantType,
  status: tournaments.status,
  visibility: tournaments.visibility,
  region: tournaments.region,
  bannerMediaId: tournaments.bannerMediaId,
  registrationOpensAt: tournaments.registrationOpensAt,
  registrationClosesAt: tournaments.registrationClosesAt,
  startsAt: tournaments.startsAt,
  endsAt: tournaments.endsAt,
  startedAt: tournaments.startedAt,
  minParticipants: tournaments.minParticipants,
  maxParticipants: tournaments.maxParticipants,
  prizeDescription: tournaments.prizeDescription,
  isDemo: tournaments.isDemo,
  approvedCount: approvedCountSql,
  organizerName: sql<string>`coalesce(${profiles.displayName}, ${users.name})`,
};

function toCard(row: Omit<TournamentCard, "phase" | "category">, now: Date): TournamentCard {
  const phase = tournamentPhase(row, now);
  return { ...row, phase, category: phaseCategory(phase) };
}

function categoryCondition(category: TournamentCategory | "all", now: Date): SQL | undefined {
  switch (category) {
    case "open":
      return and(eq(tournaments.status, "published"), lte(tournaments.registrationOpensAt, now), sql`${tournaments.registrationClosesAt} > ${now}`);
    case "upcoming":
      return and(
        eq(tournaments.status, "published"),
        or(sql`${tournaments.registrationOpensAt} > ${now}`, lte(tournaments.registrationClosesAt, now)),
      );
    case "live":
      return eq(tournaments.status, "in_progress");
    case "finished":
      return eq(tournaments.status, "completed");
    case "cancelled":
      return eq(tournaments.status, "cancelled");
    case "draft":
      return eq(tournaments.status, "draft");
    case "all":
      return inArray(tournaments.status, ["published", "in_progress", "completed"]);
  }
}

export type TournamentSort = "starts_asc" | "starts_desc" | "participants" | "popular";

export interface TournamentFilters {
  q?: string;
  category?: TournamentCategory | "all";
  format?: TournamentRow["format"];
  participantType?: TournamentRow["participantType"];
  from?: Date | null;
  to?: Date | null;
  sort?: TournamentSort;
  page?: number;
  pageSize?: number;
}

/** Explorador público: solo torneos publicados y públicos (nunca borradores ni privados). */
export async function listPublicTournaments(filters: TournamentFilters) {
  const db = await getDb();
  const now = new Date();
  const pageSize = filters.pageSize ?? 12;
  const page = Math.max(1, filters.page ?? 1);
  const where = and(
    eq(tournaments.visibility, "public"),
    categoryCondition(filters.category ?? "all", now),
    filters.q ? ilike(tournaments.name, `%${filters.q.replace(/[%_\\]/g, "\\$&")}%`) : undefined,
    filters.format ? eq(tournaments.format, filters.format) : undefined,
    filters.participantType ? eq(tournaments.participantType, filters.participantType) : undefined,
    filters.from ? gte(tournaments.startsAt, filters.from) : undefined,
    filters.to ? lte(tournaments.startsAt, filters.to) : undefined,
  );
  const order = {
    starts_asc: [asc(tournaments.startsAt)],
    starts_desc: [desc(tournaments.startsAt)],
    participants: [desc(approvedCountSql), asc(tournaments.startsAt)],
    popular: [desc(requestCountSql), asc(tournaments.startsAt)],
  }[filters.sort ?? "starts_asc"];

  const [rows, [count]] = await Promise.all([
    db
      .select(cardColumns)
      .from(tournaments)
      .innerJoin(users, eq(users.id, tournaments.organizerId))
      .leftJoin(profiles, eq(profiles.userId, tournaments.organizerId))
      .where(where)
      .orderBy(...order)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(tournaments).where(where),
  ]);
  const total = count?.total ?? 0;
  return { items: rows.map((r) => toCard(r, now)), total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Tarjetas para la portada, por categoría. */
export async function featuredTournaments(category: TournamentCategory, limit: number): Promise<TournamentCard[]> {
  const sort: TournamentSort = category === "finished" ? "starts_desc" : "starts_asc";
  const { items } = await listPublicTournaments({ category, sort, pageSize: limit });
  return items;
}

/** Torneos que gestiona un organizador (todos, para un administrador). */
export async function listManagedTournaments(actor: Actor, filters: { category?: TournamentCategory | "all"; q?: string; page?: number }) {
  const db = await getDb();
  const now = new Date();
  const pageSize = 20;
  const page = Math.max(1, filters.page ?? 1);
  const where = and(
    actor.role === "admin" ? undefined : eq(tournaments.organizerId, actor.id),
    filters.category && filters.category !== "all" ? categoryCondition(filters.category, now) : undefined,
    filters.q ? ilike(tournaments.name, `%${filters.q.replace(/[%_\\]/g, "\\$&")}%`) : undefined,
  );
  const [rows, [count]] = await Promise.all([
    db
      .select(cardColumns)
      .from(tournaments)
      .innerJoin(users, eq(users.id, tournaments.organizerId))
      .leftJoin(profiles, eq(profiles.userId, tournaments.organizerId))
      .where(where)
      .orderBy(desc(tournaments.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(tournaments).where(where),
  ]);
  const total = count?.total ?? 0;
  return { items: rows.map((r) => toCard(r, now)), total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

// ---------------------------------------------------------------------------------------------------------
// Detalle
// ---------------------------------------------------------------------------------------------------------

export interface ParticipantRef {
  id: string;
  kind: "team" | "solo";
  name: string;
  tag: string | null;
  /** Ruta pública del equipo o del jugador. */
  href: string | null;
  logoMediaId: string | null;
  seed: number | null;
  status: "active" | "disqualified";
}

export async function getParticipants(tournamentId: string): Promise<ParticipantRef[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: tournamentParticipants.id,
      seed: tournamentParticipants.seed,
      status: tournamentParticipants.status,
      teamName: teams.name,
      teamTag: teams.tag,
      teamSlug: teams.slug,
      teamLogo: teams.logoMediaId,
      playerName: profiles.displayName,
      playerHandle: profiles.handle,
      playerAvatar: profiles.avatarMediaId,
      playerPublic: profiles.isPublic,
      createdAt: tournamentParticipants.createdAt,
    })
    .from(tournamentParticipants)
    .leftJoin(teams, eq(teams.id, tournamentParticipants.teamId))
    .leftJoin(profiles, eq(profiles.userId, tournamentParticipants.userId))
    .where(eq(tournamentParticipants.tournamentId, tournamentId))
    .orderBy(sql`${tournamentParticipants.seed} asc nulls last`, asc(tournamentParticipants.createdAt));
  return rows.map((r) => ({
    id: r.id,
    kind: r.teamName ? "team" : "solo",
    name: r.teamName ?? r.playerName ?? "—",
    tag: r.teamTag,
    href: r.teamSlug ? `/equipos/${r.teamSlug}` : r.playerHandle && r.playerPublic ? `/jugadores/${r.playerHandle}` : null,
    logoMediaId: r.teamLogo ?? r.playerAvatar,
    seed: r.seed,
    status: r.status,
  }));
}

export interface TournamentDetail {
  tournament: TournamentRow;
  rules: RulesRow;
  phase: TournamentPhase;
  organizer: { name: string; handle: string | null };
  counts: { approved: number; pending: number; waitlisted: number };
  viewer: { canManage: boolean; isParticipant: boolean };
}

/** Carga un torneo por su URL comprobando quién puede verlo. `null` = no existe o no se puede ver. */
export const getTournamentDetail = cache(
  async (slug: string, viewer: Actor | null, accessCode: string | null): Promise<TournamentDetail | null> => {
    const db = await getDb();
    const [row] = await db
      .select({ tournament: tournaments, rules: tournamentRules, organizerName: profiles.displayName, organizerHandle: profiles.handle, userName: users.name })
      .from(tournaments)
      .innerJoin(tournamentRules, eq(tournamentRules.tournamentId, tournaments.id))
      .innerJoin(users, eq(users.id, tournaments.organizerId))
      .leftJoin(profiles, eq(profiles.userId, tournaments.organizerId))
      .where(eq(tournaments.slug, slug));
    if (!row) return null;
    const t = row.tournament;

    const isParticipant = viewer ? await isTournamentParticipant(t.id, viewer.id) : false;
    const hasAccessCode = !!t.accessCode && accessCode === t.accessCode;
    if (!canViewTournament(viewer, t, { isParticipant, hasAccessCode })) return null;

    const counts = await db
      .select({ status: tournamentRegistrations.status, count: sql<number>`count(*)::int` })
      .from(tournamentRegistrations)
      .where(eq(tournamentRegistrations.tournamentId, t.id))
      .groupBy(tournamentRegistrations.status);
    const count = (s: string) => counts.find((c) => c.status === s)?.count ?? 0;

    return {
      tournament: t,
      rules: row.rules,
      phase: tournamentPhase(t, new Date()),
      organizer: { name: row.organizerName ?? row.userName, handle: row.organizerHandle },
      counts: { approved: count("approved"), pending: count("pending"), waitlisted: count("waitlisted") },
      viewer: { canManage: canManageTournament(viewer, t), isParticipant },
    };
  },
);

/** ¿Juega este usuario el torneo (en una plantilla aprobada o como capitán de un equipo aprobado)? */
export async function isTournamentParticipant(tournamentId: string, userId: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .select({ one: sql`1` })
    .from(tournamentRegistrations)
    .leftJoin(registrationMembers, eq(registrationMembers.registrationId, tournamentRegistrations.id))
    .leftJoin(teams, eq(teams.id, tournamentRegistrations.teamId))
    .where(
      and(
        eq(tournamentRegistrations.tournamentId, tournamentId),
        eq(tournamentRegistrations.status, "approved"),
        or(eq(registrationMembers.userId, userId), eq(teams.captainId, userId), eq(tournamentRegistrations.userId, userId)),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

// ---------------------------------------------------------------------------------------------------------
// Competición: rondas, partidos, clasificación y campeón
// ---------------------------------------------------------------------------------------------------------

export interface MatchView {
  id: string;
  roundId: string;
  bracket: BracketKind;
  roundNumber: number;
  position: number;
  a: ParticipantRef | null;
  b: ParticipantRef | null;
  aDead: boolean;
  bDead: boolean;
  status: (typeof matches.$inferSelect)["status"];
  scoreA: number | null;
  scoreB: number | null;
  winnerId: string | null;
  isBye: boolean;
  isForfeit: boolean;
  bestOf: number;
  scheduledAt: Date | null;
  nextMatchId: string | null;
  version: number;
}

export interface RoundView {
  id: string;
  bracket: BracketKind;
  number: number;
  bestOf: number;
  name: RoundName;
  matches: MatchView[];
}

export async function getCompetition(tournamentId: string, format: TournamentRow["format"]): Promise<RoundView[]> {
  const db = await getDb();
  const [participants, rounds, rows] = await Promise.all([
    getParticipants(tournamentId),
    db.select().from(tournamentRounds).where(eq(tournamentRounds.tournamentId, tournamentId)).orderBy(asc(tournamentRounds.number)),
    db.select().from(matches).where(eq(matches.tournamentId, tournamentId)).orderBy(asc(matches.position)),
  ]);
  const byId = new Map(participants.map((p) => [p.id, p]));
  const totals = new Map<BracketKind, number>();
  for (const r of rounds) totals.set(r.bracket, Math.max(totals.get(r.bracket) ?? 0, r.number));

  const order: Record<BracketKind, number> = { winners: 0, losers: 1, grand_final: 2, league: 3 };
  return rounds
    .sort((x, y) => order[x.bracket] - order[y.bracket] || x.number - y.number)
    .map((r) => ({
      id: r.id,
      bracket: r.bracket,
      number: r.number,
      bestOf: r.bestOf,
      name: roundName({ bracket: r.bracket, number: r.number, totalRounds: totals.get(r.bracket)!, doubleElimination: format === "double_elimination" }),
      matches: rows
        .filter((m) => m.roundId === r.id)
        .map((m) => ({
          id: m.id,
          roundId: r.id,
          bracket: r.bracket,
          roundNumber: r.number,
          position: m.position,
          a: m.participantAId ? (byId.get(m.participantAId) ?? null) : null,
          b: m.participantBId ? (byId.get(m.participantBId) ?? null) : null,
          aDead: m.slotADead,
          bDead: m.slotBDead,
          status: m.status,
          scoreA: m.scoreA,
          scoreB: m.scoreB,
          winnerId: m.winnerId,
          isBye: m.isBye,
          isForfeit: m.isForfeit,
          bestOf: m.bestOf,
          scheduledAt: m.scheduledAt,
          nextMatchId: m.nextMatchId,
          version: m.version,
        })),
    }));
}

export interface StandingView extends StandingRow {
  participant: ParticipantRef;
}

export async function getLeagueStandings(tournamentId: string): Promise<StandingView[]> {
  const db = await getDb();
  const [rules] = await db.select().from(tournamentRules).where(eq(tournamentRules.tournamentId, tournamentId));
  const participants = await getParticipants(tournamentId);
  const confirmed = await db
    .select()
    .from(matches)
    .where(and(eq(matches.tournamentId, tournamentId), eq(matches.status, "confirmed"), eq(matches.isBye, false)));
  const table = computeStandings(
    participants.map((p, index) => ({ id: p.id, seed: p.seed ?? index + 1 })),
    confirmed.map((m) => ({
      a: m.participantAId!,
      b: m.participantBId!,
      winner: m.winnerId === m.participantAId ? "a" : "b",
      scoreA: m.scoreA ?? 0,
      scoreB: m.scoreB ?? 0,
      isForfeit: m.isForfeit,
    })),
    {
      pointsWin: rules?.pointsWin ?? 3,
      pointsLoss: rules?.pointsLoss ?? 0,
      pointsForfeitLoss: rules?.pointsForfeitLoss ?? 0,
      tiebreakers: (rules?.tiebreakers ?? []) as Tiebreaker[],
    },
  );
  const byId = new Map(participants.map((p) => [p.id, p]));
  return table.map((row) => ({ ...row, participant: byId.get(row.participantId)! }));
}

/** Campeón de un torneo terminado (o `null`). */
export async function getChampion(t: Pick<TournamentRow, "id" | "format" | "status">): Promise<ParticipantRef | null> {
  if (t.status !== "completed") return null;
  if (t.format === "league") return (await getLeagueStandings(t.id))[0]?.participant ?? null;
  const rounds = await getCompetition(t.id, t.format);
  const engine: EngineMatch[] = rounds.flatMap((r) =>
    r.matches.map((m) => ({
      id: m.id,
      bracket: m.bracket,
      round: m.roundNumber,
      position: m.position,
      a: m.a?.id ?? null,
      b: m.b?.id ?? null,
      aDead: m.aDead,
      bDead: m.bDead,
      status: m.status === "confirmed" ? "done" : m.status === "void" ? "void" : "open",
      winner: m.winnerId ? (m.winnerId === m.a?.id ? "a" : "b") : null,
      isBye: m.isBye,
      next: m.nextMatchId ? { matchId: m.nextMatchId, slot: "a" } : null,
      loserNext: null,
    })),
  );
  const championId = championOf(engine);
  if (!championId) return null;
  return (await getParticipants(t.id)).find((p) => p.id === championId) ?? null;
}

/** Torneo con sus reglas, solo si `actor` puede gestionarlo (si no, `null`). */
export async function getManagedTournament(tournamentId: string, actor: Actor) {
  const db = await getDb();
  const [row] = await db
    .select({ tournament: tournaments, rules: tournamentRules })
    .from(tournaments)
    .innerJoin(tournamentRules, eq(tournamentRules.tournamentId, tournaments.id))
    .where(eq(tournaments.id, tournamentId));
  if (!row || !canManageTournament(actor, row.tournament)) return null;
  return { ...row, phase: tournamentPhase(row.tournament, new Date()) };
}

/** Torneos con su organizador para el mapa del sitio (solo públicos). */
export async function sitemapTournaments() {
  const db = await getDb();
  return db
    .select({ slug: tournaments.slug, updatedAt: tournaments.updatedAt })
    .from(tournaments)
    .where(and(eq(tournaments.visibility, "public"), ne(tournaments.status, "draft")));
}
