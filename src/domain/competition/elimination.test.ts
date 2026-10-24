import { describe, expect, it } from "vitest";
import {
  championOf,
  generateDoubleElimination,
  generateSingleElimination,
  isPlayable,
  planCorrection,
  recordResult,
} from "./elimination";
import { seedOrder } from "./seeding";
import type { EngineMatch, Side } from "./types";

function ids() {
  let n = 0;
  return () => `m${++n}`;
}

function teams(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `T${i + 1}`);
}

/** Juega todos los partidos disputables decidiendo el ganador con `pick` hasta que no quede ninguno. */
function playAll(matches: EngineMatch[], pick: (m: EngineMatch) => Side): EngineMatch[] {
  let current = matches;
  for (let guard = 0; guard < 1000; guard++) {
    const next = current.find(isPlayable);
    if (!next) return current;
    current = recordResult(current, next.id, pick(next)).matches;
  }
  throw new Error("Bucle infinito");
}

/** Gana siempre la semilla más baja (T1 mejor que T2…). */
const favourite = (m: EngineMatch): Side => (Number(m.a!.slice(1)) < Number(m.b!.slice(1)) ? "a" : "b");

describe("seedOrder", () => {
  it("cruza a los mejores cabezas de serie lo más tarde posible", () => {
    expect(seedOrder(2)).toEqual([1, 2]);
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it("rechaza tamaños que no son potencia de dos", () => {
    expect(() => seedOrder(6)).toThrow();
  });
});

describe("eliminación simple", () => {
  it("con potencia de dos no hay BYE y el cuadro tiene n-1 partidos", () => {
    const matches = generateSingleElimination(teams(8), ids());
    expect(matches).toHaveLength(7);
    expect(matches.filter((m) => m.isBye)).toHaveLength(0);
    expect(matches.filter((m) => m.round === 1).every((m) => m.a && m.b)).toBe(true);
  });

  it.each([3, 5, 6, 7, 9, 13, 16, 17, 31])(
    "con %i participantes da los BYE a las mejores semillas y siempre termina con un campeón",
    (n) => {
      const matches = generateSingleElimination(teams(n), ids());
      const size = 2 ** Math.ceil(Math.log2(n));
      const byes = matches.filter((m) => m.isBye);
      expect(byes).toHaveLength(size - n);
      // Ningún partido de primera ronda enfrenta a dos BYE y los BYE caen a las semillas más altas.
      const byeWinners = byes.map((m) => m[m.winner!]).sort((x, y) => Number(x!.slice(1)) - Number(y!.slice(1)));
      expect(byeWinners).toEqual(teams(size - n));
      expect(matches.some((m) => m.status === "void")).toBe(false);

      const final = playAll(matches, favourite);
      expect(championOf(final)).toBe("T1");
      // Cada participante salvo el campeón pierde exactamente una vez.
      const losers = final.filter((m) => m.status === "done" && !m.isBye).map((m) => m[m.winner === "a" ? "b" : "a"]);
      expect(new Set(losers).size).toBe(n - 1);
    },
  );

  it("el ganador avanza al hueco correcto del siguiente partido", () => {
    let matches = generateSingleElimination(teams(4), ids());
    const [semi1, semi2] = matches.filter((m) => m.round === 1);
    matches = recordResult(matches, semi1!.id, "b").matches; // gana T4
    matches = recordResult(matches, semi2!.id, "a").matches; // gana T2
    const final = matches.find((m) => m.round === 2)!;
    expect(final.a).toBe("T4");
    expect(final.b).toBe("T2");
    expect(isPlayable(final)).toBe(true);
  });

  it("no permite registrar dos veces el mismo partido ni uno sin rivales", () => {
    const matches = generateSingleElimination(teams(4), ids());
    const semi = matches.find((m) => m.round === 1)!;
    const after = recordResult(matches, semi.id, "a").matches;
    expect(() => recordResult(after, semi.id, "b")).toThrow();
    const final = after.find((m) => m.round === 2)!;
    expect(() => recordResult(after, final.id, "a")).toThrow();
  });

  it("rechaza menos de dos participantes o repetidos", () => {
    expect(() => generateSingleElimination(["T1"], ids())).toThrow();
    expect(() => generateSingleElimination(["T1", "T1"], ids())).toThrow();
  });

  it("no modifica el array recibido", () => {
    const matches = generateSingleElimination(teams(4), ids());
    const snapshot = JSON.stringify(matches);
    recordResult(matches, matches[0]!.id, "a");
    expect(JSON.stringify(matches)).toBe(snapshot);
  });
});

describe("eliminación doble", () => {
  it("con 8 participantes tiene 7 + 6 partidos y la gran final con reinicio", () => {
    const matches = generateDoubleElimination(teams(8), ids(), { grandFinalReset: true });
    expect(matches.filter((m) => m.bracket === "winners")).toHaveLength(7);
    expect(matches.filter((m) => m.bracket === "losers")).toHaveLength(6);
    expect(matches.filter((m) => m.bracket === "grand_final")).toHaveLength(2);
  });

  it.each([2, 3, 4, 5, 6, 7, 8, 11, 16])("con %i participantes cada uno cae dos veces salvo el campeón", (n) => {
    const matches = generateDoubleElimination(teams(n), ids(), { grandFinalReset: false });
    const final = playAll(matches, favourite);
    expect(championOf(final)).toBe("T1");
    const losses = new Map<string, number>();
    for (const m of final) {
      if (m.status !== "done" || m.isBye) continue;
      const loser = m[m.winner === "a" ? "b" : "a"]!;
      losses.set(loser, (losses.get(loser) ?? 0) + 1);
    }
    for (const team of teams(n).slice(1)) expect(losses.get(team)).toBe(2);
    expect(losses.get("T1") ?? 0).toBe(0);
  });

  it("si gana la gran final quien viene de perdedores, se juega el reinicio", () => {
    let matches = generateDoubleElimination(teams(4), ids(), { grandFinalReset: true });
    // T1 gana todo el cuadro de ganadores; T2 sale del de perdedores.
    matches = playAll(matches, (m) => {
      if (m.bracket === "grand_final") return "b";
      return favourite(m);
    });
    const [gf1, gf2] = matches.filter((m) => m.bracket === "grand_final");
    expect(gf1!.status).toBe("done");
    expect(gf2!.status).toBe("done");
    expect(gf2!.a).toBe("T1");
    expect(gf2!.b).toBe("T2");
    expect(championOf(matches)).toBe("T2");
  });

  it("si gana la gran final el campeón de ganadores, el reinicio queda anulado", () => {
    const matches = playAll(generateDoubleElimination(teams(4), ids(), { grandFinalReset: true }), favourite);
    const reset = matches.find((m) => m.bracket === "grand_final" && m.round === 2)!;
    expect(reset.status).toBe("void");
    expect(championOf(matches)).toBe("T1");
  });

  it("los perdedores de un partido con BYE no existen: el rival en perdedores pasa solo", () => {
    const matches = generateDoubleElimination(teams(3), ids(), { grandFinalReset: false });
    const losersRound1 = matches.find((m) => m.bracket === "losers" && m.round === 1)!;
    expect(losersRound1.aDead).toBe(true);
    const wbFirst = matches.find((m) => m.bracket === "winners" && m.round === 1 && !m.isBye)!;
    const after = recordResult(matches, wbFirst.id, "a").matches;
    const lr1 = after.find((m) => m.id === losersRound1.id)!;
    expect(lr1.status).toBe("done");
    expect(lr1.isBye).toBe(true);
  });
});

describe("corrección de resultados", () => {
  it("cambia el ganador y lo sustituye en el partido siguiente si no se ha jugado", () => {
    let matches = generateSingleElimination(teams(4), ids());
    const semi = matches.find((m) => m.round === 1 && m.position === 0)!;
    matches = recordResult(matches, semi.id, "a").matches;
    const plan = planCorrection(matches, semi.id, "b");
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const final = plan.change.matches.find((m) => m.round === 2)!;
    expect(final.a).toBe("T4");
    expect(plan.change.changedIds).toContain(final.id);
  });

  it("se bloquea si el partido siguiente ya se jugó", () => {
    let matches = generateSingleElimination(teams(4), ids());
    matches = playAll(matches, favourite);
    const semi = matches.find((m) => m.round === 1 && m.position === 0)!;
    const final = matches.find((m) => m.round === 2)!;
    const plan = planCorrection(matches, semi.id, semi.winner === "a" ? "b" : "a");
    expect(plan).toEqual({ ok: false, blockedBy: [final.id] });
  });

  it("se bloquea si el partido siguiente tiene un resultado comunicado o una disputa", () => {
    let matches = generateSingleElimination(teams(4), ids());
    const semis = matches.filter((m) => m.round === 1);
    matches = recordResult(matches, semis[0]!.id, "a").matches;
    matches = recordResult(matches, semis[1]!.id, "a").matches;
    const final = matches.find((m) => m.round === 2)!;
    const plan = planCorrection(matches, semis[0]!.id, "b", (id) => id === final.id);
    expect(plan.ok).toBe(false);
  });

  it("atraviesa los BYE ya resueltos al sustituir al participante", () => {
    // 3 equipos en doble eliminación: el perdedor de T2-T3 pasa solo la primera ronda de perdedores.
    let matches = generateDoubleElimination(teams(3), ids(), { grandFinalReset: false });
    const wb = matches.find((m) => m.bracket === "winners" && m.round === 1 && !m.isBye)!;
    matches = recordResult(matches, wb.id, "a").matches; // T2 gana, T3 cae
    const plan = planCorrection(matches, wb.id, "b");
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const lb2 = plan.change.matches.find((m) => m.bracket === "losers" && m.round === 2)!;
    const wbFinal = plan.change.matches.find((m) => m.bracket === "winners" && m.round === 2)!;
    expect(lb2.a).toBe("T2");
    expect(wbFinal.b).toBe("T3");
  });

  it("corregir la gran final reactiva o anula el reinicio", () => {
    let matches = generateDoubleElimination(teams(4), ids(), { grandFinalReset: true });
    matches = playAll(matches, favourite); // T1 gana la gran final: reinicio anulado
    const gf1 = matches.find((m) => m.bracket === "grand_final" && m.round === 1)!;
    const plan = planCorrection(matches, gf1.id, "b");
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const reset = plan.change.matches.find((m) => m.bracket === "grand_final" && m.round === 2)!;
    expect(reset.status).toBe("open");
    expect(championOf(plan.change.matches)).toBeNull();
  });
});
