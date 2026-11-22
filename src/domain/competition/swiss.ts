import type { Side } from "./types";

/**
 * Fase suiza como la de los Worlds de League of Legends:
 * - Nadie queda eliminado por una derrota: se juega hasta sumar `winsToAdvance` victorias (clasificado) o
 *   `lossesToEliminate` derrotas (eliminado). Con 3 y 3 son, como mucho, 5 rondas.
 * - En cada ronda se enfrentan equipos con el mismo balance (2-0 contra 2-0, 1-1 contra 1-1…), sin repetir
 *   rival si hay forma de evitarlo. Dentro de cada grupo, el mejor sembrado contra el peor.
 * - Los partidos en los que alguien puede clasificarse o quedar eliminado son «decisivos» (en los Worlds se
 *   juegan al mejor de 3; el resto, al mejor de 1).
 * - La primera ronda enfrenta la mitad alta de las semillas con la baja (1 contra n/2+1, 2 contra n/2+2…).
 * - Si en una ronda queda un número impar de equipos en juego, el peor clasificado que no haya descansado
 *   recibe un BYE, que cuenta como victoria. Con un número par de equipos y 3/3 no ocurre nunca.
 *
 * Todo es puro: recibe los partidos y devuelve la siguiente ronda o el balance de cada equipo.
 */

export interface SwissConfig {
  winsToAdvance: number;
  lossesToEliminate: number;
}

/** La de los Worlds: 3 victorias para pasar, 3 derrotas para quedar fuera. */
export const WORLDS_SWISS: SwissConfig = { winsToAdvance: 3, lossesToEliminate: 3 };

/** Un partido de la fase suiza. `b === null` es un BYE (gana `a`). `winner === null`: aún sin resultado. */
export interface SwissGame {
  round: number;
  a: string;
  b: string | null;
  winner: Side | null;
}

export type SwissStatus = "active" | "advanced" | "eliminated";

export interface SwissRecord {
  participantId: string;
  seed: number;
  wins: number;
  losses: number;
  status: SwissStatus;
  opponents: string[];
  byes: number;
  /** Suma de las victorias de los rivales (fuerza del calendario): desempata el orden final. */
  buchholz: number;
}

export interface SwissPairing {
  a: string;
  b: string;
  /** Alguno de los dos puede clasificarse o quedar eliminado en este partido. */
  decider: boolean;
}

export interface SwissRoundPlan {
  round: number;
  pairings: SwissPairing[];
  /** Quien descansa con victoria (solo si queda un número impar en juego). */
  bye: string | null;
}

/** Orden de la tabla: victorias, menos derrotas, fuerza del calendario y, al final, la semilla. */
export function compareSwiss(x: SwissRecord, y: SwissRecord): number {
  return y.wins - x.wins || x.losses - y.losses || y.buchholz - x.buchholz || x.seed - y.seed;
}

/** Balance de cada participante a partir de los partidos con resultado (y los BYE). Ordenado como la tabla. */
export function swissRecords(participantsBySeed: string[], games: SwissGame[], config: SwissConfig = WORLDS_SWISS): SwissRecord[] {
  const records = new Map<string, SwissRecord>(
    participantsBySeed.map((id, index) => [
      id,
      { participantId: id, seed: index + 1, wins: 0, losses: 0, status: "active", opponents: [], byes: 0, buchholz: 0 },
    ]),
  );
  const get = (id: string) => {
    const r = records.get(id);
    if (!r) throw new Error(`Participante desconocido en la fase suiza: ${id}`);
    return r;
  };
  for (const g of games) {
    if (g.b === null) {
      const r = get(g.a);
      r.wins += 1;
      r.byes += 1;
      continue;
    }
    if (g.winner === null) continue;
    const a = get(g.a);
    const b = get(g.b);
    a.opponents.push(b.participantId);
    b.opponents.push(a.participantId);
    const [won, lost] = g.winner === "a" ? [a, b] : [b, a];
    won.wins += 1;
    lost.losses += 1;
  }
  for (const r of records.values()) {
    r.status = r.wins >= config.winsToAdvance ? "advanced" : r.losses >= config.lossesToEliminate ? "eliminated" : "active";
    r.buchholz = r.opponents.reduce((sum, id) => sum + get(id).wins, 0);
  }
  return [...records.values()].sort(compareSwiss);
}

export function isSwissFinished(records: SwissRecord[]): boolean {
  return records.every((r) => r.status !== "active");
}

/** Clasificados para la eliminatoria, en orden de semilla (los 3-0 primero, luego 3-1, 3-2). */
export function swissQualifiers(records: SwissRecord[]): string[] {
  return records.filter((r) => r.status === "advanced").sort(compareSwiss).map((r) => r.participantId);
}

