import { Megaphone, Pin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageHeader } from "@/components/layout/section";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { DemoBadge } from "@/components/ui/status-badge";
import { listPublishedAnnouncements } from "@/features/announcements/service";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Noticias", description: "Anuncios y novedades de Kings Legend y de sus torneos.", alternates: { canonical: "/noticias" } };

export default async function NewsPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const page = Math.max(1, Number((await searchParams).pagina) || 1);
  const result = await listPublishedAnnouncements({ page, pageSize: 12 });
  return (
    <>
      <PageHeader eyebrow="Novedades" title="Noticias" description="Anuncios de la organización y de los torneos." />
      <Container className="py-8">
        {result.items.length === 0 ? (
          <EmptyState icon={Megaphone} title="Sin noticias por ahora">Cuando haya anuncios, aparecerán aquí.</EmptyState>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {result.items.map((item) => (
              <Card key={item.id} className="relative p-5 hover:shadow-lift">
                <p className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
                  {item.pinned && <Pin aria-label="Fijado" className="size-3.5 text-brand" />}
                  {formatDate(item.publishedAt)}
                  {item.tournamentName && <span>· {item.tournamentName}</span>}
                  {item.isDemo && <DemoBadge />}
                </p>
                <h2 className="mt-2 font-display text-2xl leading-tight font-bold uppercase">
                  <Link href={`/noticias/${item.id}`} className="after:absolute after:inset-0 hover:text-brand">{item.title}</Link>
                </h2>
                <p className="mt-2 line-clamp-3 text-sm text-ink-2">{item.body}</p>
              </Card>
            ))}
          </div>
        )}
        <div className="mt-8">
          <Pagination page={result.page} pageCount={result.pageCount} hrefFor={(p) => `/noticias?pagina=${p}`} />
        </div>
      </Container>
    </>
  );
}
