import { and, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestUser, useTestDb } from "@/test/db";
import type { CurrentUser } from "@/server/auth/session";
import type { Db } from "@/server/db/client";
import {
  auditLogs,
  matches,
  notifications,
  rateLimits,
  teamMembers,
  tournamentParticipants,
  tournamentRegistrations,
  tournaments,
} from "@/server/db/schema";
import { AppError } from "@/server/errors";
import { correctResult, openDispute, reportResult, resolveDispute, scheduleMatch, validateResult } from "./matches/service";
import { registerTeam, reviewRegistration, withdrawRegistration } from "./registrations/service";
import { createTeam, inviteMember, removeMember, respondInvitation } from "./teams/service";
import { cancelTournament, closeRegistrations, createTournament, publishTournament, startTournament, updateTournament } from "./tournaments/service";
import type { TournamentInput } from "./tournaments/schemas";
import { getLeagueStandings } from "./tournaments/queries";

let db: Db;
let organizer: CurrentUser;

beforeAll(async () => {
  db = await useTestDb();
  organizer = await createTestUser(db, { role: "organizer", name: "Organizadora" });
});

// Cada prueba crea muchos torneos con la misma organizadora: sin esto, el límite de peticiones la frena.
beforeEach(async () => {
  await db.delete(rateLimits);
});

async function expectAppError(promise: Promise<unknown>, key: string) {
  await expect(promise).rejects.toSatisfy((e) => e instanceof AppError && e.messageKey === key);
}

const HOUR = 60 * 60 * 1000;

function tournamentInput(overrides: Partial<TournamentInput> = {}): TournamentInput {
  const now = Date.now();
  return {
    name: `Copa ${Math.random().toString(36).slice(2, 7)}`,
    summary: null,
    description: null,
    rulesText: null,
    prizeDescription: null,
    format: "single_elimination",
    participantType: "team",
    visibility: "public",
    region: "EUW",
    registrationOpensAt: new Date(now - HOUR),
    registrationClosesAt: new Date(now + 24 * HOUR),
    startsAt: new Date(now + 48 * HOUR),
    endsAt: null,
    minParticipants: 2,
    maxParticipants: 8,
    teamSize: 1,
    maxSubstitutes: 1,
    bestOf: 1,
    bestOfFinal: 3,
    pointsWin: 3,
    pointsLoss: 0,
    pointsForfeitLoss: 0,
    tiebreakers: ["head_to_head", "game_difference"],
    leagueLegs: 1,
    grandFinalReset: true,
    approvalMode: "automatic",
    waitlistEnabled: true,
    requireRiotId: true,
    ...overrides,
  };
}

async function publishedTournament(overrides: Partial<TournamentInput> = {}) {
  const t = await createTournament(organizer, tournamentInput(overrides));
  await publishTournament(organizer, t.id);
  return t;
}

/** Equipo con capitán (y miembros extra) creado a través del servicio. */
async function makeTeam(label: string, extraMembers = 0) {
  const captain = await createTestUser(db, { name: `Capitán ${label}` });
  const team = await createTeam(captain, { name: `Equipo ${label}`, tag: label.slice(0, 5).toUpperCase(), description: null });
  const members: CurrentUser[] = [];
  for (let i = 0; i < extraMembers; i++) {
    const member = await createTestUser(db);
    await db.insert(teamMembers).values({ teamId: team.id, userId: member.id });
    members.push(member);
  }
  return { captain, team, members };
}

async function startedTournamentWith(teamCount: number, overrides: Partial<TournamentInput> = {}) {
  const t = await publishedTournament(overrides);
  const entrants = [];
  for (let i = 0; i < teamCount; i++) {
    const entrant = await makeTeam(`T${Math.random().toString(36).slice(2, 6)}`);
    await registerTeam(entrant.captain, {
      tournamentId: t.id,
      teamId: entrant.team.id,
      roster: [{ userId: entrant.captain.id, isSubstitute: false }],
      note: null,
      accessCode: null,
    });
    entrants.push(entrant);
  }
  await closeRegistrations(organizer, t.id);
  await startTournament(organizer, t.id);
  return { t, entrants };
}

async function loadMatches(tournamentId: string) {
  return db.select().from(matches).where(eq(matches.tournamentId, tournamentId));
}

