import { eq } from "drizzle-orm";
import { after } from "next/server";
import { z } from "zod";
import { canManageTournament } from "@/domain/permissions";
import { loadSides } from "@/features/matches/service";
import { getCurrentUser } from "@/server/auth/session";
import { getDb, isCloudflareWorker } from "@/server/db/client";
import { matches, media, resultEvidence, tournaments } from "@/server/db/schema";

const notFound = () => new Response("No encontrado", { status: 404, headers: { "Cache-Control": "no-store" } });

/**
 * Caché del centro de datos de Cloudflare más cercano (solo en un Worker y con dominio propio: en
 * `*.workers.dev` no hace nada). Las imágenes públicas no cambian nunca (una imagen nueva tiene otro id), así
 * que se guardan ahí y no se vuelven a leer de la base de datos: menos consultas y menos tráfico de salida
 * de Supabase, que en el plan gratuito está limitado. Las evidencias (privadas) nunca se guardan.
 */
function edgeCache(): Cache | undefined {
  if (!isCloudflareWorker()) return undefined;
  return (globalThis as typeof globalThis & { caches?: { default?: Cache } }).caches?.default;
}

/**
 * Sirve una imagen subida. Las públicas (avatares, logotipos, banners) se cachean para siempre: su id no
 * cambia nunca y una imagen nueva tiene otro id. Las evidencias solo las ven los dos bandos del partido y
 * quien gestiona el torneo; a cualquier otro se le responde como si no existieran.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return notFound();
  const cache = edgeCache();
  // La clave es solo la URL (sin cookies ni otras cabeceras): solo se guardan imágenes públicas.
  const cacheKey = new Request(new URL(request.url).toString());
  const cached = await cache?.match(cacheKey).catch(() => undefined);
  if (cached) return cached;

  const db = await getDb();
  const [row] = await db.select().from(media).where(eq(media.id, id));
  if (!row) return notFound();

  if (!row.isPublic) {
    const user = await getCurrentUser();
    if (!user) return notFound();
    const [evidence] = await db
      .select({ match: matches, tournament: tournaments })
      .from(resultEvidence)
      .innerJoin(matches, eq(matches.id, resultEvidence.matchId))
      .innerJoin(tournaments, eq(tournaments.id, matches.tournamentId))
      .where(eq(resultEvidence.mediaId, id));
    if (!evidence) return notFound();
    let allowed = canManageTournament(user, evidence.tournament);
    if (!allowed) {
      const sides = await loadSides(db, evidence.match);
      allowed = [...(sides.a?.memberIds ?? []), ...(sides.b?.memberIds ?? [])].includes(user.id);
    }
    if (!allowed) return notFound();
  }

  const response = new Response(new Uint8Array(row.data), {
    headers: {
      "Content-Type": row.contentType,
      "Content-Length": String(row.byteSize),
      "Cache-Control": row.isPublic ? "public, max-age=31536000, immutable" : "private, no-store",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
  if (row.isPublic && cache) {
    // Se guarda después de responder, sin retrasar la respuesta.
    const copy = response.clone();
    after(() =>
      cache.put(cacheKey, copy).catch((error: Error) => {
        console.warn("[media] no se ha podido guardar en la caché de Cloudflare:", error.message);
      }),
    );
  }
  return response;
}
