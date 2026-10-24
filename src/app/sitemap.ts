import type { MetadataRoute } from "next";
import { sitemapProfiles } from "@/features/profiles/queries";
import { sitemapTeams } from "@/features/teams/queries";
import { sitemapTournaments } from "@/features/tournaments/queries";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Solo páginas públicas e indexables: nada privado, ni borradores, ni paneles. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [tournaments, teams, profiles] = await Promise.all([sitemapTournaments(), sitemapTeams(), sitemapProfiles()]);
  const statics = ["", "/torneos", "/equipos", "/ranking", "/noticias", "/privacidad", "/terminos", "/contacto"].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: "daily" as const,
    priority: path === "" ? 1 : 0.7,
  }));
  return [
    ...statics,
    ...tournaments.map((t) => ({ url: `${base}/torneos/${t.slug}`, lastModified: t.updatedAt, changeFrequency: "hourly" as const, priority: 0.8 })),
    ...teams.map((t) => ({ url: `${base}/equipos/${t.slug}`, lastModified: t.updatedAt, priority: 0.5 })),
    ...profiles.map((p) => ({ url: `${base}/jugadores/${p.handle}`, lastModified: p.updatedAt, priority: 0.4 })),
  ];
}
