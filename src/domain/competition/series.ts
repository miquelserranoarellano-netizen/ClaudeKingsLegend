import type { Side } from "./types";

/**
 * Formatos de serie admitidos. Los impares siempre tienen ganador. El BO2 (dos partidas, se juegan las dos)
 * puede acabar 1-1: solo se permite en ligas, donde el empate da puntos (como en el fútbol).
 */
export const BEST_OF_VALUES = [1, 2, 3, 5, 7] as const;
export type BestOf = (typeof BEST_OF_VALUES)[number];
/** Series que siempre tienen ganador: las únicas válidas en cuadros y en la fase suiza. */
export const DECISIVE_BEST_OF_VALUES = [1, 3, 5, 7] as const;

export function isBestOf(value: number): value is BestOf {
  return (BEST_OF_VALUES as readonly number[]).includes(value);
}

/** Una serie de número par de partidas se juega entera y puede terminar en empate. */
export function allowsDraw(bestOf: number): boolean {
  return bestOf % 2 === 0;
}

/** Partidas que hay que ganar para llevarse la serie (2 en un Bo3). */
export function winsNeeded(bestOf: number): number {
  return Math.floor(bestOf / 2) + 1;
}

export type SeriesScoreCheck =
  | { ok: true; /** `null`: empate (solo en series de número par, como el BO2). */ winner: Side | null }
  | { ok: false; reason: "invalid" | "not_finished" | "too_many_games" };

/**
 * Comprueba que un marcador cierra la serie: el ganador llega exactamente a las victorias necesarias y el
 * perdedor se queda por debajo. 2-1 en un Bo3 vale; 1-1, 3-0 o 2-2 no. En un BO2 se juegan las dos
 * partidas: 2-0, 0-2 o 1-1 (empate).
 */
export function checkSeriesScore(bestOf: number, scoreA: number, scoreB: number): SeriesScoreCheck {
  if (!isBestOf(bestOf)) return { ok: false, reason: "invalid" };
  if (![scoreA, scoreB].every((s) => Number.isInteger(s) && s >= 0)) return { ok: false, reason: "invalid" };
  if (allowsDraw(bestOf)) {
    if (scoreA + scoreB > bestOf) return { ok: false, reason: "too_many_games" };
    if (scoreA + scoreB < bestOf) return { ok: false, reason: "not_finished" };
    return { ok: true, winner: scoreA === scoreB ? null : scoreA > scoreB ? "a" : "b" };
  }
  const needed = winsNeeded(bestOf);
  const high = Math.max(scoreA, scoreB);
  const low = Math.min(scoreA, scoreB);
  if (high > needed || scoreA + scoreB > bestOf) return { ok: false, reason: "too_many_games" };
  if (high < needed || low >= needed) return { ok: false, reason: "not_finished" };
  return { ok: true, winner: scoreA > scoreB ? "a" : "b" };
}

/**
 * Comprueba que el detalle de partidas (ganador de cada una, en orden) cuadra con el marcador y que la
 * serie no se habría cerrado antes de la última partida.
 */
export function gamesMatchScore(bestOf: number, scoreA: number, scoreB: number, games: Side[]): boolean {
  if (games.length !== scoreA + scoreB) return false;
  const needed = winsNeeded(bestOf);
  let a = 0;
  let b = 0;
  for (const [index, game] of games.entries()) {
    if (game === "a") a += 1;
    else b += 1;
    if ((a === needed || b === needed) && index < games.length - 1) return false;
  }
  return a === scoreA && b === scoreB;
}

/** Marcador que se registra en una victoria por incomparecencia (2-0 en un Bo3). */
export function forfeitScore(bestOf: number, winner: Side): { scoreA: number; scoreB: number } {
  const needed = winsNeeded(bestOf);
  return winner === "a" ? { scoreA: needed, scoreB: 0 } : { scoreA: 0, scoreB: needed };
}
