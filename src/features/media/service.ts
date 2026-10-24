import "server-only";
import { eq } from "drizzle-orm";
import { type DbOrTx } from "@/server/db/client";
import { media } from "@/server/db/schema";
import { AppError } from "@/server/errors";

/** Tamaño máximo aceptado (el navegador reduce las imágenes antes de subirlas; esto es el tope duro). */
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

type Kind = (typeof media.$inferInsert)["kind"];

/**
 * Tipo real de la imagen por su firma binaria, sin fiarse de la extensión ni del tipo que declara el
 * navegador. SVG no se admite: puede llevar código.
 */
export function detectImageType(bytes: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null {
  const startsWith = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

export async function storeImage(
  db: DbOrTx,
  file: File,
  options: { ownerId: string; kind: Kind; isPublic: boolean },
): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) throw new AppError("validation", "errors.imageTooLarge");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = detectImageType(bytes);
  if (!contentType) throw new AppError("validation", "errors.invalidImage");
  const [row] = await db
    .insert(media)
    .values({
      ownerId: options.ownerId,
      kind: options.kind,
      contentType,
      byteSize: bytes.byteLength,
      data: bytes,
      isPublic: options.isPublic,
    })
    .returning({ id: media.id });
  return row!.id;
}

export async function deleteMedia(db: DbOrTx, id: string | null): Promise<void> {
  if (!id) return;
  await db.delete(media).where(eq(media.id, id));
}
