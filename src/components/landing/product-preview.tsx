import { Trophy } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

/**
 * Vista del producto para la portada: el cuadro de un torneo tal como se ve en Kings Legend, con equipos
 * de ejemplo (lo dice la etiqueta, para no hacer pasar nada por real). Es estática y no enlaza a ninguna
 * parte; los lectores de pantalla la leen como una sola imagen.
 */
interface Slot {
  seed: number;
  name: string;
  score: number;
  win?: boolean;
}
type Match = readonly [Slot, Slot];

const QUARTERS: Match[] = [
  [
    { seed: 1, name: "Lobos del Norte", score: 1, win: true },
    { seed: 8, name: "Nexo Rebelde", score: 0 },
  ],
  [
    { seed: 4, name: "Marea Roja", score: 1, win: true },
    { seed: 5, name: "Centinelas", score: 0 },
  ],
  [
    { seed: 2, name: "Coronas de Hierro", score: 1, win: true },
    { seed: 7, name: "Dragones Pálidos", score: 0 },
  ],
  [
    { seed: 3, name: "Atlas Esports", score: 0 },
    { seed: 6, name: "Vanguardia Azul", score: 1, win: true },
  ],
];
const SEMIS: Match[] = [
  [
    { seed: 1, name: "Lobos del Norte", score: 1, win: true },
    { seed: 4, name: "Marea Roja", score: 0 },
  ],
  [
    { seed: 2, name: "Coronas de Hierro", score: 1, win: true },
    { seed: 6, name: "Vanguardia Azul", score: 0 },
  ],
];
const FINAL: Match = [
  { seed: 1, name: "Lobos del Norte", score: 1 },
  { seed: 2, name: "Coronas de Hierro", score: 1 },
];

const TABS = ["Resumen", "Participantes", "Partidos", "Cuadro", "Reglas"];

export function ProductPreview({ className }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="Vista de ejemplo del cuadro de un torneo en Kings Legend: cuartos, semifinales y una final en directo"
      className={cn("overflow-hidden rounded-card border border-line-strong bg-surface shadow-[0_40px_80px_-40px_rgb(0_0_0/0.9)]", className)}
    >
      <div aria-hidden>
        <div className="flex items-center gap-3 border-b border-line bg-night/80 px-4 py-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-brand/40 bg-brand-soft text-brand-strong">
            <Trophy className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-[0.95rem] font-bold tracking-[0.08em] uppercase">Copa de ejemplo</p>
            <p className="truncate text-xs text-ink-3">Eliminación simple · 8 equipos · Final al mejor de 3</p>
          </div>
          <Badge tone="night" className="ml-auto shrink-0">
            Vista de ejemplo
          </Badge>
        </div>
        <div className="flex gap-1 overflow-hidden border-b border-line px-2">
          {TABS.map((tab) => (
            <span
              key={tab}
              className={cn(
                "shrink-0 border-b-2 px-3 py-2.5 font-display text-[0.8rem] font-bold tracking-[0.12em] uppercase",
                tab === "Cuadro" ? "border-brand text-brand-strong" : "border-transparent text-ink-3",
                tab !== "Cuadro" && tab !== "Partidos" && "hidden sm:inline",
              )}
            >
              {tab}
            </span>
          ))}
        </div>

        <div className="p-4 sm:p-5">
          {/* Cuartos y su conector solo desde 640 px: en el móvil caben semifinales y final. */}
          <div className="grid grid-cols-[minmax(0,1fr)_1.25rem_minmax(0,1fr)] font-display text-[0.7rem] font-bold tracking-[0.16em] text-hex uppercase sm:grid-cols-[minmax(0,1fr)_1.25rem_minmax(0,1fr)_1.25rem_minmax(0,1fr)]">
            <span className="hidden sm:block">Cuartos · Bo1</span>
            <span className="hidden sm:block" />
            <span>Semifinales · Bo1</span>
            <span />
            <span>Final · Bo3</span>
          </div>
          <div className="mt-3 grid h-56 grid-cols-[minmax(0,1fr)_1.25rem_minmax(0,1fr)] sm:h-80 sm:grid-cols-[minmax(0,1fr)_1.25rem_minmax(0,1fr)_1.25rem_minmax(0,1fr)]">
            <Column className="hidden sm:flex">
              {QUARTERS.map((m, i) => (
                <MatchBox key={i} match={m} />
              ))}
            </Column>
            <Column className="hidden sm:flex">
              <Connector span="h-1/4" />
              <Connector span="h-1/4" />
            </Column>
            <Column>
              {SEMIS.map((m, i) => (
                <MatchBox key={i} match={m} />
              ))}
            </Column>
            <Column>
              <Connector span="h-1/2" />
            </Column>
            <Column>
              <MatchBox match={FINAL} live />
            </Column>
          </div>
        </div>
      </div>
    </div>
  );
}

function Column({ children, className }: { children: ReactNode; className?: string }) {
  // Con `justify-around` y cajas iguales, cada partido queda a la altura del punto medio de los dos que lo alimentan.
  return <div className={cn("flex min-w-0 flex-col justify-around", className)}>{children}</div>;
}

/** Corchete que une dos partidos con el siguiente: «]» y un tramo horizontal hasta la caja. */
function Connector({ span }: { span: string }) {
  return (
    <div className={cn("relative", span)}>
      <span className="absolute inset-y-0 left-0 w-1/2 border-y border-r border-brand/35" />
      <span className="absolute top-1/2 right-0 left-1/2 border-t border-brand/35" />
    </div>
  );
}

function MatchBox({ match, live = false }: { match: Match; live?: boolean }) {
  return (
    <div className="relative">
      {live && (
        <Badge tone="live" dot className="absolute -top-7 left-0">
          En directo
        </Badge>
      )}
      <div className={cn("overflow-hidden rounded-sm border bg-night-2/90", live ? "border-live/50 shadow-[0_0_24px_-8px_rgb(255_83_112/0.6)]" : "border-line-strong")}>
        {match.map((slot, i) => (
          <div
            key={slot.seed}
            className={cn(
              "flex h-7 items-center gap-2 px-2 text-[0.8rem]",
              i === 1 && "border-t border-line",
              slot.win ? "bg-[linear-gradient(90deg,rgb(200_170_110/0.18),transparent)] font-bold text-ink" : "text-ink-2",
            )}
          >
            <span className={cn("h-3.5 w-0.5", slot.win ? "bg-brand shadow-[0_0_8px_rgb(200_170_110/0.9)]" : "bg-transparent")} />
            <span className="w-3 shrink-0 text-right text-[10px] text-ink-3 tabular">{slot.seed}</span>
            <span className="min-w-0 flex-1 truncate">{slot.name}</span>
            <span className={cn("font-display text-sm tabular", slot.win && "text-brand-strong")}>{slot.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
