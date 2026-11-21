import { cn } from "@/lib/cn";

const TICKS = Array.from({ length: 72 }, (_, i) => i * 5);
const RUNES = Array.from({ length: 12 }, (_, i) => i * 30);

/**
 * Emblema rúnico decorativo (arte propio en SVG): anillos de oro que giran muy despacio, un hexágono, la
 * corona de la marca y una gema cian que brilla. Sin imágenes externas: pesa poco y escala sin perder
 * nitidez. Respeta `prefers-reduced-motion` (las animaciones se detienen, ver globals.css).
 */
export function RuneEmblem({ className }: { className?: string }) {
  const spin = { transformBox: "fill-box", transformOrigin: "center" } as const;
  return (
    <svg viewBox="0 0 400 400" className={cn("size-full", className)} aria-hidden>
      <defs>
        <linearGradient id="kl-rune-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbefcf" />
          <stop offset="0.45" stopColor="#d9bb7c" />
          <stop offset="1" stopColor="#8a6a33" />
        </linearGradient>
        <radialGradient id="kl-rune-core" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#0f2a3a" />
          <stop offset="0.7" stopColor="#081423" />
          <stop offset="1" stopColor="#030912" />
        </radialGradient>
        <radialGradient id="kl-rune-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#0ac8b9" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#0ac8b9" stopOpacity="0.12" />
          <stop offset="1" stopColor="#0ac8b9" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Halo cian */}
      <circle cx="200" cy="200" r="200" fill="url(#kl-rune-glow)" className="animate-glow" />

      {/* Anillo exterior con marcas: gira muy despacio */}
      <g className="animate-spin-slow" style={spin}>
        <circle cx="200" cy="200" r="188" fill="none" stroke="#c8aa6e" strokeOpacity="0.45" strokeWidth="1" />
        <circle cx="200" cy="200" r="181" fill="none" stroke="#c8aa6e" strokeOpacity="0.18" strokeWidth="1" />
        {TICKS.map((deg) => (
          <line
            key={deg}
            x1="200"
            y1="13"
            x2="200"
            y2={deg % 30 === 0 ? 27 : 20}
            stroke="#c8aa6e"
            strokeOpacity={deg % 30 === 0 ? 0.7 : 0.3}
            strokeWidth={deg % 30 === 0 ? 1.6 : 1}
            transform={`rotate(${deg} 200 200)`}
          />
        ))}
        {[0, 90, 180, 270].map((deg) => (
          <rect key={deg} x="194" y="6" width="12" height="12" fill="#010a13" stroke="#e6cd94" strokeWidth="1.4" transform={`rotate(${deg} 200 200) rotate(45 200 12)`} />
        ))}
      </g>

      {/* Anillo de runas: gira en sentido contrario */}
      <g className="animate-spin-slower" style={spin}>
        <circle cx="200" cy="200" r="160" fill="none" stroke="#c8aa6e" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="2 9" />
        {RUNES.map((deg) => (
          <path
            key={deg}
            d="M200 44 l5 9 -5 9 -5 -9z"
            fill="none"
            stroke="#0ac8b9"
            strokeOpacity="0.75"
            strokeWidth="1.2"
            transform={`rotate(${deg} 200 200)`}
          />
        ))}
      </g>

      {/* Hexágono de oro */}
      <path d="M200 66 316 133v134L200 334 84 267V133z" fill="none" stroke="url(#kl-rune-gold)" strokeOpacity="0.8" strokeWidth="1.5" />
      <path d="M200 80 304 140v120L200 320 96 260V140z" fill="none" stroke="#c8aa6e" strokeOpacity="0.22" strokeWidth="1" />

      {/* Núcleo */}
      <circle cx="200" cy="200" r="104" fill="url(#kl-rune-core)" stroke="url(#kl-rune-gold)" strokeWidth="2.5" />
      <circle cx="200" cy="200" r="94" fill="none" stroke="#c8aa6e" strokeOpacity="0.3" strokeWidth="1" />

      {/* Corona forjada */}
      <g transform="translate(200 206) scale(5.6) translate(-16 -17)">
        <path d="M8.2 22.4v-9l4 3.6L16 10.2l3.8 6.8 4-3.6v9z" fill="url(#kl-rune-gold)" />
        <rect x="8.2" y="23.6" width="15.6" height="2.2" fill="url(#kl-rune-gold)" />
        <circle cx="8.2" cy="12.6" r="1.1" fill="#e6cd94" />
        <circle cx="16" cy="9.4" r="1.1" fill="#e6cd94" />
        <circle cx="23.8" cy="12.6" r="1.1" fill="#e6cd94" />
      </g>
      {/* Gema hextech */}
      <g className="animate-glow">
        <path d="M200 187l9 14-9 14-9-14z" fill="#0ac8b9" stroke="#010a13" strokeWidth="2" />
        <path d="M200 187l9 14-9 14-9-14z" fill="none" stroke="#5ef2e6" strokeWidth="1" />
      </g>
    </svg>
  );
}
