import { eq } from "drizzle-orm";
import { z } from "zod";
import { canManageTournament } from "@/domain/permissions";
import { loadSides } from "@/features/matches/service";
import { getCurrentUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { matches, media, resultEvidence, tournaments } from "@/server/db/schema";

const notFound = () => new Response("No encontrado", { status: 404, headers: { "Cache-Control": "no-store" } });

/**
 * Sirve una imagen subida. Las públicas (avatares, logotipos, banners) se cachean para siempre: su id no
 * cambia nunca y una imagen nueva tiene otro id. Las evidencias solo las ven los dos bandos del partido y
 * quien gestiona el torneo; a cualquier otro se le responde como si no existieran.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return notFound();
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

  return new Response(new Uint8Array(row.data), {
    headers: {
      "Content-Type": row.contentType,
      "Content-Length": String(row.byteSize),
      "Cache-Control": row.isPublic ? "public, max-age=31536000, immutable" : "private, no-store",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
