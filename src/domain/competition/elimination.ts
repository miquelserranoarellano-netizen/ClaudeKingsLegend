import { bracketSize, log2, seedOrder } from "./seeding";
import { type EngineMatch, type IdFactory, otherSide, type Side, type SlotRef } from "./types";

/**
 * Motor de eliminación simple y doble.
 *
 * Se genera el cuadro completo desde el principio (todas las rondas, con los huecos vacíos enlazados a su
 * origen). Así los enfrentamientos posteriores existen desde el primer día, se pueden programar y nunca
 * se «recalculan»: un resultado solo rellena huecos que estaban vacíos.
 *
 * BYE: si el número de participantes no es potencia de dos, las semillas que faltan son huecos «muertos».
 * Un partido con un hueco muerto se resuelve solo (pasa el otro) en cuanto el otro hueco se llena; un
 * partido con los dos huecos muertos queda anulado y su ganador también es un hueco muerto.
 */

export interface DoubleEliminationOptions {
  /** Si el campeón del cuadro de perdedores gana la gran final, se juega una segunda serie. */
  grandFinalReset: boolean;
}

function blankMatch(id: string, bracket: EngineMatch["bracket"], round: number, position: number): EngineMatch {
  return {
    id,
    bracket,
    round,
    position,
    a: null,
    b: null,
    aDead: false,
    bDead: false,
    status: "open",
    winner: null,
    isBye: false,
    next: null,
    loserNext: null,
  };
}

function slotFor(position: number): Side {
  return position % 2 === 0 ? "a" : "b";
}

/** Crea las rondas del cuadro de ganadores y coloca a los participantes según su semilla. */
function buildWinnersBracket(participantsBySeed: string[], newId: IdFactory): EngineMatch[][] {
  const n = participantsBySeed.length;
  if (n < 2) throw new Error("Hacen falta al menos dos participantes.");
  if (new Set(participantsBySeed).size !== n) throw new Error("Hay participantes repetidos.");

  const size = bracketSize(n);
  const rounds = log2(size);
  const order = seedOrder(size);
  const byRound: EngineMatch[][] = [];

  for (let r = 1; r <= rounds; r++) {
    const count = size / 2 ** r;
    byRound.push(Array.from({ length: count }, (_, p) => blankMatch(newId(), "winners", r, p)));
  }

  const first = byRound[0]!;
  first.forEach((match, p) => {
    const seedA = order[2 * p]!;
    const seedB = order[2 * p + 1]!;
    match.a = seedA <= n ? participantsBySeed[seedA - 1]! : null;
    match.aDead = seedA > n;
    match.b = seedB <= n ? participantsBySeed[seedB - 1]! : null;
    match.bDead = seedB > n;
  });

  for (let r = 0; r < byRound.length - 1; r++) {
    const current = byRound[r]!;
    const next = byRound[r + 1]!;
    current.forEach((match, p) => {
      match.next = { matchId: next[Math.floor(p / 2)]!.id, slot: slotFor(p) };
    });
  }
  return byRound;
}

export function generateSingleElimination(participantsBySeed: string[], newId: IdFactory): EngineMatch[] {
  const matches = buildWinnersBracket(participantsBySeed, newId).flat();
  return settle(matches);
}

/**
 * Doble eliminación con cuadro de perdedores estándar: para un cuadro de 2^k plazas hay 2(k-1) rondas de
 * perdedores. Las rondas impares enfrentan entre sí a los supervivientes; las pares reciben a los que caen
 * del cuadro de ganadores. El orden de caída se invierte en rondas alternas para evitar revanchas
 * inmediatas.
 */
