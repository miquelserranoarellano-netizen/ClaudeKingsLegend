/** Servidores de League of Legends (informativo: Kings Legend no se conecta a la API de Riot). */
export const REGIONS = ["EUW", "EUNE", "NA", "LAN", "LAS", "BR", "TR", "RU", "OCE", "KR", "JP", "ME", "SEA", "TW", "VN"] as const;
export type Region = (typeof REGIONS)[number];

export const POSITIONS = ["top", "jungle", "mid", "bottom", "support", "fill"] as const;
export type Position = (typeof POSITIONS)[number];

/** Riot ID: «Nombre#TAG». Nombre de 3 a 16 caracteres y etiqueta de 2 a 5 letras o números. */
export const RIOT_ID_PATTERN = /^([^#]{3,16})#([A-Za-z0-9]{2,5})$/;

export function parseRiotId(value: string): { gameName: string; tagLine: string } | null {
  const match = RIOT_ID_PATTERN.exec(value.trim());
  if (!match) return null;
  return { gameName: match[1]!.trim(), tagLine: match[2]!.toUpperCase() };
}

export function formatRiotId(gameName: string | null, tagLine: string | null): string | null {
  return gameName && tagLine ? `${gameName}#${tagLine}` : null;
}
