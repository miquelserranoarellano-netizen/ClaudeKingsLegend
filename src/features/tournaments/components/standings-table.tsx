import Link from "next/link";
import { TeamLogo } from "@/components/ui/avatar";
import { label } from "@/i18n";
import { cn } from "@/lib/cn";
import type { StandingView } from "../queries";

export function StandingsTable({
  rows,
  tiebreakers,
  points,
  compact = false,
}: {
  rows: StandingView[];
  tiebreakers: string[];
  points: { win: number; loss: number; forfeitLoss: number };
  compact?: boolean;
}) {
  const unresolved = rows.some((r) => r.decidedBySeed && r.played > 0);
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card" tabIndex={0} aria-label="Clasificación (desplazable)">
        <table className="w-full min-w-[34rem] text-sm">
          <caption className="sr-only">Clasificación de la liga</caption>
          <thead className="border-b border-line bg-surface-2/60 text-xs tracking-wide text-ink-3 uppercase">
            <tr>
              <th scope="col" className="w-12 px-3 py-2.5 text-center">#</th>
              <th scope="col" className="px-3 py-2.5 text-left">Participante</th>
              <th scope="col" className="px-2 py-2.5 text-center" title="Partidos jugados">PJ</th>
              <th scope="col" className="px-2 py-2.5 text-center" title="Victorias">V</th>
              <th scope="col" className="px-2 py-2.5 text-center" title="Derrotas">D</th>
              {!compact && (
                <>
                  <th scope="col" className="px-2 py-2.5 text-center" title="Partidas ganadas">PG</th>
                  <th scope="col" className="px-2 py-2.5 text-center" title="Partidas perdidas">PP</th>
                </>
              )}
              <th scope="col" className="px-2 py-2.5 text-center" title="Diferencia de partidas">Dif.</th>
              <th scope="col" className="px-3 py-2.5 text-center">Pts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr key={row.participantId} className={cn(row.position === 1 && row.played > 0 && "bg-trophy-soft/50")}>
                <td className="px-3 py-2.5 text-center font-display text-lg font-extrabold tabular">
                  {row.position}
                  {row.decidedBySeed && row.played > 0 ? <span className="text-warning" title="Empate resuelto por semilla">*</span> : null}
                </td>
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
                <td className="px-2 py-2.5 text-center tabular">{row.played}</td>
                <td className="px-2 py-2.5 text-center tabular">{row.wins}</td>
                <td className="px-2 py-2.5 text-center tabular">{row.losses}</td>
                {!compact && (
                  <>
                    <td className="px-2 py-2.5 text-center tabular">{row.gamesWon}</td>
                    <td className="px-2 py-2.5 text-center tabular">{row.gamesLost}</td>
                  </>
                )}
                <td className="px-2 py-2.5 text-center tabular">{row.gameDifference > 0 ? `+${row.gameDifference}` : row.gameDifference}</td>
                <td className="px-3 py-2.5 text-center font-display text-lg font-extrabold tabular">{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!compact && (
        <p className="text-xs text-ink-3">
          Victoria {points.win} pts · derrota {points.loss} pts · derrota por incomparecencia {points.forfeitLoss} pts. Desempates, en orden:{" "}
          {tiebreakers.length > 0 ? tiebreakers.map((tb) => label("tiebreaker", tb as "wins").toLowerCase()).join(", ") : "ninguno"}; después, la
          semilla.
          {unresolved && " * Puesto decidido por semilla: ningún desempate lo resolvió."}
        </p>
      )}
    </div>
  );
}