export function generateDoubleElimination(
  participantsBySeed: string[],
  newId: IdFactory,
  options: DoubleEliminationOptions,
): EngineMatch[] {
  const winners = buildWinnersBracket(participantsBySeed, newId);
  const k = winners.length;
  const size = 2 ** k;

  const losers: EngineMatch[][] = [];
  for (let j = 1; j <= 2 * (k - 1); j++) {
    const count = size / 2 ** (Math.ceil(j / 2) + 1);
    losers.push(Array.from({ length: count }, (_, p) => blankMatch(newId(), "losers", j, p)));
  }

  const grandFinal = blankMatch(newId(), "grand_final", 1, 0);
  const reset = options.grandFinalReset ? blankMatch(newId(), "grand_final", 2, 0) : null;

  // Enlaces del cuadro de perdedores entre sí y con la gran final.
  losers.forEach((round, index) => {
    const j = index + 1;
    const isLast = index === losers.length - 1;
    round.forEach((match, p) => {
      if (isLast) {
        match.next = { matchId: grandFinal.id, slot: "b" };
      } else if (j % 2 === 1) {
        // Ronda impar → la siguiente ronda (par) tiene los mismos partidos; el superviviente va al hueco A.
        match.next = { matchId: losers[index + 1]![p]!.id, slot: "a" };
      } else {
        match.next = { matchId: losers[index + 1]![Math.floor(p / 2)]!.id, slot: slotFor(p) };
      }
    });
  });

  // Caídas desde el cuadro de ganadores.
  winners.forEach((round, index) => {
    const r = index + 1;
    round.forEach((match, p) => {
      if (k === 1) {
        // Dos participantes: no hay cuadro de perdedores; el perdedor va directo a la gran final.
        match.loserNext = { matchId: grandFinal.id, slot: "b" };
      } else if (r === 1) {
        match.loserNext = { matchId: losers[0]![Math.floor(p / 2)]!.id, slot: slotFor(p) };
      } else {
        const target = losers[2 * (r - 1) - 1]!;
        const count = target.length;
        const q = r % 2 === 0 ? count - 1 - p : (p + Math.floor(count / 2)) % count;
        match.loserNext = { matchId: target[q]!.id, slot: "b" };
      }
    });
  });

  // El campeón del cuadro de ganadores va al hueco A de la gran final.
  const winnersFinal = winners[k - 1]![0]!;
  winnersFinal.next = { matchId: grandFinal.id, slot: "a" };

  const all = [...winners.flat(), ...losers.flat(), grandFinal, ...(reset ? [reset] : [])];
  return settle(all);
}

// ---------------------------------------------------------------------------------------------------------
// Avance
// ---------------------------------------------------------------------------------------------------------

function cloneAll(matches: EngineMatch[]): Map<string, EngineMatch> {
  return new Map(
    matches.map((m) => [
      m.id,
      { ...m, next: m.next ? { ...m.next } : null, loserNext: m.loserNext ? { ...m.loserNext } : null },
    ]),
  );
}

function get(map: Map<string, EngineMatch>, id: string): EngineMatch {
  const match = map.get(id);
  if (!match) throw new Error(`Partido desconocido: ${id}`);
  return match;
}

function place(map: Map<string, EngineMatch>, ref: SlotRef | null, participant: string): void {
  if (!ref) return;
  const target = get(map, ref.matchId);
  if (target[ref.slot] !== null || (ref.slot === "a" ? target.aDead : target.bDead)) {
    throw new Error(`El hueco ${ref.slot} del partido ${target.id} ya está ocupado.`);
  }
  target[ref.slot] = participant;
}

function kill(map: Map<string, EngineMatch>, ref: SlotRef | null): void {
  if (!ref) return;
  const target = get(map, ref.matchId);
  if (target[ref.slot] !== null) throw new Error(`El hueco ${ref.slot} del partido ${target.id} no está vacío.`);
  if (ref.slot === "a") target.aDead = true;
  else target.bDead = true;
}

const BRACKET_ORDER: Record<EngineMatch["bracket"], number> = { winners: 0, losers: 1, grand_final: 2, league: 3 };

function sorted(map: Map<string, EngineMatch>): EngineMatch[] {
  return [...map.values()].sort(
    (x, y) => BRACKET_ORDER[x.bracket] - BRACKET_ORDER[y.bracket] || x.round - y.round || x.position - y.position,
  );
}

