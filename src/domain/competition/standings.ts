import type { Side } from "./types";

/**
 * Clasificación de liga, calculada siempre a partir de los partidos confirmados (no se guarda).
 *
 * Orden: puntos y, a igualdad de puntos, los desempates configurados en el orden elegido:
 * - `head_to_head`: puntos obtenidos solo en los partidos entre los empatados (miniliga).
 * - `game_difference`: diferencia de partidas ganadas y perdidas.
 * - `games_won`: partidas ganadas.
 * - `wins`: series ganadas.
 * Cuando un criterio deshace el empate solo en parte, al subgrupo que sigue empatado se le vuelven a
 * aplicar todos los criterios desde el principio (el enfrentamiento directo se recalcula entre ellos).
 * Si tras todos los criterios sigue habiendo empate, decide la semilla (orden de inscripción aprobado) y
 * la fila queda marcada con `decidedBySeed` para que la organización lo vea.
 */

export const TIEBREAKERS = ["head_to_head", "game_difference", "games_won", "wins"] as const;
export type Tiebreaker = (typeof TIEBREAKERS)[number];

export interface StandingsRules {
  pointsWin: number;
  pointsLoss: number;
  pointsForfeitLoss: number;
  tiebreakers: Tiebreaker[];
}

export interface StandingsParticipant {
  id: string;
  seed: number;
}

export interface StandingsMatch {
  a: string;
  b: string;
  winner: Side;
  scoreA: number;
  scoreB: number;
  isForfeit: boolean;
}

export interface StandingRow {
  participantId: string;
  seed: number;
  position: number;
  played: number;
  wins: number;
  losses: number;
  forfeitLosses: number;
  gamesWon: number;
  gamesLost: number;
  gameDifference: number;
  points: number;
  /** El puesto se ha decidido por semilla porque ningún desempate lo resolvió. */
  decidedBySeed: boolean;
}

type Row = Omit<StandingRow, "position" | "decidedBySeed">;

function pointsFor(rules: StandingsRules, won: boolean, forfeit: boolean): number {
  if (won) return rules.pointsWin;
  return forfeit ? rules.pointsForfeitLoss : rules.pointsLoss;
}

export function computeStandings(
  participants: StandingsParticipant[],
  matches: StandingsMatch[],
  rules: StandingsRules,
): StandingRow[] {
  const rows = new Map<string, Row>(
    participants.map((p) => [
      p.id,
      {
        participantId: p.id,
        seed: p.seed,
        played: 0,
        wins: 0,
        losses: 0,
        forfeitLosses: 0,
        gamesWon: 0,
        gamesLost: 0,
        gameDifference: 0,
        points: 0,
      },
    ]),
  );

  for (const match of matches) {
    const a = rows.get(match.a);
    const b = rows.get(match.b);
    if (!a || !b) continue;
    const sides: [Row, Side, number, number][] = [
      [a, "a", match.scoreA, match.scoreB],
      [b, "b", match.scoreB, match.scoreA],
    ];
    for (const [row, side, gamesFor, gamesAgainst] of sides) {
      const won = match.winner === side;
      row.played += 1;
      row.wins += won ? 1 : 0;
      row.losses += won ? 0 : 1;
      row.forfeitLosses += !won && match.isForfeit ? 1 : 0;
      row.gamesWon += gamesFor;
      row.gamesLost += gamesAgainst;
      row.gameDifference = row.gamesWon - row.gamesLost;
      row.points += pointsFor(rules, won, match.isForfeit);
    }
  }

  const ordered: { row: Row; decidedBySeed: boolean }[] = [];
  const byPoints = groupBy([...rows.values()], (r) => r.points);
  for (const group of byPoints) {
    ordered.push(...resolveTie(group, rules.tiebreakers, matches, rules));
  }

  return ordered.map(({ row, decidedBySeed }, index) => ({ ...row, position: index + 1, decidedBySeed }));
}

/** Agrupa por valor descendente conservando los grupos. */
function groupBy(rows: Row[], value: (row: Row) => number): Row[][] {
  const values = [...new Set(rows.map(value))].sort((x, y) => y - x);
  return values.map((v) => rows.filter((r) => value(r) === v));
}

function resolveTie(
  group: Row[],
  criteria: Tiebreaker[],
  matches: StandingsMatch[],
  rules: StandingsRules,
): { row: Row; decidedBySeed: boolean }[] {
  if (group.length === 1) return [{ row: group[0]!, decidedBySeed: false }];
  if (criteria.length === 0) {
    return [...group].sort((x, y) => x.seed - y.seed).map((row) => ({ row, decidedBySeed: true }));
  }

  const [criterion, ...rest] = criteria as [Tiebreaker, ...Tiebreaker[]];
  const value = criterionValue(criterion, group, matches, rules);
  const subgroups = groupBy(group, value);
  if (subgroups.length === 1) return resolveTie(group, rest, matches, rules);

  // Cada subgrupo es estrictamente menor que el grupo, así que reiniciar los criterios siempre termina.
  return subgroups.flatMap((sub) => resolveTie(sub, rules.tiebreakers, matches, rules));
}

function criterionValue(
  criterion: Tiebreaker,
  group: Row[],
  matches: StandingsMatch[],
  rules: StandingsRules,
): (row: Row) => number {
  switch (criterion) {
    case "game_difference":
      return (row) => row.gameDifference;
    case "games_won":
      return (row) => row.gamesWon;
    case "wins":
      return (row) => row.wins;
    case "head_to_head": {
      const ids = new Set(group.map((r) => r.participantId));
      const mini = new Map<string, number>(group.map((r) => [r.participantId, 0]));
      for (const m of matches) {
        if (!ids.has(m.a) || !ids.has(m.b)) continue;
        mini.set(m.a, mini.get(m.a)! + pointsFor(rules, m.winner === "a", m.isForfeit));
        mini.set(m.b, mini.get(m.b)! + pointsFor(rules, m.winner === "b", m.isForfeit));
      }
      return (row) => mini.get(row.participantId) ?? 0;
    }
  }
}
