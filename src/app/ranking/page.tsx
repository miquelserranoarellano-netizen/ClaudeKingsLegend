import { BarChart3, Crown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageHeader } from "@/components/layout/section";
import { TeamLogo } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { DemoBadge } from "@/components/ui/status-badge";
import { teamRanking } from "@/features/competition/queries";

export const metadata: Metadata = {
  title: "Ranking de equipos",
  description: "Clasificación de equipos de Kings Legend calculada con los partidos confirmados de torneos públicos.",
  alternates: { canonical: "/ranking" },
};
export const dynamic = "force-dynamic";

export default async function RankingPage() {
  const rows = await teamRanking(100);
  return (
    <>
      <PageHeader
        eyebrow="Clasificación general"
        title="Ranking de equipos"
        description="Se calcula con todos los partidos confirmados en torneos públicos (los pases por BYE no cuentan). Orden: títulos, victorias, porcentaje de victorias y menos derrotas."
      />
      <Container className="py-8">
        {rows.length === 0 ? (
          <EmptyState icon={BarChart3} title="Aún no hay ranking">
            Aparecerá en cuanto se confirmen los primeros partidos.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card" tabIndex={0} aria-label="Ranking (desplazable)">
            <table className="w-full min-w-[36rem] text-sm">
              <caption className="sr-only">Ranking de equipos</caption>
              <thead className="border-b border-line bg-surface-2/60 text-xs tracking-wide text-ink-3 uppercase">
                <tr>
                  <th scope="col" className="w-14 px-3 py-3 text-center">#</th>
                  <th scope="col" className="px-3 py-3 text-left">Equipo</th>
                  <th scope="col" className="px-3 py-3 text-center">Títulos</th>
                  <th scope="col" className="px-3 py-3 text-center">PJ</th>
                  <th scope="col" className="px-3 py-3 text-center">V</th>
                  <th scope="col" className="px-3 py-3 text-center">D</th>
                  <th scope="col" className="px-3 py-3 text-center">% V</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((row, index) => (
                  <tr key={row.teamId}>
                    <td className="px-3 py-3 text-center font-display text-xl font-extrabold text-ink-3 tabular">{index + 1}</td>
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-3">
                        <TeamLogo name={row.name} tag={row.tag} mediaId={row.logoMediaId} size="sm" />
                        <Link href={`/equipos/${row.slug}`} className="font-semibold hover:text-brand">{row.name}</Link>
                        <span className="text-xs text-ink-3">[{row.tag}]</span>
                        {row.isDemo && <DemoBadge />}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {row.titles > 0 ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-trophy"><Crown aria-hidden className="size-4" />{row.titles}</span>
                      ) : (
                        <span className="text-ink-3">0</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center tabular">{row.played}</td>
                    <td className="px-3 py-3 text-center tabular">{row.wins}</td>
                    <td className="px-3 py-3 text-center tabular">{row.losses}</td>
                    <td className="px-3 py-3 text-center font-semibold tabular">{Math.round((row.wins / Math.max(1, row.played)) * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Container>
    </>
  );
}
