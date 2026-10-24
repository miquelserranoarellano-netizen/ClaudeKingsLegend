import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Se evalúa en cada petición para respetar ALLOW_INDEXING sin recompilar.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  // Fuera de producción (o sin URL pública definida) no se indexa nada.
  const indexable = process.env.NODE_ENV === "production" && !!process.env.NEXT_PUBLIC_SITE_URL && process.env.ALLOW_INDEXING !== "0";
  return {
    rules: indexable
      ? [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/admin", "/api/", "/acceso", "/registro", "/recuperar", "/restablecer", "/verificar-correo"] }]
      : [{ userAgent: "*", disallow: "/" }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
