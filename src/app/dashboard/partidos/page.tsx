import { CalendarClock, History } from "lucide-react";
import { DashboardTitle } from "@/components/layout/dashboard-title";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MatchList } from "@/features/competition/components/match-list";
import { myMatches } from "@/features/competition/queries";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "Mis partidos" };

export default async function MyMatchesPage() {
  const user = await requireUser("/dashboard/partidos");
  const [upcoming, played] = await Promise.all([myMatches(user.id, "upcoming", 50), myMatches(user.id, "played", 30)]);
  return (
    <>
      <DashboardTitle title="Mis partidos" description="Abre un partido para ver los detalles, comunicar el resultado o abrir una disputa (si eres capitán)." />
      <div className="space-y-6">
        <Card className="overflow-hidden">
          <CardHeader title="Pendientes" />
          {upcoming.length > 0 ? (
            <MatchList items={upcoming} mode="upcoming" />
          ) : (
            <div className="p-4">
              <EmptyState icon={CalendarClock} title="Nada pendiente" compact>
                No tienes partidos por jugar en este momento.
              </EmptyState>
            </div>
          )}
        </Card>
        <Card className="overflow-hidden">
          <CardHeader title="Jugados" />
          {played.length > 0 ? (
            <MatchList items={played} mode="results" />
          ) : (
            <div className="p-4">
              <EmptyState icon={History} title="Sin historial" compact>
                Aquí aparecerán tus partidos con resultado confirmado.
              </EmptyState>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
