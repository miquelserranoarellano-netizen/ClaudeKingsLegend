import { describe, expect, it } from "vitest";
import { checkSeriesScore, forfeitScore } from "./series";
import { computeStandings } from "./standings";
import { isSwissFinished, planSwissRound, type SwissGame, swissQualifiers, swissRecords } from "./swiss";

const teams = (n: number) => Array.from({ length: n }, (_, i) => `t${i + 1}`);

/** Generador pseudoaleatorio con semilla (reproducible). */
function rng(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 2 ** 32;
  };
}

/** Juega una fase suiza completa. `pick` decide el ganador de cada partido. */
function playSwiss(ids: string[], pick: (a: string, b: string, round: number) => "a" | "b") {
  const games: SwissGame[] = [];
  const rounds: { decider: boolean; a: string; b: string; round: number }[][] = [];
  for (let guard = 0; guard < 20; guard++) {
    const plan = planSwissRound(ids, games);
    if (!plan) break;
    rounds.push(plan.pairings.map((p) => ({ ...p, round: plan.round })));
    for (const p of plan.pairings) games.push({ round: plan.round, a: p.a, b: p.b, winner: pick(p.a, p.b, plan.round) });
    if (plan.bye) games.push({ round: plan.round, a: plan.bye, b: null, winner: "a" });
  }
  return { games, rounds, records: swissRecords(ids, games) };
}

function rematches(games: SwissGame[]): number {
  const seen = new Set<string>();
  let count = 0;
  for (const g of games) {
    if (g.b === null) continue;
    const key = [g.a, g.b].sort().join("|");
    if (seen.has(key)) count += 1;
    seen.add(key);
  }
  return count;
}

describe("fase suiza (como los Worlds)", () => {
  it("la primera ronda enfrenta la mitad alta con la baja", () => {
    const plan = planSwissRound(teams(16), [])!;
    expect(plan.round).toBe(1);
    expect(plan.bye).toBeNull();
    expect(plan.pairings.map((p) => [p.a, p.b])).toEqual([
      ["t1", "t9"], ["t2", "t10"], ["t3", "t11"], ["t4", "t12"], ["t5", "t13"], ["t6", "t14"], ["t7", "t15"], ["t8", "t16"],
    ]);
    expect(plan.pairings.every((p) => !p.decider)).toBe(true);
  });

  it("16 equipos: 5 rondas como mucho, 8 clasificados, 8 eliminados y sin repetir rival", () => {
    // Siempre gana la mejor semilla: el caso más «ordenado».
    const { games, rounds, records } = playSwiss(teams(16), (a, b) => (Number(a.slice(1)) < Number(b.slice(1)) ? "a" : "b"));
    expect(rounds.length).toBeLessThanOrEqual(5);
    expect(isSwissFinished(records)).toBe(true);
    expect(records.filter((r) => r.status === "advanced")).toHaveLength(8);
    expect(records.filter((r) => r.status === "eliminated")).toHaveLength(8);
    expect(rematches(games)).toBe(0);
    // Cada ronda empareja a quien lleva el mismo balance.
    for (const round of rounds.slice(1)) {
      for (const p of round) {
        const before = swissRecords(teams(16), games.filter((g) => g.round < p.round));
        const ra = before.find((r) => r.participantId === p.a)!;
        const rb = before.find((r) => r.participantId === p.b)!;
        expect([ra.wins, ra.losses]).toEqual([rb.wins, rb.losses]);
      }
    }
    // Los 3-0 abren la eliminatoria.
    const qualifiers = swissQualifiers(records);
    expect(records.find((r) => r.participantId === qualifiers[0])!.losses).toBe(0);
  });

  it("los partidos decisivos son los que pueden clasificar o eliminar a alguien", () => {
    const { rounds } = playSwiss(teams(16), (a, b) => (Number(a.slice(1)) < Number(b.slice(1)) ? "a" : "b"));
    // Ronda 1 (0-0) y ronda 2 (1-0 / 0-1): nadie se juega nada todavía.
    expect(rounds[0]!.every((p) => !p.decider)).toBe(true);
    expect(rounds[1]!.every((p) => !p.decider)).toBe(true);
    // Ronda 3: 2-0 contra 2-0 y 0-2 contra 0-2 son decisivos; 1-1 contra 1-1, no.
    expect(rounds[2]!.filter((p) => p.decider)).toHaveLength(4);
    expect(rounds[2]!.filter((p) => !p.decider)).toHaveLength(4);
    // Ronda 5 (2-2 contra 2-2): todo decisivo.
    expect(rounds.at(-1)!.every((p) => p.decider)).toBe(true);
  });

  it("con resultados al azar siempre termina, sin rondas de más ni equipos a medias", () => {
    for (const n of [8, 10, 12, 16, 20, 32]) {
      for (let seed = 1; seed <= 60; seed++) {
        const random = rng(seed * 97 + n);
        const { games, rounds, records } = playSwiss(teams(n), () => (random() < 0.5 ? "a" : "b"));
        expect(isSwissFinished(records)).toBe(true);
        expect(rounds.length).toBeLessThanOrEqual(5 + 2);
        for (const r of records) expect(r.wins === 3 || r.losses === 3).toBe(true);
        if (n === 16) {
          expect(rounds.length).toBeLessThanOrEqual(5);
          expect(rematches(games)).toBe(0);
          expect(swissQualifiers(records)).toHaveLength(8);
        }
      }
    }
  });

  it("exige que la ronda anterior esté terminada", () => {
    expect(() => planSwissRound(teams(8), [{ round: 1, a: "t1", b: "t5", winner: null }])).toThrow();
  });

  it("si queda un número impar en juego, descansa el peor clasificado y suma la victoria", () => {
    const ids = teams(3);
    const plan = planSwissRound(ids, [])!;
    expect(plan.bye).toBe("t3");
    const games: SwissGame[] = [
      { round: 1, a: plan.pairings[0]!.a, b: plan.pairings[0]!.b, winner: "a" },
      { round: 1, a: "t3", b: null, winner: "a" },
    ];
    expect(swissRecords(ids, games).find((r) => r.participantId === "t3")!.wins).toBe(1);
  });
});

