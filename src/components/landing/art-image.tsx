import { cn } from "@/lib/cn";
import { type Art, ART_HEIGHT, ART_WIDTH } from "./lol-art";

/**
 * Ilustración de League of Legends (ver `lol-art.ts`). Las de fondo son decorativas: `alt=""`. Solo la
 * del primer pantallazo se pide con prioridad; el resto se carga al acercarse.
 */
export function ArtImage({
  art,
  className,
  priority = false,
  decorative = false,
}: {
  art: Art;
  className?: string;
  priority?: boolean;
  decorative?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- arte remoto de Data Dragon, ya comprimido; en Workers no hay optimizador de imágenes
    <img
      src={art.src}
      alt={decorative ? "" : art.alt}
      width={ART_WIDTH}
      height={ART_HEIGHT}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      className={cn("size-full object-cover", className)}
    />
  );
}
