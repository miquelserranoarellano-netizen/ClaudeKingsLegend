import { mediaUrl } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";

const PALETTES = [
  { bg: "#0e1220", a: "#d0103a", b: "#ffffff" },
  { bg: "#131a33", a: "#1f55c7", b: "#d0103a" },
  { bg: "#10201b", a: "#0b7a55", b: "#ffffff" },
  { bg: "#1d1426", a: "#d0103a", b: "#b7790a" },
  { bg: "#171c2e", a: "#b7790a", b: "#ffffff" },
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
  return (
    <svg viewBox="0 0 640 280" preserveAspectRatio="xMidYMid slice" className={cn("size-full", className)} aria-hidden>
      <rect width="640" height="280" fill={p.bg} />
      <g transform={`skewX(-${tilt})`}>
        <rect x={260 + shift} y="-20" width="70" height="330" fill={p.a} />
        <rect x={350 + shift} y="-20" width="18" height="330" fill={p.b} opacity="0.85" />
        <rect x={390 + shift} y="-20" width="160" height="330" fill={p.a} opacity="0.22" />
        <rect x={120 + shift / 2} y="-20" width="6" height="330" fill={p.b} opacity="0.25" />
      </g>
      <g transform="translate(470 70) scale(5)" opacity="0.16" fill={p.b}>
        <path d="M7 21.5V11.2l4.6 4.1L16 7.5l4.4 7.8 4.6-4.1v10.3z" />
        <rect x="7" y="23" width="18" height="2.6" />
      </g>
      <rect width="640" height="280" fill={`url(#kl-fade-${h})`} />
      <defs>
        <linearGradient id={`kl-fade-${h}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.55" stopColor={p.bg} stopOpacity="0" />
          <stop offset="1" stopColor={p.bg} stopOpacity="0.55" />
        </linearGradient>
      </defs>
    </svg>
  );
}
