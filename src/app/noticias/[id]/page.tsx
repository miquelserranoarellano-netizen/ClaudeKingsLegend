import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Container } from "@/components/layout/section";
import { DemoBadge } from "@/components/ui/status-badge";
import { getAnnouncement } from "@/features/announcements/service";
import { formatDate } from "@/lib/format";

async function load(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const row = await getAnnouncement(id);
  // Solo anuncios publicados; los de torneos privados no se muestran sueltos.
  if (!row || row.a.status !== "published" || row.tournamentVisibility === "private") return null;
  return row;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const row = await load((await params).id);
  if (!row) return { title: "Noticia no encontrada", robots: { index: false } };
  return { title: row.a.title, description: row.a.body.slice(0, 160), alternates: { canonical: `/noticias/${row.a.id}` } };
}

export default async function NewsItemPage({ params }: { params: Promise<{ id: string }> }) {
  const row = await load((await params).id);
  if (!row) notFound();
  return (
    <Container className="max-w-3xl py-10">
      <Link href="/noticias" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-3 hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> Noticias
      </Link>
      <article className="mt-6">
        <p className="flex flex-wrap items-center gap-2 text-sm text-ink-3">
          {formatDate(row.a.publishedAt)}
          {row.tournamentName && (
            <>
              · <Link href={`/torneos/${row.tournamentSlug}`} className="font-semibold hover:text-brand">{row.tournamentName}</Link>
            </>
          )}
          {row.a.isDemo && <DemoBadge />}
        </p>
        <h1 className="display mt-2 text-4xl uppercase sm:text-5xl">{row.a.title}</h1>
        <div className="mt-6 text-lg leading-relaxed whitespace-pre-line text-ink-2">{row.a.body}</div>
      </article>
    </Container>
  );
}