export function isDecider(x: SwissRecord, y: SwissRecord, config: SwissConfig = WORLDS_SWISS): boolean {
  return [x, y].some((r) => r.wins === config.winsToAdvance - 1 || r.losses === config.lossesToEliminate - 1);
}

/**
 * Siguiente ronda de la fase suiza, o `null` si ya no queda nadie en juego. Exige que la ronda anterior
 * esté terminada.
 */
export function planSwissRound(participantsBySeed: string[], games: SwissGame[], config: SwissConfig = WORLDS_SWISS): SwissRoundPlan | null {
  if (participantsBySeed.length < 2) throw new Error("Hacen falta al menos dos participantes.");
  if (new Set(participantsBySeed).size !== participantsBySeed.length) throw new Error("Hay participantes repetidos.");
  if (games.some((g) => g.b !== null && g.winner === null)) throw new Error("La ronda actual todavía no ha terminado.");

  const records = swissRecords(participantsBySeed, games, config);
  // Para emparejar se usa el orden de semilla dentro de cada balance (estable y predecible).
  const active = records
    .filter((r) => r.status === "active")
    .sort((x, y) => y.wins - x.wins || x.losses - y.losses || x.seed - y.seed);
  if (active.length === 0) return null;
  const round = games.reduce((max, g) => Math.max(max, g.round), 0) + 1;

  let bye: string | null = null;
  if (active.length % 2 === 1) {
    // El peor clasificado entre los que menos han descansado.
    const fewest = Math.min(...active.map((r) => r.byes));
    const chosen = [...active].reverse().find((r) => r.byes === fewest)!;
    bye = chosen.participantId;
    active.splice(active.indexOf(chosen), 1);
  }
  if (active.length === 0) return { round, pairings: [], bye };

  const played = new Set<string>();
  for (const r of active) for (const o of r.opponents) played.add(key(r.participantId, o));
  const canPlay = (x: SwissRecord, y: SwissRecord) => !played.has(key(x.participantId, y.participantId));

  let pairs: [SwissRecord, SwissRecord][];
  if (games.length === 0) {
    // Primera ronda: mitad alta contra mitad baja.
    const half = active.length / 2;
    pairs = active.slice(0, half).map((r, i) => [r, active[i + half]!]);
  } else {
    pairs = pairByGroups(active, canPlay) ?? pairByGroups(active, () => true)!;
  }

  return {
    round,
    bye,
    pairings: pairs.map(([x, y]) => ({ a: x.participantId, b: y.participantId, decider: isDecider(x, y, config) })),
  };
}

function key(x: string, y: string): string {
  return x < y ? `${x}|${y}` : `${y}|${x}`;
}

/**
 * Empareja por grupos de balance, de arriba abajo. Si un grupo es impar, su último baja al grupo siguiente.
 * Si un grupo no puede emparejarse sin repetir rival, se prueba a bajar a otro de sus miembros.
 */
function pairByGroups(active: SwissRecord[], canPlay: (x: SwissRecord, y: SwissRecord) => boolean): [SwissRecord, SwissRecord][] | null {
  const groups: SwissRecord[][] = [];
  for (const r of active) {
    const last = groups.at(-1);
    if (last && last[0]!.wins === r.wins && last[0]!.losses === r.losses) last.push(r);
    else groups.push([r]);
  }

  const solve = (index: number, carry: SwissRecord[]): [SwissRecord, SwissRecord][] | null => {
    if (index === groups.length) return carry.length === 0 ? [] : null;
    const pool = [...carry, ...groups[index]!];
    // Candidatos a bajar al grupo siguiente: ninguno si el grupo es par; si es impar, del peor al mejor.
    const floaters = pool.length % 2 === 0 ? [null] : [...pool].reverse();
    for (const floater of floaters) {
      const rest = floater ? pool.filter((r) => r !== floater) : pool;
      const pairs = pairPool(rest, canPlay);
      if (!pairs) continue;
      const tail = solve(index + 1, floater ? [floater] : []);
      if (tail) return [...pairs, ...tail];
    }
    return null;
  };
  return solve(0, []);
}

/** Empareja un grupo: el primero contra el último posible, con vuelta atrás si alguien se queda sin rival. */
function pairPool(pool: SwissRecord[], canPlay: (x: SwissRecord, y: SwissRecord) => boolean): [SwissRecord, SwissRecord][] | null {
  if (pool.length === 0) return [];
  const [first, ...rest] = pool as [SwissRecord, ...SwissRecord[]];
  for (let i = rest.length - 1; i >= 0; i--) {
    const rival = rest[i]!;
    if (!canPlay(first, rival)) continue;
    const others = pairPool([...rest.slice(0, i), ...rest.slice(i + 1)], canPlay);
    if (others) return [[first, rival], ...others];
  }
  return null;
}
