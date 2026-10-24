import { describe, expect, it } from "vitest";
import {
  type Actor,
  canAccessAdminArea,
  canCreateTournament,
  canManagePlatform,
  canManageTeam,
  canManageTournament,
  canViewTournament,
  reportingSide,
} from "./permissions";
import { canTransition, phaseCategory, scheduleProblems, tournamentPhase } from "./tournament/phase";
import {
  initialRegistrationStatus,
  soloRegistrationBlockers,
  startBlockers,
  teamRegistrationBlockers,
  type TeamRegistrationFacts,
} from "./tournament/registration";

const user: Actor = { id: "u1", role: "user", suspended: false };
const organizer: Actor = { id: "o1", role: "organizer", suspended: false };
const otherOrganizer: Actor = { id: "o2", role: "organizer", suspended: false };
const admin: Actor = { id: "a1", role: "admin", suspended: false };
const suspendedAdmin: Actor = { ...admin, suspended: true };

describe("permisos", () => {
  const tournament = { organizerId: "o1", visibility: "public" as const, status: "published" };

  it("solo organizadores y administradores crean torneos y entran en /admin", () => {
    expect(canCreateTournament(null)).toBe(false);
    expect(canCreateTournament(user)).toBe(false);
    expect(canCreateTournament(organizer)).toBe(true);
    expect(canCreateTournament(admin)).toBe(true);
    expect(canAccessAdminArea(user)).toBe(false);
    expect(canAccessAdminArea(suspendedAdmin)).toBe(false);
  });

  it("un organizador gestiona sus torneos, no los de otros", () => {
    expect(canManageTournament(organizer, tournament)).toBe(true);
    expect(canManageTournament(otherOrganizer, tournament)).toBe(false);
    expect(canManageTournament(admin, tournament)).toBe(true);
    expect(canManageTournament(user, tournament)).toBe(false);
    // Si le retiran el rol de organizador, deja de gestionar incluso los suyos.
    expect(canManageTournament({ ...organizer, role: "user" }, tournament)).toBe(false);
  });

  it("los borradores y los torneos privados no son visibles para cualquiera", () => {
    const none = { isParticipant: false, hasAccessCode: false };
    expect(canViewTournament(null, tournament, none)).toBe(true);
    expect(canViewTournament(null, { ...tournament, status: "draft" }, none)).toBe(false);
    expect(canViewTournament(organizer, { ...tournament, status: "draft" }, none)).toBe(true);
    const priv = { ...tournament, visibility: "private" as const };
    expect(canViewTournament(user, priv, none)).toBe(false);
    expect(canViewTournament(null, priv, { isParticipant: false, hasAccessCode: true })).toBe(true);
    expect(canViewTournament(user, priv, { isParticipant: true, hasAccessCode: false })).toBe(true);
    expect(canViewTournament(admin, priv, none)).toBe(true);
  });

  it("solo el capitán (o un administrador) gestiona un equipo activo", () => {
    const team = { captainId: "u1", status: "active" };
    expect(canManageTeam(user, team)).toBe(true);
    expect(canManageTeam(organizer, team)).toBe(false);
    expect(canManageTeam(admin, team)).toBe(true);
    expect(canManageTeam(user, { ...team, status: "disbanded" })).toBe(false);
    expect(canManageTeam({ ...user, suspended: true }, team)).toBe(false);
  });

  it("solo los representantes de cada bando comunican resultados", () => {
    const match = { a: { representativeIds: ["u1"] }, b: { representativeIds: ["u2"] } };
    expect(reportingSide(user, match)).toBe("a");
    expect(reportingSide({ ...user, id: "u2" }, match)).toBe("b");
    expect(reportingSide(organizer, match)).toBeNull();
    expect(reportingSide(null, match)).toBeNull();
  });

  it("la configuración de la plataforma es solo para administradores", () => {
    expect(canManagePlatform(organizer)).toBe(false);
    expect(canManagePlatform(admin)).toBe(true);
  });
});

describe("fase del torneo", () => {
  const base = {
    status: "published" as const,
    registrationOpensAt: new Date("2026-11-01T10:00:00Z"),
    registrationClosesAt: new Date("2026-11-10T10:00:00Z"),
  };

  it("se deriva de las fechas mientras está publicado", () => {
    expect(tournamentPhase(base, new Date("2026-10-30T00:00:00Z"))).toBe("registration_upcoming");
    expect(tournamentPhase(base, new Date("2026-11-05T00:00:00Z"))).toBe("registration_open");
    expect(tournamentPhase(base, new Date("2026-11-10T10:00:00Z"))).toBe("registration_closed");
    expect(tournamentPhase({ ...base, status: "in_progress" }, new Date())).toBe("in_progress");
    expect(phaseCategory("registration_closed")).toBe("upcoming");
  });

  it("valida fechas y plazas", () => {
    const ok = {
      registrationOpensAt: new Date("2026-11-01"),
      registrationClosesAt: new Date("2026-11-10"),
      startsAt: new Date("2026-11-12"),
      endsAt: null,
      minParticipants: 4,
      maxParticipants: 16,
    };
    expect(scheduleProblems(ok)).toEqual([]);
    expect(scheduleProblems({ ...ok, startsAt: new Date("2026-11-05") })).toContain("start_before_close");
    expect(scheduleProblems({ ...ok, minParticipants: 20 })).toContain("participants_order");
    expect(scheduleProblems({ ...ok, minParticipants: 1 })).toContain("participants_range");
  });

  it("solo permite transiciones con sentido", () => {
    expect(canTransition("draft", "published")).toBe(true);
    expect(canTransition("draft", "completed")).toBe(false);
    expect(canTransition("completed", "in_progress")).toBe(false);
    expect(canTransition("cancelled", "published")).toBe(false);
  });
});

