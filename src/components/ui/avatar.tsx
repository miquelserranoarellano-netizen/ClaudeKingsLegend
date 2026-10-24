import { cn } from "@/lib/cn";

const SIZES = { xs: "size-6 text-[10px]", sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-16 text-xl", xl: "size-24 text-3xl" } as const;
type Size = keyof typeof SIZES;

/** Color estable por nombre, de una paleta fija con buen contraste para las iniciales. */
const PALETTE = ["#0e1220", "#1f55c7", "#0b7a55", "#7a2a9c", "#ad0b2f", "#00687a", "#6b4e00", "#3f4a5c"];

function hash(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

export function mediaUrl(id: string): string {
  return `/media/${id}`;
}

/** Avatar de jugador: su imagen o sus iniciales. */
export function Avatar({ name, mediaId, size = "md", className }: { name: string; mediaId?: string | null; size?: Size; className?: string }) {
  if (mediaId) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- imágenes ya reducidas al subirlas y servidas con caché larga
      <img
        src={mediaUrl(mediaId)}
        alt=""
        className={cn("shrink-0 rounded-full object-cover", SIZES[size], className)}
        loading="lazy"
        decoding="async"
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white", SIZES[size], className)}
      style={{ backgroundColor: PALETTE[hash(name) % PALETTE.length] }}
    >
      {initials(name)}
    </span>
  );
}

/** Logotipo de equipo: su imagen o un escudo con la etiqueta. */
export function TeamLogo({ name, tag, mediaId, size = "md", className }: { name: string; tag?: string | null; mediaId?: string | null; size?: Size; className?: string }) {
  if (mediaId) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- ver Avatar
      <img
        src={mediaUrl(mediaId)}
        alt=""
        className={cn("shrink-0 rounded-lg bg-surface-2 object-cover", SIZES[size], className)}
        loading="lazy"
        decoding="async"
      />
    );
  }
  const color = PALETTE[hash(name) % PALETTE.length];
  return (
    <span
      aria-hidden
      className={cn("chamfer-sm inline-flex shrink-0 items-center justify-center rounded-lg font-display font-extrabold text-white tracking-tight", SIZES[size], className)}
      style={{ backgroundColor: color }}
    >
      {(tag ?? initials(name)).slice(0, 4)}
    </span>
  );
}
