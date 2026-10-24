import { describe, expect, it } from "vitest";
import { generateRoundRobin } from "./round-robin";
import { checkSeriesScore, forfeitScore, gamesMatchScore, winsNeeded } from "./series";
import { computeStandings, type StandingsMatch, type StandingsRules } from "./standings";

const teams = (n: number) => Array.from({ length: n }, (_, i) => `T${i + 1}`);

describe("calendario de liga", () => {
  it.each([2, 3, 4, 5, 6, 7, 8, 10])("con %i participantes cada pareja se enfrenta exactamente una vez", (n) => {
    const rounds = generateRoundRobin(teams(n), 1);
    expect(rounds).toHaveLength(n % 2 === 0 ? n - 1 : n);
    const seen = new Set<string>();
    for (const round of rounds) {
      const playing = round.pairings.flatMap((p) => [p.a, p.b]);
      // Nadie juega dos veces en la misma jornada.
      expect(new Set(playing).size).toBe(playing.length);
      for (const { a, b } of round.pairings) {
        const key = [a, b].sort().join("-");
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
      if (n % 2 === 1) expect(round.resting).not.toBeNull();
    }
    expect(seen.size).toBe((n * (n - 1)) / 2);
  });

  it("la segunda vuelta repite los cruces con los lados invertidos", () => {
    const rounds = generateRoundRobin(teams(4), 2);
    expect(rounds).toHaveLength(6);
    expect(rounds[3]!.number).toBe(4);
    expect(rounds[3]!.pairings).toEqual(rounds[0]!.pairings.map(({ a, b }) => ({ a: b, b: a })));
  });

  it("con número impar cada equipo descansa una vez por vuelta", () => {
    const rounds = generateRoundRobin(teams(5), 1);
    expect(rounds.map((r) => r.resting).sort()).toEqual(teams(5));
  });
});

describe("marcadores de serie", () => {
  it("acepta solo marcadores que cierran la serie", () => {
    expect(winsNeeded(1)).toBe(1);
    expect(winsNeeded(3)).toBe(2);
    expect(winsNeeded(5)).toBe(3);
    expect(checkSeriesScore(1, 1, 0)).toEqual({ ok: true, winner: "a" });
    expect(checkSeriesScore(3, 1, 2)).toEqual({ ok: true, winner: "b" });
    expect(checkSeriesScore(3, 1, 1)).toEqual({ ok: false, reason: "not_finished" });
    expect(checkSeriesScore(3, 3, 0)).toEqual({ ok: false, reason: "too_many_games" });
    expect(checkSeriesScore(3, 2, 2)).toEqual({ ok: false, reason: "too_many_games" });
    expect(checkSeriesScore(2, 1, 0)).toEqual({ ok: false, reason: "invalid" });
    expect(checkSeriesScore(3, -1, 2)).toEqual({ ok: false, reason: "invalid" });
  });

  it("el detalle de partidas tiene que cuadrar con el marcador", () => {
    expect(gamesMatchScore(3, 2, 1, ["a", "b", "a"])).toBe(true);
    expect(gamesMatchScore(3, 2, 1, ["a", "a", "b"])).toBe(false); // la serie acabó en la segunda
    expect(gamesMatchScore(3, 2, 0, ["a", "b"])).toBe(false);
    expect(gamesMatchScore(5, 3, 2, ["b", "b", "a", "a", "a"])).toBe(true);
  });

  it("una incomparecencia cuenta como la victoria mínima", () => {
    expect(forfeitScore(3, "b")).toEqual({ scoreA: 0, scoreB: 2 });
  });
});

describe("clasificación", () => {
  const rules: StandingsRules = {
    pointsWin: 3,
    pointsLoss: 0,
    pointsForfeitLoss: -1,
    tiebreakers: ["head_to_head", "game_difference", "games_won"],
  };
  const participants = teams(4).map((id, i) => ({ id, seed: i + 1 }));
  const m = (a: string, b: string, scoreA: number, scoreB: number, isForfeit = false): StandingsMatch => ({
    a,
    b,
    scoreA,
    scoreB,
    winner: scoreA > scoreB ? "a" : "b",
    isForfeit,
  });

  it("sin partidos, todos a cero y ordenados por semilla", () => {
    const table = computeStandings(participants, [], rules);
    expect(table.map((r) => r.participantId)).toEqual(teams(4));
    expect(table.every((r) => r.points === 0 && r.decidedBySeed)).toBe(true);
  });

  it("suma puntos, series y partidas", () => {
    const table = computeStandings(participants, [m("T1", "T2", 2, 1), m("T3", "T4", 0, 2, true)], rules);
    const t1 = table.find((r) => r.participantId === "T1")!;
    const t3 = table.find((r) => r.participantId === "T3")!;
    expect(t1).toMatchObject({ played: 1, wins: 1, losses: 0, gamesWon: 2, gamesLost: 1, gameDifference: 1, points: 3 });
    expect(t3).toMatchObject({ played: 1, losses: 1, forfeitLosses: 1, points: -1 });
    expect(table[table.length - 1]!.participantId).toBe("T3");
  });

  it("el enfrentamiento directo deshace un empate a puntos", () => {
    // T2 y T3 empatan a 3 puntos; T3 ganó a T2. T3 tiene peor diferencia de partidas, pero va delante.
    const matches = [m("T2", "T3", 0, 1), m("T2", "T4", 2, 0), m("T3", "T1", 0, 2), m("T1", "T4", 2, 0)];
    const table = computeStandings(participants, matches, rules);
    expect(table.map((r) => r.participantId)).toEqual(["T1", "T3", "T2", "T4"]);
  });

  it("si el directo no resuelve (triple empate circular), pasa a la diferencia de partidas", () => {
    const three = teams(3).map((id, i) => ({ id, seed: i + 1 }));
    const matches = [m("T1", "T2", 3, 2), m("T2", "T3", 3, 0), m("T3", "T1", 3, 1)];
    const table = computeStandings(three, matches, { ...rules, tiebreakers: ["head_to_head", "game_difference"] });
    // Diferencias: T1 -1, T2 +2, T3 -1 → T2 primero. T1 y T3 siguen empatados y se les vuelve a aplicar
    // el enfrentamiento directo, ahora solo entre ellos: T3 ganó a T1.
    expect(table.map((r) => r.participantId)).toEqual(["T2", "T3", "T1"]);
    expect(table.some((r) => r.decidedBySeed)).toBe(false);
  });

  it("marca los puestos decididos por semilla cuando ningún criterio resuelve", () => {
    const two = teams(2).map((id, i) => ({ id, seed: 2 - i }));
    const table = computeStandings(two, [], { ...rules, tiebreakers: [] });
    expect(table.map((r) => r.participantId)).toEqual(["T2", "T1"]);
    expect(table.every((r) => r.decidedBySeed)).toBe(true);
  });

  it("respeta el orden configurado de los desempates", () => {
    // T1 y T2 empatan a 3 puntos; T1 ganó el directo, T2 tiene más diferencia de partidas.
    const matches = [m("T1", "T2", 1, 0), m("T2", "T3", 3, 0), m("T4", "T1", 1, 0), m("T4", "T3", 1, 0)];
    const h2hFirst = computeStandings(participants, matches, { ...rules, tiebreakers: ["head_to_head", "game_difference"] });
    const diffFirst = computeStandings(participants, matches, { ...rules, tiebreakers: ["game_difference", "head_to_head"] });
    const top = (t: typeof h2hFirst) => t.filter((r) => r.participantId === "T1" || r.participantId === "T2").map((r) => r.participantId);
    expect(top(h2hFirst)).toEqual(["T1", "T2"]);
    expect(top(diffFirst)).toEqual(["T2", "T1"]);
  });
});