describe("equipos", () => {
  it("no permite nombres ni etiquetas repetidos entre equipos activos", async () => {
    const { captain } = await makeTeam("ALFA");
    await expectAppError(createTeam(captain, { name: "equipo alfa", tag: "ZZZ", description: null }), "errors.teamNameTaken");
    await expectAppError(createTeam(captain, { name: "Otro nombre", tag: "alfa", description: null }), "errors.teamTagTaken");
  });

  it("invitar, aceptar y no duplicar miembros ni invitaciones", async () => {
    const { captain, team } = await makeTeam("BETA");
    const player = await createTestUser(db);
    await inviteMember(captain, { teamId: team.id, handle: player.handle, message: null });
    await expectAppError(inviteMember(captain, { teamId: team.id, handle: player.handle, message: null }), "errors.alreadyInvited");

    const [inv] = await db.select().from(notifications).where(eq(notifications.userId, player.id));
    expect(inv?.type).toBe("teamInvitation");

    const invitation = await db.query.teamInvitations.findFirst({ where: (i, { eq }) => eq(i.inviteeId, player.id) });
    await respondInvitation(player, invitation!.id, true);
    await expectAppError(respondInvitation(player, invitation!.id, true), "errors.invitationNotPending");
    await expectAppError(inviteMember(captain, { teamId: team.id, handle: player.handle, message: null }), "errors.alreadyMember");

    const outsider = await createTestUser(db);
    await expectAppError(respondInvitation(outsider, invitation!.id, true), "errors.notFound");
  });

  it("respeta el tamaño máximo de equipo", async () => {
    const { captain, team } = await makeTeam("GAMMA", 9); // 10 con el capitán: el máximo por defecto
    const player = await createTestUser(db);
    await expectAppError(inviteMember(captain, { teamId: team.id, handle: player.handle, message: null }), "errors.teamFull");
  });

  it("solo el capitán gestiona el equipo y el capitán no puede salir", async () => {
    const { captain, team, members } = await makeTeam("DELTA", 2);
    await expectAppError(removeMember(members[0]!, team.id, members[1]!.id), "errors.forbidden");
    await expectAppError(removeMember(captain, team.id, captain.id), "errors.captainCannotLeave");
    await removeMember(members[0]!, team.id, members[0]!.id); // salir por su cuenta sí
  });
});

