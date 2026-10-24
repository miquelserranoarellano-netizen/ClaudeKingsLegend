import { AlertTriangle } from "lucide-react";
import { Container } from "@/components/layout/section";
import { getSettings } from "@/features/settings/service";
import { formatDate } from "@/lib/format";
import { type ContentSlug, getContentPage } from "./service";

/** Página de contenido editable desde /admin/contenido, con aviso visible si no está revisada. */
export async function LegalPage({ slug }: { slug: ContentSlug }) {
  const [page, settings] = await Promise.all([getContentPage(slug), getSettings()]);
  return (
    <Container className="max-w-3xl py-10">
      <h1 className="display text-4xl uppercase sm:text-5xl">{page.title}</h1>
      {!page.legalReviewed && (
        <p className="mt-6 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          Borrador pendiente de revisión legal: este texto describe cómo funciona la plataforma, pero debe revisarlo un
          profesional y completarse con los datos del titular antes del lanzamiento.
        </p>
      )}
      <div className="mt-8 leading-relaxed whitespace-pre-line text-ink-2">{page.body}</div>
      {slug === "contacto" && settings.contactEmail && (
        <p className="mt-8 rounded-card border border-line bg-surface p-5">
          Correo: <a href={`mailto:${settings.contactEmail}`} className="font-semibold text-brand underline-offset-4 hover:underline">{settings.contactEmail}</a>
        </p>
      )}
      {page.updatedAt && <p className="mt-10 text-xs text-ink-3">Última actualización: {formatDate(page.updatedAt)}</p>}
    </Container>
  );
}
