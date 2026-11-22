import { ArrowRight, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { DemoBadge, PhaseBadge } from "@/components/ui/status-badge";
import { label } from "@/i18n";
import { cn } from "@/lib/cn";
import type { TournamentCard } from "../queries";
import { timingLine } from "./tournament-card";

/**
 * Torneo destacado en la portada, sobre el arte: el que tiene la inscripción abierta, o el que se juega,
 * o el próximo. Datos reales (si es de demostración, lo dice).
 */
export function TournamentSpotlight({ tournament: t, className }: { tournament: TournamentCard; className?: string }) {
  return (
    <article
      className={cn(
        "group relative w-full rounded-card border border-brand/35 bg-night/80 p-5 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.95)] backdrop-blur-md transition-[transform,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-brand/70",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <PhaseBadge phase={t.phase} />
        {t.isDemo && <DemoBadge />}
      </div>
      <h2 className="mt-3 font-display text-2xl leading-tight font-bold tracking-[0.04em] uppercase">
        <Link href={`/torneos/${t.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none group-hover:text-brand-strong">
          {t.name}
        </Link>
      </h2>
      <p className="mt-1 text-sm text-ink-2">
        {label("format", t.format)} · {timingLine(t)}
      </p>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3 text-sm">
        <span className="inline-flex items-center gap-1.5 font-semibold tabular">
          <Users aria-hidden className="size-4 text-ink-3" />
          {t.approvedCount}/{t.maxParticipants}
          <span className="font-normal text-ink-3">{t.participantType === "team" ? "equipos" : "jugadores"}</span>
        </span>
        <span className="inline-flex items-center gap-1 font-display font-bold tracking-[0.12em] text-brand-strong uppercase">
          Ver torneo
          <ArrowRight aria-hidden className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
        </span>
      </div>
      {t.prizeDescription && (
        <p className="mt-3 flex items-start gap-2 text-sm font-medium text-trophy">
          <Trophy aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span className="line-clamp-2">{t.prizeDescription}</span>
        </p>
      )}
    </article>
  );
}
