import { sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";

export const dynamic = "force-dynamic";

/**
 * Comprobación de salud para el proxy, Docker o un monitor externo: 200 si la aplicación responde y la base
 * de datos contesta; 503 si no. No expone versiones ni detalles internos.
 */
export async function GET() {
  const started = Date.now();
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    return Response.json(
      { status: "ok", database: "ok", latencyMs: Date.now() - started },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[health] la base de datos no responde:", (error as Error)?.message);
    return Response.json({ status: "error", database: "unreachable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