describe("inscripciones", () => {
  it("impide inscripciones duplicadas y jugadores en dos equipos del mismo torneo", async () => {
    const t = await publishedTournament();
    const a = await makeTeam("INSA", 1);
    const roster = [{ userId: a.captain.id, isSubstitute: false }];
    await registerTeam(a.captain, { tournamentId: t.id, teamId: a.team.id, roster, note: null, accessCode: null });
    await expectAppError(
      registerTeam(a.captain, { tournamentId: t.id, teamId: a.team.id, roster, note: null, accessCode: null }),
      "registrationBlockers.already_registered",
    );

    // El jugador de A también está en B: no puede jugar el torneo con los dos.
    const b = await makeTeam("INSB");
    await db.insert(teamMembers).values({ teamId: b.team.id, userId: a.members[0]!.id });
    const [regA] = await db.select().from(tournamentRegistrations).where(eq(tournamentRegistrations.teamId, a.team.id));
    await withdrawRegistration(a.captain, regA!.id);
    await registerTeam(a.captain, {
      tournamentId: t.id,
      teamId: a.team.id,
      roster: [{ userId: a.members[0]!.id, isSubstitute: false }],
      note: null,
      accessCode: null,
    });
    await expectAppError(
      registerTeam(b.captain, {
        tournamentId: t.id,
        teamId: b.team.id,
        roster: [{ userId: a.members[0]!.id, isSubstitute: false }],
        note: null,
        accessCode: null,
      }),
      "registrationBlockers.player_already_registered",
    );
  });

  it("valida la plantilla y el Riot ID", async () => {
    const t = await publishedTournament({ teamSize: 2, maxSubstitutes: 0 });
    const team = await makeTeam("ROST", 1);
    await expectAppError(
      registerTeam(team.captain, {
        tournamentId: t.id,
        teamId: team.team.id,
        roster: [{ userId: team.captain.id, isSubstitute: false }],
        note: null,
        accessCode: null,
      }),
      "registrationBlockers.roster_too_small",
    );
    const noRiot = await createTestUser(db, { riotId: false });
    await db.insert(teamMembers).values({ teamId: team.team.id, userId: noRiot.id });
    await expectAppError(
      registerTeam(team.captain, {
        tournamentId: t.id,
        teamId: team.team.id,
        roster: [
          { userId: team.captain.id, isSubstitute: false },
          { userId: noRiot.id, isSubstitute: false },
        ],
        note: null,
        accessCode: null,
      }),
      "registrationBlockers.missing_riot_id",
    );
  });

  it("con el cupo lleno manda a la lista de espera y promociona al liberarse una plaza", async () => {
    const t = await publishedTournament({ maxParticipants: 2 });
    const teamsList = [await makeTeam("CUP1"), await makeTeam("CUP2"), await makeTeam("CUP3")];
    const statuses = [];
    for (const entry of teamsList) {
      const result = await registerTeam(entry.captain, {
        tournamentId: t.id,
        teamId: entry.team.id,
        roster: [{ userId: entry.captain.id, isSubstitute: false }],
        note: null,
        accessCode: null,
      });
      statuses.push(result.status);
    }
    expect(statuses).toEqual(["approved", "approved", "waitlisted"]);

    const [first] = await db.select().from(tournamentRegistrations).where(eq(tournamentRegistrations.teamId, teamsList[0]!.team.id));
    await withdrawRegistration(teamsList[0]!.captain, first!.id);
    const [third] = await db.select().from(tournamentRegistrations).where(eq(tournamentRegistrations.teamId, teamsList[2]!.team.id));
    expect(third?.status).toBe("approved");
    const participants = await db.select().from(tournamentParticipants).where(eq(tournamentParticipants.tournamentId, t.id));
    expect(participants).toHaveLength(2);
  });

  it("la aprobación manual no supera el máximo de plazas", async () => {
    const t = await publishedTournament({ maxParticipants: 2, approvalMode: "manual", waitlistEnabled: false });
    const regs = [];
    for (const label of ["MAN1", "MAN2"]) {
      const entry = await makeTeam(label);
      await registerTeam(entry.captain, {
        tournamentId: t.id,
        teamId: entry.team.id,
        roster: [{ userId: entry.captain.id, isSubstitute: false }],
        note: null,
        accessCode: null,
      });
      const [reg] = await db.select().from(tournamentRegistrations).where(eq(tournamentRegistrations.teamId, entry.team.id));
      regs.push(reg!);
    }
    expect(regs.every((r) => r.status === "pending")).toBe(true);
    const intruder = await createTestUser(db);
    await expectAppError(reviewRegistration(intruder, regs[0]!.id, "approve", null), "errors.forbidden");
    await reviewRegistration(organizer, regs[0]!.id, "approve", null);
    await reviewRegistration(organizer, regs[1]!.id, "approve", null);
    const third = await makeTeam("MAN3");
    await expectAppError(
      registerTeam(third.captain, {
        tournamentId: t.id,
        teamId: third.team.id,
        roster: [{ userId: third.captain.id, isSubstitute: false }],
        note: null,
        accessCode: null,
      }),
      "registrationBlockers.tournament_full",
    );
  });

  it("los torneos privados exigen el código de acceso", async () => {
    const t = await publishedTournament({ visibility: "private" });
    const entry = await makeTeam("PRIV");
    const base = { tournamentId: t.id, teamId: entry.team.id, roster: [{ userId: entry.captain.id, isSubstitute: false }], note: null };
    await expectAppError(registerTeam(entry.captain, { ...base, accessCode: null }), "errors.notFound");
    const [row] = await db.select().from(tournaments).where(eq(tournaments.id, t.id));
    expect(row?.accessCode).toBeTruthy();
    await registerTeam(entry.captain, { ...base, accessCode: row!.accessCode });
  });
});