function findReset(map: Map<string, EngineMatch>): EngineMatch | undefined {
  return [...map.values()].find((m) => m.bracket === "grand_final" && m.round === 2);
}

/** Resuelve todo lo que se resuelve solo (BYE y partidos anulados) hasta que no cambie nada. */
function settleMap(map: Map<string, EngineMatch>): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (const m of sorted(map)) {
      if (m.status !== "open") continue;
      if (m.aDead && m.bDead) {
        m.status = "void";
        kill(map, m.next);
        kill(map, m.loserNext);
        changed = true;
      } else if (m.aDead && m.b !== null) {
        finishBye(map, m, "b");
        changed = true;
      } else if (m.bDead && m.a !== null) {
        finishBye(map, m, "a");
        changed = true;
      }
    }
  }
}

function finishBye(map: Map<string, EngineMatch>, m: EngineMatch, side: Side): void {
  m.status = "done";
  m.winner = side;
  m.isBye = true;
  place(map, m.next, m[side]!);
  kill(map, m.loserNext);
}

export function settle(matches: EngineMatch[]): EngineMatch[] {
  const map = cloneAll(matches);
  settleMap(map);
  return sorted(map);
}

export interface EngineChange {
  matches: EngineMatch[];
  /** Partidos que han cambiado (incluido el propio). */
  changedIds: string[];
}

function diff(before: EngineMatch[], after: Map<string, EngineMatch>): string[] {
  const changed: string[] = [];
  for (const old of before) {
    if (JSON.stringify(old) !== JSON.stringify(after.get(old.id))) changed.push(old.id);
  }
  return changed;
}

/** Registra el ganador de un partido y hace avanzar a ganador y perdedor. */
export function recordResult(matches: EngineMatch[], matchId: string, winner: Side): EngineChange {
  const map = cloneAll(matches);
  const m = get(map, matchId);
  if (m.status !== "open") throw new Error("El partido ya tiene resultado o está anulado.");
  if (m.a === null || m.b === null) throw new Error("El partido todavía no tiene a sus dos participantes.");

  m.status = "done";
  m.winner = winner;
  m.isBye = false;
  const winnerId = m[winner]!;
  const loserId = m[otherSide(winner)]!;

  if (m.bracket === "grand_final" && m.round === 1) {
    const reset = findReset(map);
    if (reset) applyResetDecision(m, reset);
  } else {
    place(map, m.next, winnerId);
    if (m.loserNext) place(map, m.loserNext, loserId);
  }

  settleMap(map);
  return { matches: sorted(map), changedIds: diff(matches, map) };
}

/** Tras la primera gran final: el reinicio solo se juega si gana quien viene del cuadro de perdedores. */
function applyResetDecision(grandFinal: EngineMatch, reset: EngineMatch): void {
  if (grandFinal.winner === "a") {
    reset.a = null;
    reset.b = null;
    reset.aDead = true;
    reset.bDead = true;
    reset.status = "void";
  } else {
    reset.a = grandFinal.a;
    reset.b = grandFinal.b;
    reset.aDead = false;
    reset.bDead = false;
    reset.status = "open";
  }
  reset.winner = null;
  reset.isBye = false;
}

export type CorrectionPlan =
  | { ok: true; change: EngineChange }
  | {
      ok: false;
      /** Partidos posteriores que ya se han jugado (o tienen un resultado en curso) y lo impiden. */
      blockedBy: string[];
    };

/**
 * Corrige el ganador de un partido ya resuelto. Solo es posible si los partidos a los que fueron el
 * ganador y el perdedor no se han jugado todavía (ni tienen un resultado comunicado o una disputa:
 * `isLocked`). Así nunca se corrompe un enfrentamiento posterior: si ya se jugó, primero hay que
 * corregir ese.
 */