describe("inscripciones", () => {
  const player = (id: string, extra: Partial<TeamRegistrationFacts["roster"][number]> = {}) => ({
    userId: id,
    isSubstitute: false,
    isTeamMember: true,
    hasRiotId: true,
    suspended: false,
    registeredElsewhere: false,
    ...extra,
  });
  const facts: TeamRegistrationFacts = {
    phase: "registration_open",
    byOrganizer: false,
    alreadyRegistered: false,
    actorIsCaptain: true,
    teamActive: true,
    teamSize: 5,
    maxSubstitutes: 1,
    requireRiotId: true,
    roster: ["p1", "p2", "p3", "p4", "p5"].map((id) => player(id)),
  };

  it("acepta una plantilla válida", () => {
    expect(teamRegistrationBlockers(facts)).toEqual([]);
  });

  it("detecta plantillas cortas, largas, ajenas o con jugadores ya inscritos", () => {
    expect(teamRegistrationBlockers({ ...facts, roster: facts.roster.slice(0, 4) })).toContain("roster_too_small");
    const withSub = [...facts.roster, player("p6", { isSubstitute: true })];
    expect(teamRegistrationBlockers({ ...facts, roster: withSub })).toEqual([]);
    const twoSubs = [...withSub, player("p7", { isSubstitute: true })];
    expect(teamRegistrationBlockers({ ...facts, roster: twoSubs })).toContain("roster_too_large");
    const sixStarters = [...facts.roster, player("p6")];
    expect(teamRegistrationBlockers({ ...facts, roster: sixStarters })).toContain("roster_too_large");
    const fourAndSub = [...facts.roster.slice(0, 4), player("p6", { isSubstitute: true })];
    expect(teamRegistrationBlockers({ ...facts, roster: fourAndSub })).toContain("roster_too_small");
    const outsider = [...facts.roster.slice(0, 4), player("x", { isTeamMember: false })];
    expect(teamRegistrationBlockers({ ...facts, roster: outsider })).toContain("not_team_member");
    const twice = [...facts.roster.slice(0, 4), player("p5", { registeredElsewhere: true })];
    expect(teamRegistrationBlockers({ ...facts, roster: twice })).toContain("player_already_registered");
    const noRiot = [...facts.roster.slice(0, 4), player("p5", { hasRiotId: false })];
    expect(teamRegistrationBlockers({ ...facts, roster: noRiot })).toContain("missing_riot_id");
    // Un jugador repetido en la lista no cuenta dos veces.
    const repeated = [...facts.roster.slice(0, 4), player("p1")];
    expect(teamRegistrationBlockers({ ...facts, roster: repeated })).toContain("roster_too_small");
  });

  it("impide inscribirse dos veces, fuera de plazo o sin ser capitán", () => {
    expect(teamRegistrationBlockers({ ...facts, alreadyRegistered: true })).toContain("already_registered");
    expect(teamRegistrationBlockers({ ...facts, phase: "registration_closed" })).toContain("registration_not_open");
    expect(teamRegistrationBlockers({ ...facts, phase: "registration_closed", byOrganizer: true })).toEqual([]);
    expect(teamRegistrationBlockers({ ...facts, actorIsCaptain: false })).toContain("not_captain");
  });

  it("inscripción individual", () => {
    const solo = { phase: "registration_open" as const, byOrganizer: false, alreadyRegistered: false, requireRiotId: false, hasRiotId: false, suspended: false };
    expect(soloRegistrationBlockers(solo)).toEqual([]);
    expect(soloRegistrationBlockers({ ...solo, alreadyRegistered: true })).toEqual(["already_registered"]);
  });

  it("decide el estado inicial según plazas, modo de aprobación y lista de espera", () => {
    const base = { approvalMode: "automatic" as const, approvedCount: 3, maxParticipants: 4, waitlistEnabled: true };
    expect(initialRegistrationStatus(base)).toBe("approved");
    expect(initialRegistrationStatus({ ...base, approvalMode: "manual" })).toBe("pending");
    expect(initialRegistrationStatus({ ...base, approvedCount: 4 })).toBe("waitlisted");
    expect(initialRegistrationStatus({ ...base, approvedCount: 4, waitlistEnabled: false })).toBe("tournament_full");
  });

  it("no deja empezar sin el mínimo de participantes ni con inscripciones abiertas", () => {
    const base = { phase: "registration_closed" as const, approvedCount: 4, minParticipants: 4, maxParticipants: 8 };
    expect(startBlockers(base)).toEqual([]);
    expect(startBlockers({ ...base, approvedCount: 3 })).toEqual(["too_few_participants"]);
    expect(startBlockers({ ...base, phase: "registration_open" })).toEqual(["registration_still_open"]);
    expect(startBlockers({ ...base, phase: "in_progress" })).toEqual(["not_published"]);
  });
});