describe("generación del cuadro y resultados", () => {
  it("no genera el cuadro con inscripciones abiertas ni con menos participantes del mínimo", async () => {
    const t = await publishedTournament({ minParticipants: 3 });
    await expectAppError(startTournament(organizer, t.id), "startBlockers.registration_still_open");
    await closeRegistrations(organizer, t.id);
    await expectAppError(startTournament(organizer, t.id), "startBlockers.too_few_participants");
  });

  it("con 5 equipos genera 3 BYE ya resueltos y avanza a los ganadores", async () => {
    const { t } = await startedTournamentWith(5);
    const all = await loadMatches(t.id);
    expect(all).toHaveLength(7);
    expect(all.filter((m) => m.isBye && m.status === "confirmed")).toHaveLength(3);
    const [row] = await db.select().from(tournaments).where(eq(tournaments.id, t.id));
    expect(row?.status).toBe("in_progress");
    await expectAppError(startTournament(organizer, t.id), "startBlockers.not_published");

    // La única semifinal real de primera ronda (4 contra 5).
    const playable = all.find((m) => !m.isBye && m.participantAId && m.participantBId)!;
    await validateResult(organizer, { matchId: playable.id, version: playable.version, manual: { scoreA: 1, scoreB: 0, isForfeit: false, gameWinners: null, mvpUserId: null, notes: null } });
    const after = await loadMatches(t.id);
    const next = after.find((m) => m.id === playable.nextMatchId)!;
    expect([next.participantAId, next.participantBId]).toContain(playable.participantAId);
  });

  it("los capitanes comunican, la organización valida y el campeón cierra el torneo", async () => {
    const { t, entrants } = await startedTournamentWith(2);
    const [final] = await loadMatches(t.id);
    expect(final!.bestOf).toBe(3);

    const capA = entrants.find((e) => e.team.id)!.captain;
    const outsider = await createTestUser(db);
    const report = { matchId: final!.id, scoreA: 2, scoreB: 1, isForfeit: false, gameWinners: null, mvpUserId: null, notes: null, evidenceFiles: [], evidenceUrl: null };
    await expectAppError(reportResult(outsider, report), "errors.notAParticipant");
    await expectAppError(reportResult(capA, { ...report, scoreA: 1, scoreB: 1 }), "errors.invalidScore");

    // Comunica el capitán del equipo que esté en el lado A.
    const sideACaptain = await captainOf(final!.participantAId!, entrants);
    await reportResult(sideACaptain, report);
    let [m] = await db.select().from(matches).where(eq(matches.id, final!.id));
    expect(m?.status).toBe("awaiting_validation");

    const intruder = await createTestUser(db, { role: "organizer" });
    const pending = await db.query.matchResults.findFirst({ where: (r, { eq }) => eq(r.matchId, final!.id) });
    await expectAppError(validateResult(intruder, { matchId: final!.id, version: m!.version, resultId: pending!.id }), "errors.forbidden");
    await validateResult(organizer, { matchId: final!.id, version: m!.version, resultId: pending!.id });

    [m] = await db.select().from(matches).where(eq(matches.id, final!.id));
    expect(m?.status).toBe("confirmed");
    expect(m?.winnerId).toBe(m?.participantAId);
    const [row] = await db.select().from(tournaments).where(eq(tournaments.id, t.id));
    expect(row?.status).toBe("completed");

    const logs = await db.select().from(auditLogs).where(and(eq(auditLogs.entityId, final!.id), eq(auditLogs.action, "match.result.confirm")));
    expect(logs).toHaveLength(1);
    expect(logs[0]?.actorId).toBe(organizer.id);
  });

  it("detecta una edición concurrente del mismo partido", async () => {
    const { t } = await startedTournamentWith(2);
    const [final] = await loadMatches(t.id);
    await scheduleMatch(organizer, { matchId: final!.id, scheduledAt: new Date(Date.now() + HOUR), version: final!.version });
    // La segunda edición usa la versión que leyó antes del primer cambio.
    await expectAppError(
      scheduleMatch(organizer, { matchId: final!.id, scheduledAt: new Date(Date.now() + 2 * HOUR), version: final!.version }),
      "errors.concurrentChange",
    );
  });

  it("corrige un resultado solo si el siguiente partido no se ha jugado", async () => {
    const { t } = await startedTournamentWith(4);
    let all = await loadMatches(t.id);
    const firstRound = all.filter((m) => m.nextMatchId);
    const manual = { scoreA: 1, scoreB: 0, isForfeit: false, gameWinners: null, mvpUserId: null, notes: null };
    for (const m of firstRound) await validateResult(organizer, { matchId: m.id, version: m.version, manual });

    all = await loadMatches(t.id);
    const semi = all.find((m) => m.id === firstRound[0]!.id)!;
    const final = all.find((m) => !m.nextMatchId)!;
    const winnerBefore = semi.winnerId;
    await correctResult(organizer, { matchId: semi.id, version: semi.version, scoreA: 0, scoreB: 1, isForfeit: false, gameWinners: null, mvpUserId: null, reason: "Error al introducir el marcador" });
    all = await loadMatches(t.id);
    const fixedFinal = all.find((m) => m.id === final.id)!;
    expect([fixedFinal.participantAId, fixedFinal.participantBId]).not.toContain(winnerBefore);
    expect([fixedFinal.participantAId, fixedFinal.participantBId]).toContain(semi.participantBId);

    // Se juega la final: corregir la semifinal ya no es posible.
    await validateResult(organizer, { matchId: fixedFinal.id, version: fixedFinal.version, manual: { ...manual, scoreA: 2, scoreB: 0 } });
    const semiNow = (await loadMatches(t.id)).find((m) => m.id === semi.id)!;
    await expectAppError(
      correctResult(organizer, { matchId: semi.id, version: semiNow.version, scoreA: 1, scoreB: 0, isForfeit: false, gameWinners: null, mvpUserId: null, reason: "Otro cambio" }),
      "errors.correctionBlocked",
    );
  });

  it("una disputa bloquea la validación hasta que se resuelve", async () => {
    const { t, entrants } = await startedTournamentWith(2);
    const [final] = await loadMatches(t.id);
    const captainB = await captainOf(final!.participantBId!, entrants);
    await openDispute(captainB, { matchId: final!.id, reason: "El rival no se presentó a la hora", resultId: null, evidenceFiles: [], evidenceUrl: null });
    let [m] = await db.select().from(matches).where(eq(matches.id, final!.id));
    expect(m?.status).toBe("disputed");
    const manual = { scoreA: 2, scoreB: 0, isForfeit: true, gameWinners: null, mvpUserId: null, notes: null };
    await expectAppError(validateResult(organizer, { matchId: final!.id, version: m!.version, manual }), "errors.matchLocked");

    const dispute = await db.query.disputes.findFirst({ where: (d, { eq }) => eq(d.matchId, final!.id) });
    await resolveDispute(organizer, { disputeId: dispute!.id, outcome: "resolved", resolution: "Se concede la victoria por incomparecencia" });
    [m] = await db.select().from(matches).where(eq(matches.id, final!.id));
    expect(m?.status).not.toBe("disputed");
    await validateResult(organizer, { matchId: final!.id, version: m!.version, manual: { ...manual, scoreA: 0, scoreB: 2 } });
  });

  it("no se edita la configuración de la competición una vez empezada", async () => {
    const { t } = await startedTournamentWith(2);
    const [row] = await db.select().from(tournaments).where(eq(tournaments.id, t.id));
    await expectAppError(
      updateTournament(organizer, t.id, row!.version, tournamentInput({ name: row!.name, format: "league", registrationOpensAt: row!.registrationOpensAt, registrationClosesAt: row!.registrationClosesAt, startsAt: row!.startsAt })),
      "errors.fieldLockedAfterStart",
    );
  });

  it("cancelar avisa a los inscritos", async () => {
    const { t, entrants } = await startedTournamentWith(2);
    await cancelTournament(organizer, t.id, "Problemas con el servidor");
    const notes = await db.select().from(notifications).where(and(eq(notifications.userId, entrants[0]!.captain.id), eq(notifications.type, "tournamentCancelled")));
    expect(notes).toHaveLength(1);
  });
});

