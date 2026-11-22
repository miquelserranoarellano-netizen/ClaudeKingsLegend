import Link from "next/link";
import { TeamLogo } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { MatchView, RoundView, SwissStandingView } from "../queries";
import { roundLabel } from "./round-label";

/**
 * Fase suiza: tabla de balances (quién se ha clasificado, quién está fuera y quién sigue en juego) y las
 * rondas, con cada partido agrupado por el balance con el que llegaban los dos equipos, como en los Worlds.
 */
export function SwissView({ standings, rounds, slug }: { standings: SwissStandingView[]; rounds: RoundView[]; slug: string }) {
  const swissRounds = rounds.filter((r) => r.bracket === "swiss");
  const groups = groupByRecord(swissRounds);
  return (
    <div className="space-y-8">
      <section aria-labelledby="suizo-tabla" className="space-y-3">
        <h2 id="suizo-tabla" className="font-display text-xl font-bold tracking-[0.06em] uppercase">
          Fase suiza
        </h2>
        <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card" tabIndex={0} aria-label="Tabla de la fase suiza (desplazable)">
          <table className="w-full min-w-[30rem] text-sm">
            <caption className="sr-only">Balance de cada participante en la fase suiza</caption>
            <thead className="border-b border-brand/25 bg-night font-display text-xs tracking-[0.16em] text-ink-3 uppercase">
              <tr>
                <th scope="col" className="w-12 px-3 py-2.5 text-center">#</th>
                <th scope="col" className="px-3 py-2.5 text-left">Participante</th>
                <th scope="col" className="px-3 py-2.5 text-center">Balance</th>
                <th scope="col" className="px-3 py-2.5 text-center" title="Suma de las victorias de sus rivales">Calendario</th>
                <th scope="col" className="px-3 py-2.5 text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {standings.map((row, index) => (
                <tr
                  key={row.participantId}
                  className={cn(
                    "transition-colors hover:bg-white/[0.03]",
                    row.status === "advanced" && "bg-[linear-gradient(90deg,rgb(63_217_160/0.08),transparent_60%)]",
                    row.status === "eliminated" && "opacity-60",
                  )}
                >
                  <td className="px-3 py-2.5 text-center font-display text-lg font-extrabold text-ink-3 tabular">{index + 1}</td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-2.5">
                      <TeamLogo name={row.participant.name} tag={row.participant.tag} mediaId={row.participant.logoMediaId} size="xs" />
                      {row.participant.href ? (
                        <Link href={row.participant.href} className="truncate font-semibold hover:text-brand">
                          {row.participant.name}
                        </Link>
                      ) : (
                        <span className="truncate font-semibold">{row.participant.name}</span>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center font-display text-xl font-extrabold text-brand-strong tabular">
                    {row.wins}-{row.losses}
                  </td>
                  <td className="px-3 py-2.5 text-center text-ink-3 tabular">{row.buchholz}</td>
                  <td className="px-3 py-2.5 text-right">
                    {row.status === "advanced" ? (
                      <Badge tone="open">Clasificado</Badge>
                    ) : row.status === "eliminated" ? (
                      <Badge tone="finished">Eliminado</Badge>
                    ) : (
                      <Badge tone="live" dot>
                        En juego
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-ink-3">
          Con 3 victorias se pasa a la eliminatoria; con 3 derrotas se queda fuera. Cada ronda enfrenta a equipos con el mismo balance y
          sin repetir rival. Los partidos decisivos (alguien se clasifica o queda fuera) son más largos. «Calendario» suma las victorias
          de los rivales: ordena a quienes tienen el mismo balance.
        </p>
      </section>

      <section aria-labelledby="suizo-rondas" className="space-y-3">
        <h2 id="suizo-rondas" className="font-display text-xl font-bold tracking-[0.06em] uppercase">
          Rondas
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {groups.map((round) => (
            <div key={round.id} className="rounded-card border border-line bg-surface/80 p-3">
              <h3 className="mb-2 font-display text-sm font-bold tracking-[0.16em] text-hex uppercase">{roundLabel(round.name)}</h3>
              <div className="space-y-3">
                {round.groups.map((group) => (
                  <div key={group.record}>
                    <p className="mb-1 font-display text-xs font-bold tracking-[0.14em] text-ink-3 uppercase">{group.record}</p>
                    <ul className="space-y-1.5">
                      {group.matches.map((m) => (
                        <SwissMatch key={m.id} match={m} slug={slug} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SwissMatch({ match: m, slug }: { match: MatchView; slug: string }) {
  if (m.isBye) {
    return <li className="rounded-sm border border-dashed border-line px-2.5 py-1.5 text-xs text-ink-3">{m.a?.name ?? "—"} descansa (victoria)</li>;
  }
  const done = m.status === "confirmed";
  const side = (p: MatchView["a"], score: number | null, won: boolean) => (
    <span className={cn("flex items-center justify-between gap-2", won ? "font-bold text-ink" : done ? "text-ink-3" : "text-ink-2")}>
      <span className="truncate">{p?.name ?? "Por decidir"}</span>
      <span className={cn("font-display tabular", won && "text-brand-strong")}>{done ? score : ""}</span>
    </span>
  );
  return (
    <li>
      <Link
        href={`/torneos/${slug}/partidos/${m.id}`}
        className={cn(
          "block rounded-sm border bg-night-2/90 px-2.5 py-1.5 text-sm transition-colors hover:border-brand/60",
          m.status === "in_progress" ? "border-live/50" : "border-line-strong",
        )}
      >
        {side(m.a, m.scoreA, done && m.winnerId === m.a?.id)}
        {side(m.b, m.scoreB, done && m.winnerId === m.b?.id)}
        {m.bestOf > 1 && <span className="mt-1 block font-display text-[0.65rem] font-bold tracking-[0.16em] text-warning uppercase">Decisivo · BO{m.bestOf}</span>}
      </Link>
    </li>
  );
}

/** Agrupa los partidos de cada ronda por el balance con el que llegaban los equipos (2-0, 1-1…). */
function groupByRecord(rounds: RoundView[]) {
  const wins = new Map<string, number>();
  const losses = new Map<string, number>();
  const record = (id: string | undefined) => (id ? `${wins.get(id) ?? 0}-${losses.get(id) ?? 0}` : "0-0");
  return [...rounds]
    .sort((x, y) => x.number - y.number)
    .map((round) => {
      const byRecord = new Map<string, MatchView[]>();
      for (const m of round.matches) {
        const key = m.isBye ? "Descanso" : record(m.a?.id);
        byRecord.set(key, [...(byRecord.get(key) ?? []), m]);
      }
      // Después de agrupar, se suma el resultado de esta ronda para la siguiente.
      for (const m of round.matches) {
        if (m.status !== "confirmed" || !m.a) continue;
        const winner = m.isBye ? m.a.id : m.winnerId;
        const loser = m.isBye ? null : winner === m.a.id ? m.b?.id : m.a.id;
        if (winner) wins.set(winner, (wins.get(winner) ?? 0) + 1);
        if (loser) losses.set(loser, (losses.get(loser) ?? 0) + 1);
      }
      const groups = [...byRecord.entries()]
        .sort(([x], [y]) => recordOrder(x) - recordOrder(y))
        .map(([key, list]) => ({ record: key, matches: list }));
      return { id: round.id, name: round.name, groups };
    });
}

/** 2-0 antes que 1-1 y que 0-2; el descanso, al final. */
function recordOrder(key: string): number {
  if (key === "Descanso") return 999;
  const [w, l] = key.split("-").map(Number) as [number, number];
  return -(w - l) * 10 + l;
}
