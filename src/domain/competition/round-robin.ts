/**
 * Calendario de liga por el método del círculo: cada participante juega una vez contra cada rival por
 * vuelta. Con un número impar de participantes, cada jornada descansa uno.
 */

export interface LeaguePairing {
  a: string;
  b: string;
}

export interface LeagueRound {
  /** Número de jornada, empezando en 1 (la segunda vuelta continúa la numeración). */
  number: number;
  leg: 1 | 2;
  pairings: LeaguePairing[];
  /** Quien descansa esta jornada (solo con número impar de participantes). */
  resting: string | null;
}

export function generateRoundRobin(participantsBySeed: string[], legs: 1 | 2): LeagueRound[] {
  const n = participantsBySeed.length;
  if (n < 2) throw new Error("Hacen falta al menos dos participantes.");
  if (new Set(participantsBySeed).size !== n) throw new Error("Hay participantes repetidos.");

  const list: (string | null)[] = [...participantsBySeed];
  if (list.length % 2 === 1) list.push(null);
  const size = list.length;
  const firstLeg: LeagueRound[] = [];

  for (let r = 0; r < size - 1; r++) {
    const pairings: LeaguePairing[] = [];
    let resting: string | null = null;
    for (let i = 0; i < size / 2; i++) {
      const home = list[i]!;
      const away = list[size - 1 - i]!;
      if (home === null || away === null) {
        resting = home ?? away;
        continue;
      }
      // Se alterna el lado del participante fijo para repartir el lado A (lado azul) entre jornadas.
      pairings.push(i === 0 && r % 2 === 1 ? { a: away, b: home } : { a: home, b: away });
    }
    firstLeg.push({ number: r + 1, leg: 1, pairings, resting });

    // Rotación: el primero queda fijo y el resto gira una posición.
    const fixed = list[0]!;
    const rest = list.slice(1);
    rest.unshift(rest.pop()!);
    list.splice(0, list.length, fixed, ...rest);
  }

  if (legs === 1) return firstLeg;
  const secondLeg = firstLeg.map((round) => ({
    number: round.number + firstLeg.length,
    leg: 2 as const,
    pairings: round.pairings.map(({ a, b }) => ({ a: b, b: a })),
    resting: round.resting,
  }));
  return [...firstLeg, ...secondLeg];
}