describe("liga", () => {
  it("genera todas las jornadas y calcula la clasificación con los resultados confirmados", async () => {
    const { t } = await startedTournamentWith(4, { format: "league", bestOf: 1 });
    const all = await loadMatches(t.id);
    expect(all).toHaveLength(6);

    const manual = (a: number, b: number) => ({ scoreA: a, scoreB: b, isForfeit: false, gameWinners: null, mvpUserId: null, notes: null });
    // El participante A de cada partido gana: la clasificación tiene que reflejarlo.
    for (const m of all.slice(0, 3)) await validateResult(organizer, { matchId: m.id, version: m.version, manual: manual(1, 0) });
    const table = await getLeagueStandings(t.id);
    expect(table.reduce((sum, row) => sum + row.played, 0)).toBe(6);
    expect(table.reduce((sum, row) => sum + row.points, 0)).toBe(9);
    expect(table[0]!.points).toBeGreaterThanOrEqual(table[table.length - 1]!.points);

    for (const m of all.slice(3)) {
      const [fresh] = await db.select().from(matches).where(eq(matches.id, m.id));
      await validateResult(organizer, { matchId: m.id, version: fresh!.version, manual: manual(0, 1) });
    }
    const [row] = await db.select().from(tournaments).where(eq(tournaments.id, t.id));
    expect(row?.status).toBe("completed");
  });
});

async function captainOf(participantId: string, entrants: { captain: CurrentUser; team: { id: string } }[]) {
  const [p] = await db.select().from(tournamentParticipants).where(eq(tournamentParticipants.id, participantId));
  return entrants.find((e) => e.team.id === p!.teamId)!.captain;
}
