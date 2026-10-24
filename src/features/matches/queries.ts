import "server-only";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { roundName } from "@/domain/competition/round-names";
import { type Actor, canManageTournament, reportingSide } from "@/domain/permissions";
import { getDb } from "@/server/db/client";
import {
  disputes,
  matches,
  matchGames,
  matchResults,
  profiles,
  registrationMembers,
  resultEvidence,
  tournamentParticipants,
  tournamentRounds,
} from "@/server/db/schema";
import { getParticipants, type ParticipantRef, type TournamentDetail } from "../tournaments/queries";
import { loadSides } from "./service";

const reporter = alias(profiles, "reporter");
const confirmer = alias(profiles, "confirmer");
const opener = alias(profiles, "opener");
const resolver = alias(profiles, "resolver");

export interface RosterPlayer {
  userId: string;
  displayName: string;
  handle: string;
  isPublic: boolean;
  riotId: string | null;
  isSubstitute: boolean;
}

async function roster(participantId: string | null): Promise<RosterPlayer[]> {
  if (!participantId) return [];
  const db = await getDb();
  const [p] = await db.select({ registrationId: tournamentParticipants.registrationId }).from(tournamentParticipants).where(eq(tournamentParticipants.id, participantId));
  if (!p) return [];
  const rows = await db
    .select({
      userId: registrationMembers.userId,
      isSubstitute: registrationMembers.isSubstitute,
      displayName: profiles.displayName,
      handle: profiles.handle,
      isPublic: profiles.isPublic,
      riotGameName: profiles.riotGameName,
      riotTagLine: profiles.riotTagLine,
    })
    .from(registrationMembers)
    .innerJoin(profiles, eq(profiles.userId, registrationMembers.userId))
    .where(eq(registrationMembers.registrationId, p.registrationId))
    .orderBy(asc(registrationMembers.isSubstitute), asc(profiles.displayName));
  return rows.map((r) => ({ ...r, riotId: r.riotGameName ? `${r.riotGameName}#${r.riotTagLine}` : null }));
}

/** Todo lo que muestra la página de un partido, filtrado según quién la mira. */
export async function getMatchDetail(matchId: string, detail: TournamentDetail, viewer: Actor | null) {
  const db = await getDb();
  const [row] = await db
    .select({ match: matches, bracket: tournamentRounds.bracket, roundNumber: tournamentRounds.number })
    .from(matches)
    .innerJoin(tournamentRounds, eq(tournamentRounds.id, matches.roundId))
    .where(eq(matches.id, matchId));
  if (!row || row.match.tournamentId !== detail.tournament.id) return null;
  const m = row.match;

  const [participants, sides, rosterA, rosterB, stageRounds] = await Promise.all([
    getParticipants(detail.tournament.id),
    loadSides(db, m),
    roster(m.participantAId),
    roster(m.participantBId),
    db
      .select({ number: tournamentRounds.number, bracket: tournamentRounds.bracket })
      .from(tournamentRounds)
      .where(eq(tournamentRounds.stageId, m.stageId)),
  ]);
  const totalRounds = Math.max(row.roundNumber, ...stageRounds.filter((r) => r.bracket === row.bracket).map((r) => r.number));
  const byId = new Map(participants.map((p) => [p.id, p]));
  const a: ParticipantRef | null = m.participantAId ? (byId.get(m.participantAId) ?? null) : null;
  const b: ParticipantRef | null = m.participantBId ? (byId.get(m.participantBId) ?? null) : null;

  const canManage = canManageTournament(viewer, detail.tournament);
  const side = reportingSide(viewer, sides);
  const isMember = !!viewer && [...(sides.a?.memberIds ?? []), ...(sides.b?.memberIds ?? [])].includes(viewer.id);
  const canSeePrivate = canManage || isMember;

  const [results, disputeRows, games, evidence] = await Promise.all([
    db
      .select({
        result: matchResults,
        reporterName: reporter.displayName,
        confirmerName: confirmer.displayName,
      })
      .from(matchResults)
      .leftJoin(reporter, eq(reporter.userId, matchResults.reportedById))
      .leftJoin(confirmer, eq(confirmer.userId, matchResults.opponentConfirmedById))
      .where(eq(matchResults.matchId, m.id))
      .orderBy(desc(matchResults.createdAt)),
    db
      .select({ dispute: disputes, openerName: opener.displayName, resolverName: resolver.displayName })
      .from(disputes)
      .leftJoin(opener, eq(opener.userId, disputes.openedById))
      .leftJoin(resolver, eq(resolver.userId, disputes.resolvedById))
      .where(eq(disputes.matchId, m.id))
      .orderBy(desc(disputes.createdAt)),
    db.select().from(matchGames).where(eq(matchGames.matchId, m.id)).orderBy(asc(matchGames.gameNumber)),
    canSeePrivate ? db.select().from(resultEvidence).where(eq(resultEvidence.matchId, m.id)) : Promise.resolve([]),
  ]);

  const playerNames = new Map([...rosterA, ...rosterB].map((p) => [p.userId, p.displayName]));
  const mvpIds = [m.mvpUserId, ...results.map((r) => r.result.mvpUserId)].filter((id): id is string => !!id && !playerNames.has(id));
  if (mvpIds.length > 0) {
    const extra = await db.select({ userId: profiles.userId, name: profiles.displayName }).from(profiles).where(inArray(profiles.userId, mvpIds));
    for (const e of extra) playerNames.set(e.userId, e.name);
  }

  return {
    match: m,
    bracket: row.bracket,
    roundNumber: row.roundNumber,
    roundName: roundName({
      bracket: row.bracket,
      number: row.roundNumber,
      totalRounds,
      doubleElimination: detail.tournament.format === "double_elimination",
    }),
    a,
    b,
    sides,
    rosterA,
    rosterB,
    playerNames,
    games,
    results: results.map((r) => ({
      ...r.result,
      reporterName: r.reporterName,
      confirmerName: r.confirmerName,
      side: r.result.reportingParticipantId === m.participantAId ? ("a" as const) : r.result.reportingParticipantId === m.participantBId ? ("b" as const) : null,
      evidence: evidence.filter((e) => e.resultId === r.result.id),
    })),
    disputes: disputeRows.map((d) => ({ ...d.dispute, openerName: d.openerName, resolverName: d.resolverName, evidence: evidence.filter((e) => e.disputeId === d.dispute.id) })),
    viewer: { canManage, side, isMember, canSeePrivate },
  };
}

export type MatchDetail = NonNullable<Awaited<ReturnType<typeof getMatchDetail>>>;
