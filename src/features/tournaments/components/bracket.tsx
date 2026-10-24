import Link from "next/link";
import type { BracketKind } from "@/domain/competition/types";
import { cn } from "@/lib/cn";
import type { MatchView, ParticipantRef, RoundView } from "../queries";
import { roundLabel } from "./round-label";

const BOX_W = 232;
const ROW_H = 32;
const BOX_H = ROW_H * 2 + 2;
const GAP_Y = 20;
const COL_GAP = 56;
const HEADER = 34;

interface Placed {
  match: MatchView;
  x: number;
  y: number;
}

/**
 * Calcula la posición de cada partido: la primera ronda se apila y cada partido posterior se centra entre
 * los partidos que lo alimentan. Funciona igual para el cuadro de ganadores, el de perdedores (con sus
 * rondas de caída) y la gran final.
 */
function layout(rounds: RoundView[]) {
  const placed = new Map<string, Placed>();
  rounds.forEach((round, col) => {
    const x = col * (BOX_W + COL_GAP);
    const ordered = [...round.matches].sort((a, b) => a.position - b.position);
    let fallbackY = HEADER;
    for (const match of ordered) {
      const feeders = [...placed.values()].filter((p) => p.match.nextMatchId === match.id);
      const y = feeders.length > 0 ? feeders.reduce((sum, f) => sum + f.y, 0) / feeders.length : fallbackY;
      placed.set(match.id, { match, x, y });
      fallbackY = Math.max(fallbackY, y) + BOX_H + GAP_Y;
    }
  });
  const all = [...placed.values()];
  const width = rounds.length * (BOX_W + COL_GAP) - COL_GAP;
  const height = Math.max(...all.map((p) => p.y + BOX_H), HEADER + BOX_H) + 8;
  return { placed, width, height };
}

function SlotRow({
  participant,
  dead,
  score,
  winner,
  decided,
}: {
  participant: ParticipantRef | null;
  dead: boolean;
  score: number | null;
  winner: boolean;
  decided: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2.5",
        winner ? "bg-surface font-bold text-ink" : decided ? "text-ink-3" : "text-ink-2",
      )}
      style={{ height: ROW_H }}
    >
      <span className={cn("h-4 w-0.5 rounded-full", winner ? "bg-brand" : "bg-transparent")} aria-hidden />
      <span className="w-5 shrink-0 text-right text-[11px] text-ink-3 tabular">{participant?.seed ?? ""}</span>
      <span className="min-w-0 flex-1 truncate text-sm">
        {participant ? participant.name : dead ? <span className="text-ink-3 italic">BYE</span> : <span className="text-ink-3">Por decidir</span>}
      </span>
      <span className="w-5 shrink-0 text-right font-display text-base tabular">{score ?? ""}</span>
    </div>
  );
}

function MatchBox({ match, slug }: { match: MatchView; slug: string }) {
  const decided = match.status === "confirmed";
  const aWin = decided && match.winnerId !== null && match.winnerId === match.a?.id;
  const bWin = decided && match.winnerId !== null && match.winnerId === match.b?.id;
  const live = match.status === "in_progress" || match.status === "awaiting_validation" || match.status === "disputed";
  const content = (
    <>
      <SlotRow participant={match.a} dead={match.aDead} score={match.isBye ? null : match.scoreA} winner={aWin} decided={decided} />
      <div className="h-px bg-line" />
      <SlotRow participant={match.b} dead={match.bDead} score={match.isBye ? null : match.scoreB} winner={bWin} decided={decided} />
      {live && (
        <span
          className={cn("absolute -top-1.5 -right-1.5 size-3 rounded-full ring-2 ring-surface", match.status === "disputed" ? "bg-danger" : match.status === "in_progress" ? "animate-pulse-dot bg-live" : "bg-warning")}
          aria-hidden
        />
      )}
    </>
  );
  const box = "relative block overflow-hidden rounded-lg border bg-surface-2/60 shadow-card";
  if (match.status === "void") {
    return (
      <div className={cn(box, "border-dashed border-line opacity-50")} aria-label="Partido que no se disputa">
        {content}
      </div>
    );
  }
  const names = `${match.a?.name ?? "Por decidir"} contra ${match.b?.name ?? (match.bDead ? "BYE" : "Por decidir")}`;
  return (
    <Link href={`/torneos/${slug}/partidos/${match.id}`} className={cn(box, "border-line transition-colors hover:border-ink-3")} aria-label={names}>
      {content}
    </Link>
  );
}

function BracketSection({ title, rounds, slug }: { title?: string; rounds: RoundView[]; slug: string }) {
  if (rounds.length === 0) return null;
  const { placed, width, height } = layout(rounds);
  const lines = [...placed.values()]
    .filter((p) => p.match.nextMatchId && placed.has(p.match.nextMatchId))
    .map((p) => {
      const target = placed.get(p.match.nextMatchId!)!;
      const x1 = p.x + BOX_W;
      const y1 = p.y + BOX_H / 2;
      const x2 = target.x;
      const y2 = target.y + BOX_H / 2;
      const mid = x1 + COL_GAP / 2;
      return { key: p.match.id, d: `M${x1} ${y1} H${mid} V${y2} H${x2}` };
    });
  return (
    <section className="space-y-3">
      {title && <h3 className="font-display text-lg font-bold tracking-wide text-ink-2 uppercase">{title}</h3>}
      <div className="overflow-x-auto pb-3" tabIndex={0} aria-label={title ? `${title} (desplazable)` : "Cuadro (desplazable)"}>
        <div className="relative" style={{ width, height }}>
          <svg className="pointer-events-none absolute inset-0" width={width} height={height} aria-hidden>
            {lines.map((l) => (
              <path key={l.key} d={l.d} fill="none" stroke="var(--color-line-strong)" strokeWidth="1.5" />
            ))}
          </svg>
          {rounds.map((round, col) => (
            <p
              key={round.id}
              className="absolute top-0 truncate text-xs font-bold tracking-wider text-ink-3 uppercase"
              style={{ left: col * (BOX_W + COL_GAP), width: BOX_W }}
            >
              {roundLabel(round.name)} <span className="font-medium normal-case">· Bo{round.bestOf}</span>
            </p>
          ))}
          {[...placed.values()].map((p) => (
            <div key={p.match.id} className="absolute" style={{ left: p.x, top: p.y, width: BOX_W }}>
              <MatchBox match={p.match} slug={slug} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Cuadro eliminatorio completo (simple o doble). */
export function Bracket({ rounds, slug }: { rounds: RoundView[]; slug: string }) {
  const by = (b: BracketKind) => rounds.filter((r) => r.bracket === b);
  const losers = by("losers");
  const grand = by("grand_final").filter((r) => r.matches.some((m) => m.status !== "void") || r.number === 1);
  if (losers.length === 0 && grand.length === 0) return <BracketSection rounds={by("winners")} slug={slug} />;
  return (
    <div className="space-y-8">
      <BracketSection title="Cuadro de ganadores" rounds={by("winners")} slug={slug} />
      <BracketSection title="Cuadro de perdedores" rounds={losers} slug={slug} />
      <BracketSection title="Gran final" rounds={grand} slug={slug} />
    </div>
  );
}
