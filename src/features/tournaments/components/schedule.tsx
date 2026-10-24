import Link from "next/link";
import { TeamLogo } from "@/components/ui/avatar";
import { MatchStatusBadge } from "@/components/ui/status-badge";
import { formatShortDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { MatchView, ParticipantRef, RoundView } from "../queries";
import { roundLabel } from "./round-label";

function Side({ p, dead, won, right }: { p: ParticipantRef | null; dead: boolean; won: boolean; right?: boolean }) {
  return (
    <span className={cn("flex min-w-0 flex-1 items-center gap-2", right && "flex-row-reverse text-right")}>
      <TeamLogo name={p?.name ?? "?"} tag={p?.tag} mediaId={p?.logoMediaId} size="xs" />
      <span className={cn("truncate text-sm", won ? "font-bold" : "text-ink-2")}>{p?.name ?? (dead ? "BYE" : "Por decidir")}</span>
    </span>
  );
}

function Row({ match, slug }: { match: MatchView; slug: string }) {
  const decided = match.status === "confirmed";
  const aWon = decided && match.winnerId === match.a?.id;
  const bWon = decided && match.winnerId === match.b?.id;
  return (
    <li className="relative grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-surface-2/60 sm:grid-cols-[7rem_1fr_auto]">
      <span className="text-xs text-ink-3 tabular sm:text-sm">
        {match.scheduledAt ? `${formatShortDate(match.scheduledAt)} · ${formatTime(match.scheduledAt)}` : "Sin fecha"}
      </span>
      <span className="col-span-2 flex items-center gap-3 sm:col-span-1">
        <Side p={match.a} dead={match.aDead} won={aWon} />
        <Link
          href={`/torneos/${slug}/partidos/${match.id}`}
          className="shrink-0 font-display text-base font-extrabold tabular after:absolute after:inset-0"
          aria-label={`Ver partido: ${match.a?.name ?? "por decidir"} contra ${match.b?.name ?? "por decidir"}`}
        >
          {decided && !match.isBye ? `${match.scoreA ?? 0} : ${match.scoreB ?? 0}` : <span className="text-sm text-ink-3">VS</span>}
        </Link>
        <Side p={match.b} dead={match.bDead} won={bWon} right />
      </span>
      <span className="row-start-1 justify-self-end sm:row-start-auto">
        {match.isBye ? <span className="text-xs text-ink-3">Pasa por BYE</span> : <MatchStatusBadge status={match.status} />}
      </span>
    </li>
  );
}

/** Calendario: partidos agrupados por ronda o jornada. */
export function Schedule({ rounds, slug }: { rounds: RoundView[]; slug: string }) {
  return (
    <div className="space-y-6">
      {rounds.map((round) => {
        const visible = round.matches.filter((m) => m.status !== "void");
        if (visible.length === 0) return null;
        return (
          <section key={round.id} aria-label={roundLabel(round.name)}>
            <h3 className="mb-2 flex items-baseline gap-2 font-display text-lg font-bold uppercase">
              {roundLabel(round.name)} <span className="text-xs font-semibold text-ink-3 normal-case">al mejor de {round.bestOf}</span>
            </h3>
            <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-card">
              {visible.map((match) => (
                <Row key={match.id} match={match} slug={slug} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
