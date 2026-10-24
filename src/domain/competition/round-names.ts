import type { BracketKind } from "./types";

/**
 * Nombre de una ronda a partir de su posición (no se guarda en la base de datos). Devuelve una clave del
 * diccionario y sus parámetros, para que el texto dependa del idioma.
 */
export type RoundName =
  | { key: "rounds.final" | "rounds.semifinal" | "rounds.quarterfinal" | "rounds.winnersFinal" | "rounds.losersFinal" | "rounds.grandFinal" | "rounds.grandFinalReset"; params?: undefined }
  | { key: "rounds.roundOf" | "rounds.losers" | "rounds.matchday"; params: { n: number } }
  | { key: "rounds.winners"; params: { name: RoundName } };

function bySize(matchesInRound: number): RoundName {
  if (matchesInRound === 1) return { key: "rounds.final" };
  if (matchesInRound === 2) return { key: "rounds.semifinal" };
  if (matchesInRound === 4) return { key: "rounds.quarterfinal" };
  return { key: "rounds.roundOf", params: { n: matchesInRound * 2 } };
}

export function roundName(input: {
  bracket: BracketKind;
  number: number;
  /** Rondas totales de ese cuadro (ganadores o perdedores). */
  totalRounds: number;
  doubleElimination: boolean;
}): RoundName {
  const { bracket, number, totalRounds } = input;
  if (bracket === "league") return { key: "rounds.matchday", params: { n: number } };
  if (bracket === "grand_final") return number === 1 ? { key: "rounds.grandFinal" } : { key: "rounds.grandFinalReset" };
  if (bracket === "losers") return number === totalRounds ? { key: "rounds.losersFinal" } : { key: "rounds.losers", params: { n: number } };
  const matchesInRound = 2 ** (totalRounds - number);
  if (!input.doubleElimination) return bySize(matchesInRound);
  if (matchesInRound === 1) return { key: "rounds.winnersFinal" };
  return { key: "rounds.winners", params: { name: bySize(matchesInRound) } };
}