describe("BO2 con empate (ligas)", () => {
  it("se juegan las dos partidas: 2-0, 0-2 o 1-1", () => {
    expect(checkSeriesScore(2, 2, 0)).toEqual({ ok: true, winner: "a" });
    expect(checkSeriesScore(2, 0, 2)).toEqual({ ok: true, winner: "b" });
    expect(checkSeriesScore(2, 1, 1)).toEqual({ ok: true, winner: null });
    expect(checkSeriesScore(2, 1, 0)).toEqual({ ok: false, reason: "not_finished" });
    expect(checkSeriesScore(2, 2, 1)).toEqual({ ok: false, reason: "too_many_games" });
    expect(forfeitScore(2, "a")).toEqual({ scoreA: 2, scoreB: 0 });
  });

  it("las series impares siguen sin empate", () => {
    expect(checkSeriesScore(3, 1, 1)).toEqual({ ok: false, reason: "not_finished" });
  });

  it("clasificación como en el fútbol: 3 por victoria, 1 por empate, 0 por derrota", () => {
    const table = computeStandings(
      [
        { id: "a", seed: 1 },
        { id: "b", seed: 2 },
        { id: "c", seed: 3 },
      ],
      [
        { a: "a", b: "b", winner: null, scoreA: 1, scoreB: 1, isForfeit: false },
        { a: "a", b: "c", winner: "a", scoreA: 2, scoreB: 0, isForfeit: false },
        { a: "b", b: "c", winner: null, scoreA: 1, scoreB: 1, isForfeit: false },
      ],
      { pointsWin: 3, pointsDraw: 1, pointsLoss: 0, pointsForfeitLoss: 0, tiebreakers: ["head_to_head", "game_difference"] },
    );
    expect(table.map((r) => [r.participantId, r.points, r.wins, r.draws, r.losses])).toEqual([
      ["a", 4, 1, 1, 0],
      ["b", 2, 0, 2, 0],
      ["c", 1, 0, 1, 1],
    ]);
  });
});
