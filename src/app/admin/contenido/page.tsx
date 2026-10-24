import Link from "next/link";
import { DashboardTitle } from "@/components/layout/dashboard-title";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ContentPageForm } from "@/features/admin/components/admin-forms";
import { CONTENT_SLUGS, type ContentSlug, getContentPage } from "@/features/content/service";
import { cn } from "@/lib/cn";
import { requirePlatformAdmin } from "@/server/auth/session";

export const metadata = { title: "Páginas legales" };

export default async function ContentAdminPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  await requirePlatformAdmin("/admin/contenido");
  const requested = (await searchParams).pagina;
  const selected: ContentSlug = CONTENT_SLUGS.find((s) => s === requested) ?? "privacidad";
  const pages = await Promise.all(CONTENT_SLUGS.map((slug) => getContentPage(slug)));
  const page = pages.find((p) => p.slug === selected)!;
  return (
    <>
      <DashboardTitle
        title="Páginas legales"
        description="Privacidad, términos y contacto. Los textos de partida describen lo que hace la plataforma, pero deben revisarse por un profesional antes del lanzamiento."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {pages.map((p) => (
          <Link
            key={p.slug}
            href={`/admin/contenido?pagina=${p.slug}`}
            aria-current={p.slug === selected ? "page" : undefined}
            className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold", p.slug === selected ? "border-night bg-night text-white" : "border-line bg-surface")}
          >
            {p.title}
            {!p.legalReviewed && <Badge tone="warning" className="normal-case">sin revisar</Badge>}
          </Link>
        ))}
      </div>
      <Card>
        <CardHeader title={page.title} action={<Link href={`/${page.slug}`} className="text-sm font-semibold text-ink-2 hover:text-brand">Ver página</Link>} />
        <CardBody className="py-5">
          <ContentPageForm key={page.slug} page={{ slug: page.slug, title: page.title, body: page.body, legalReviewed: page.legalReviewed }} />
        </CardBody>
      </Card>
    </>
  );
}
