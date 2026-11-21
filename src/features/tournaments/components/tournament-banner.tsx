import { mediaUrl } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";

/** Paletas de las portadas generadas: noche + un acento principal + un acento secundario. */
const PALETTES = [
  { bg: "#0a1428", a: "#c8aa6e", b: "#0ac8b9" },
  { bg: "#03161c", a: "#0ac8b9", b: "#c8aa6e" },
  { bg: "#120c24", a: "#9d74ff", b: "#c8aa6e" },
  { bg: "#190a12", a: "#e84057", b: "#c8aa6e" },
  { bg: "#051a16", a: "#2fd6a4", b: "#e6cd94" },
];

function hash(text: string): number {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

/**
 * Banner del torneo: la imagen subida por la organización o, si no hay, una composición geométrica
 * generada a partir del identificador (siempre la misma para el mismo torneo). Nunca una foto de ejemplo.
 */
export function TournamentBanner({
  seed,
  mediaId,
  className,
  priority = false,
}: {
  seed: string;
  mediaId: string | null;
  className?: string;
  priority?: boolean;
}) {
  if (mediaId) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- imagen ya reducida al subirla, servida con caché larga
      <img
        src={mediaUrl(mediaId)}
        alt=""
        className={cn("size-full object-cover", className)}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
      />
    );
  }
  const h = hash(seed);
  const p = PALETTES[h % PALETTES.length]!;
  const shift = (h >>> 8) % 120;
  const tilt = 18 + ((h >>> 16) % 14);
  const ringX = 430 + ((h >>> 4) % 120);
  const id = `kl-b${h.toString(36)}`;
  return (
    <svg viewBox="0 0 640 280" preserveAspectRatio="xMidYMid slice" className={cn("size-full", className)} aria-hidden>
      <defs>
        <radialGradient id={`${id}-glow`} cx={ringX / 640} cy="0.5" r="0.55">
          <stop offset="0" stopColor={p.a} stopOpacity="0.38" />
          <stop offset="0.55" stopColor={p.a} stopOpacity="0.08" />
          <stop offset="1" stopColor={p.a} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.45" stopColor="#010a13" stopOpacity="0" />
          <stop offset="1" stopColor="#010a13" stopOpacity="0.75" />
        </linearGradient>
        <pattern id={`${id}-hex`} width="28" height="50" patternUnits="userSpaceOnUse">
          <path d="M14 33L0 25L0 8L14 0L28 8L28 25L14 33L14 50" fill="none" stroke={p.b} strokeOpacity="0.09" />
        </pattern>
      </defs>
      <rect width="640" height="280" fill={p.bg} />
      <rect width="640" height="280" fill={`url(#${id}-glow)`} />
      <rect width="640" height="280" fill={`url(#${id}-hex)`} />
      {/* Haces de luz */}
      <g transform={`skewX(-${tilt})`}>
        <rect x={250 + shift} y="-20" width="90" height="330" fill={p.a} opacity="0.13" />
        <rect x={352 + shift} y="-20" width="5" height="330" fill={p.b} opacity="0.55" />
        <rect x={150 + shift / 2} y="-20" width="2" height="330" fill={p.a} opacity="0.35" />
      </g>
      {/* Anillo rúnico con la corona */}
      <g transform={`translate(${ringX} 140)`}>
        <circle r="122" fill="none" stroke={p.a} strokeOpacity="0.55" strokeWidth="1.5" />
        <circle r="108" fill="none" stroke={p.a} strokeOpacity="0.3" strokeDasharray="2 8" />
        <path d="M0 -96 83 -48v96L0 96l-83 -48v-96z" fill="none" stroke={p.b} strokeOpacity="0.4" />
        <circle r="62" fill="#010a13" fillOpacity="0.55" stroke={p.a} strokeOpacity="0.7" strokeWidth="1.5" />
        <g transform="scale(3.1) translate(-16 -17)" fill={p.a} opacity="0.85">
          <path d="M8.2 22.4v-9l4 3.6L16 10.2l3.8 6.8 4-3.6v9z" />
          <rect x="8.2" y="23.6" width="15.6" height="2.2" />
        </g>
      </g>
      <rect width="640" height="280" fill={`url(#${id}-fade)`} />
    </svg>
  );
}