export function planCorrection(
  matches: EngineMatch[],
  matchId: string,
  newWinner: Side,
  isLocked: (matchId: string) => boolean = () => false,
): CorrectionPlan {
  const map = cloneAll(matches);
  const m = get(map, matchId);
  if (m.status !== "done" || m.isBye || m.winner === null) {
    throw new Error("Solo se puede corregir un partido jugado.");
  }
  if (m.winner === newWinner) return { ok: true, change: { matches: sorted(map), changedIds: [] } };

  const oldWinner = m[m.winner]!;
  const oldLoser = m[otherSide(m.winner)]!;

  if (m.bracket === "grand_final" && m.round === 1) {
    const reset = findReset(map);
    if (reset && (reset.status === "done" || isLocked(reset.id))) return { ok: false, blockedBy: [reset.id] };
    m.winner = newWinner;
    if (reset) applyResetDecision(m, reset);
    return { ok: true, change: { matches: sorted(map), changedIds: diff(matches, map) } };
  }

  const blockedBy: string[] = [];
  const check = (ref: SlotRef | null, participant: string) => {
    let current = ref;
    while (current) {
      const target = get(map, current.matchId);
      const played = target.status === "done" && !target.isBye;
      if (played || isLocked(target.id)) {
        blockedBy.push(target.id);
        return;
      }
      // Un BYE ya resuelto con este participante: la cadena sigue al siguiente partido.
      if (target.status === "done" && target.isBye && target[target.winner!] === participant) {
        current = target.next;
      } else {
        current = null;
      }
    }
  };
  check(m.next, oldWinner);
  check(m.loserNext, oldLoser);
  if (blockedBy.length > 0) return { ok: false, blockedBy };

  m.winner = newWinner;
  replaceDownstream(map, m.next, oldWinner, oldLoser);
  replaceDownstream(map, m.loserNext, oldLoser, oldWinner);
  settleMap(map);
  return { ok: true, change: { matches: sorted(map), changedIds: diff(matches, map) } };
}

function replaceDownstream(
  map: Map<string, EngineMatch>,
  ref: SlotRef | null,
  previous: string,
  replacement: string,
): void {
  let current = ref;
  while (current) {
    const target = get(map, current.matchId);
    if (target[current.slot] !== previous) {
      throw new Error(`El partido ${target.id} no contiene al participante esperado.`);
    }
    target[current.slot] = replacement;
    if (target.status === "done" && target.isBye && target.winner === current.slot) {
      current = target.next;
    } else {
      current = null;
    }
  }
}

// ---------------------------------------------------------------------------------------------------------
// Consultas sobre el cuadro
// ---------------------------------------------------------------------------------------------------------

/** Campeón del cuadro, o `null` si todavía no está decidido. */
export function championOf(matches: EngineMatch[]): string | null {
  const reset = matches.find((m) => m.bracket === "grand_final" && m.round === 2);
  const grandFinal = matches.find((m) => m.bracket === "grand_final" && m.round === 1);
  if (grandFinal) {
    if (reset && reset.status === "done") return reset[reset.winner!];
    if (grandFinal.status === "done" && (!reset || reset.status === "void")) return grandFinal[grandFinal.winner!];
    return null;
  }
  const winners = matches.filter((m) => m.bracket === "winners");
  const lastRound = Math.max(...winners.map((m) => m.round));
  const final = winners.find((m) => m.round === lastRound);
  return final && final.status === "done" ? final[final.winner!] : null;
}

/** Un partido se puede disputar cuando tiene a sus dos participantes y no tiene resultado. */
export function isPlayable(match: EngineMatch): boolean {
  return match.status === "open" && match.a !== null && match.b !== null;
}

/** ¿Es la última serie del cuadro (final o gran final)? Se juega con el formato de la final. */
export function isFinalMatch(match: EngineMatch, matches: EngineMatch[]): boolean {
  if (match.bracket === "grand_final") return true;
  if (match.bracket !== "winners") return false;
  if (matches.some((m) => m.bracket === "grand_final")) return false;
  return match.next === null;
}
