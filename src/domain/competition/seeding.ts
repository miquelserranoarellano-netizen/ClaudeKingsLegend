/** Menor potencia de dos mayor o igual que `n` (mínimo 2). */
export function bracketSize(n: number): number {
  let size = 2;
  while (size < n) size *= 2;
  return size;
}

/**
 * Orden estándar de cabezas de serie en un cuadro de `size` plazas: [1, 8, 4, 5, 2, 7, 3, 6] para 8.
 * Cada pareja consecutiva es un partido de la primera ronda y la suma de cada pareja es `size + 1`, así
 * que el 1 y el 2 solo pueden cruzarse en la final. Los BYE ocupan las semillas más altas (las que no
 * existen), de modo que siempre caen contra los mejores clasificados y nunca dos BYE se enfrentan.
 */
export function seedOrder(size: number): number[] {
  if (size < 2 || (size & (size - 1)) !== 0) {
    throw new Error(`El tamaño del cuadro debe ser una potencia de dos (recibido ${size}).`);
  }
  let order = [1, 2];
  while (order.length < size) {
    const total = order.length * 2 + 1;
    order = order.flatMap((seed) => [seed, total - seed]);
  }
  return order;
}

export function log2(size: number): number {
  return Math.round(Math.log2(size));
}
