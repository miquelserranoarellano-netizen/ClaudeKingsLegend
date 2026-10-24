/**
 * Tipos del motor de competición. Todo lo que hay en `src/domain` es puro: no toca la base de datos,
 * la red ni el reloj. La capa de servidor carga los partidos, llama al motor y guarda lo que cambia.
 */

export type Side = "a" | "b";

/** Cuadro al que pertenece un partido. */
export type BracketKind = "winners" | "losers" | "grand_final" | "league";

/** Hueco de un partido al que va a parar un participante. */
export interface SlotRef {
  matchId: string;
  slot: Side;
}

/**
 * Estado de un partido desde el punto de vista del motor:
 * - `open`: por disputar (o esperando rivales).
 * - `done`: tiene ganador, sea por resultado o por BYE.
 * - `void`: no se disputará nunca (ambos huecos vacíos, o el reinicio de la gran final no fue necesario).
 */
export type EngineStatus = "open" | "done" | "void";

export interface EngineMatch {
  id: string;
  bracket: BracketKind;
  /** Ronda dentro de su cuadro, empezando en 1. */
  round: number;
  /** Posición dentro de la ronda, empezando en 0. */
  position: number;
  a: string | null;
  b: string | null;
  /** El hueco no se llenará nunca (BYE): su origen no produce a nadie. */
  aDead: boolean;
  bDead: boolean;
  status: EngineStatus;
  winner: Side | null;
  /** Ganado sin jugar porque el rival es un BYE. */
  isBye: boolean;
  /** Adónde va el ganador. `null` en la final. */
  next: SlotRef | null;
  /** Adónde va el perdedor (solo en doble eliminación). `null` = eliminado. */
  loserNext: SlotRef | null;
}

export type IdFactory = () => string;

export function otherSide(side: Side): Side {
  return side === "a" ? "b" : "a";
}
