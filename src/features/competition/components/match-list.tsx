import { Clock } from "lucide-react";
import Link from "next/link";
import { TeamLogo } from "@/components/ui/avatar";
import { DemoBadge, MatchStatusBadge } from "@/components/ui/status-badge";
import { formatShortDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { MatchListItem, SideRef } from "../queries";

function Side({ side, won, align }: { side: SideRef | null; won: boolean; align: "left" | "right" }) {
  return (
    <span className={cn("flex min-w-0 flex-1 items-center gap-2", align === "right" && "flex-row-reverse text-right")}>
      <TeamLogo name={side?.name ?? "?"} tag={side?.tag} mediaId={side?.logoMediaId} size="sm" />
      <span className={cn("truncate text-sm", won ? "font-bold text-ink" : "font-medium text-ink-2")}>{side?.name ?? "Por decidir"}</span>
    </span>
  );
}

/** Lista compacta de partidos (resultados recientes o próximos). */
export function MatchList({ items, mode }: { items: MatchListItem[]; mode: "results" | "upcoming" }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((m) => {
        const aWon = m.winnerId !== null && m.winnerId === m.a?.participantId;
        const bWon = m.winnerId !== null && m.winnerId === m.b?.participantId;
        return (
          <li key={m.id} className="relative px-4 py-3 hover:bg-surface-2/60">
            <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-ink-3">
              <Link
                href={`/torneos/${m.tournament.slug}/partidos/${m.id}`}
                className="truncate font-semibold after:absolute after:inset-0 hover:text-ink"
              >
                {m.tournament.name}
              </Link>
              <span className="flex shrink-0 items-center gap-1.5">
                {m.tournament.isDemo && <DemoBadge />}
                {mode === "upcoming" ? (
                  m.status === "in_progress" ? (
                    <MatchStatusBadge status="in_progress" />
                  ) : (
                    <span className="inline-flex items-center gap-1 tabular">
                      <Clock aria-hidden className="size-3.5" />
                      {formatShortDate(m.scheduledAt)} · {formatTime(m.scheduledAt)}
                    </span>
                  )
                ) : (
                  <span className="tabular">{formatShortDate(m.confirmedAt)}</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Side side={m.a} won={aWon} align="left" />
              <span className="shrink-0 font-display text-lg font-extrabold tabular">
                {mode === "results" ? (
                  <>
                    <span className={aWon ? "text-ink" : "text-ink-3"}>{m.scoreA ?? "–"}</span>
                    <span className="mx-1 text-ink-3">:</span>
                    <span className={bWon ? "text-ink" : "text-ink-3"}>{m.scoreB ?? "–"}</span>
                  </>
                ) : (
                  <span className="text-sm text-ink-3">VS</span>
                )}
              </span>
              <Side side={m.b} won={bWon} align="right" />
            </div>
            {m.isForfeit && <p className="mt-1 text-center text-xs text-ink-3">Victoria por incomparecencia</p>}
          </li>
        );
      })}
    </ul>
  );
}
