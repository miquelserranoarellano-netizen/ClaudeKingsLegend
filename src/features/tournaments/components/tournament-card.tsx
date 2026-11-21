import { CalendarDays, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { DemoBadge, PhaseBadge } from "@/components/ui/status-badge";
import { label } from "@/i18n";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { TournamentCard as Card } from "../queries";
import { TournamentBanner } from "./tournament-banner";

function timingLine(t: Card): string {
  switch (t.phase) {
    case "registration_upcoming":
      return `Inscripción desde el ${formatShortDate(t.registrationOpensAt)}`;
    case "registration_open":
      return `Inscripción hasta el ${formatShortDate(t.registrationClosesAt)}`;
    case "registration_closed":
      return `Empieza el ${formatShortDate(t.startsAt)}`;
    case "in_progress":
      return `Empezó el ${formatShortDate(t.startedAt ?? t.startsAt)}`;
    case "completed":
      return `Terminado`;
    case "cancelled":
      return "Cancelado";
    case "draft":
      return "Borrador sin publicar";
  }
}

export function TournamentCard({ tournament: t, className, headingLevel = "h3" }: { tournament: Card; className?: string; headingLevel?: "h2" | "h3" }) {
  const Heading = headingLevel;
  const fill = Math.min(100, Math.round((t.approvedCount / t.maxParticipants) * 100));
  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-brand/60 hover:shadow-lift",
        className,
      )}
    >
      <div className="relative aspect-[16/7] overflow-hidden bg-night">
        <TournamentBanner seed={t.slug} mediaId={t.bannerMediaId} className="transition-transform duration-500 group-hover:scale-[1.04]" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-brand/70 to-transparent" />
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <PhaseBadge phase={t.phase} className="shadow-sm" />
          {t.isDemo && <DemoBadge />}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <p className="font-display text-xs font-bold tracking-[0.14em] text-hex uppercase">
          {label("format", t.format)} · {label("participantType", t.participantType)}
          {t.region ? ` · ${t.region}` : ""}
        </p>
        <Heading className="font-display text-2xl leading-tight font-bold tracking-[0.04em] uppercase">
          <Link href={`/torneos/${t.slug}`} className="after:absolute after:inset-0 group-hover:text-brand-strong focus-visible:outline-none">
            {t.name}
          </Link>
        </Heading>
        {t.summary && <p className="line-clamp-2 text-sm text-ink-3">{t.summary}</p>}
        <div className="mt-auto space-y-3 pt-1">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5 text-ink-2">
              <CalendarDays aria-hidden className="size-4 text-ink-3" />
              {timingLine(t)}
            </span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-ink tabular">
              <Users aria-hidden className="size-4 text-ink-3" />
              {t.approvedCount}/{t.maxParticipants}
              <span className="sr-only"> plazas ocupadas</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden bg-night ring-1 ring-line" aria-hidden>
            <div
              className={cn(
                "h-full",
                fill >= 100 ? "bg-linear-to-r from-hex/70 to-hex shadow-[0_0_10px_rgb(10_200_185/0.7)]" : "bg-linear-to-r from-gold-deep to-brand-strong shadow-[0_0_10px_rgb(200_170_110/0.6)]",
              )}
              style={{ width: `${fill}%` }}
            />
          </div>
          {t.prizeDescription && (
            <p className="flex items-center gap-1.5 text-sm font-medium text-trophy">
              <Trophy aria-hidden className="size-4" />
              <span className="line-clamp-1">{t.prizeDescription}</span>
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
