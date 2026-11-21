/** Colores del podio: oro, plata y bronce para los tres primeros puestos (`position` empieza en 1). */
const PODIUM = ["text-trophy", "text-[#c9d1dc]", "text-[#d39462]"] as const;

export function podiumClass(position: number, fallback = "text-ink-3"): string {
  return PODIUM[position - 1] ?? fallback;
}
