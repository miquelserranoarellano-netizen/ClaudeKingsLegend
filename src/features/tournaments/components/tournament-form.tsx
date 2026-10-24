"use client";

import { useActionState, useState } from "react";
import { mediaUrl } from "@/components/ui/avatar";
import { Checkbox, Field, fieldError, FormMessage, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { ImageInput } from "@/components/ui/image-input";
import { TIEBREAKERS } from "@/domain/competition/standings";
import { label } from "@/i18n";
import { toDateTimeLocal } from "@/lib/format";
import { REGIONS } from "@/lib/lol";
import { createTournamentAction, updateTournamentAction } from "../actions";

export interface TournamentFormValues {
  id: string;
  version: number;
  status: string;
  name: string;
  summary: string | null;
  description: string | null;
  rulesText: string | null;
  prizeDescription: string | null;
  format: "single_elimination" | "double_elimination" | "league";
  participantType: "team" | "solo";
  visibility: "public" | "private";
  region: string | null;
  registrationOpensAt: Date;
  registrationClosesAt: Date;
  startsAt: Date;
  endsAt: Date | null;
  minParticipants: number;
  maxParticipants: number;
  bannerMediaId: string | null;
  teamSize: number;
  maxSubstitutes: number;
  bestOf: number;
  bestOfFinal: number;
  pointsWin: number;
  pointsLoss: number;
  pointsForfeitLoss: number;
  tiebreakers: string[];
  leagueLegs: number;
  grandFinalReset: boolean;
  approvalMode: "manual" | "automatic";
  waitlistEnabled: boolean;
  requireRiotId: boolean;
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-card">
      <legend className="sr-only">{title}</legend>
      <div>
        <h2 className="font-display text-xl font-bold uppercase">{title}</h2>
        {description && <p className="text-sm text-ink-3">{description}</p>}
      </div>
      {children}
    </fieldset>
  );
}

const BEST_OF = [1, 3, 5, 7];

export function TournamentForm({ tournament }: { tournament?: TournamentFormValues }) {
  const [state, formAction] = useActionState(tournament ? updateTournamentAction : createTournamentAction, null);
  const [format, setFormat] = useState(tournament?.format ?? "single_elimination");
  const [participantType, setParticipantType] = useState(tournament?.participantType ?? "team");
  const locked = tournament?.status === "in_progress";
  const err = (name: string) => fieldError(state, name);
  const now = new Date();
  const defaults = {
    opens: tournament?.registrationOpensAt ?? now,
    closes: tournament?.registrationClosesAt ?? new Date(now.getTime() + 7 * 864e5),
    starts: tournament?.startsAt ?? new Date(now.getTime() + 9 * 864e5),
  };
  const tiebreakers = tournament?.tiebreakers ?? ["head_to_head", "game_difference", "games_won"];

  return (
    <form action={formAction} className="space-y-6">
      {tournament && (
        <>
          <input type="hidden" name="tournamentId" value={tournament.id} />
          <input type="hidden" name="version" value={tournament.version} />
        </>
      )}
      {locked && (
        <p className="rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning">
          La competición ha empezado: el formato, las plazas y las reglas de las series ya no se pueden cambiar. Puedes
          corregir textos, fechas informativas y premios.
        </p>
      )}

      <Section title="Información" description="Lo que verán los jugadores en la tarjeta y en la página del torneo.">
        <Field label="Nombre" error={err("name")}>{(p) => <Input {...p} name="name" defaultValue={tournament?.name} required minLength={3} maxLength={80} />}</Field>
        <Field label="Resumen" optional hint="Una frase para la tarjeta (máx. 160)." error={err("summary")}>
          {(p) => <Input {...p} name="summary" defaultValue={tournament?.summary ?? ""} maxLength={160} />}
        </Field>
        <Field label="Descripción" optional error={err("description")}>
          {(p) => <Textarea {...p} name="description" defaultValue={tournament?.description ?? ""} maxLength={5000} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Premios" optional hint="Déjalo vacío si no hay premio." error={err("prizeDescription")}>
            {(p) => <Textarea {...p} name="prizeDescription" defaultValue={tournament?.prizeDescription ?? ""} maxLength={1000} className="min-h-16" />}
          </Field>
          <Field label="Servidor" optional error={err("region")}>
            {(p) => (
              <Select {...p} name="region" defaultValue={tournament?.region ?? "EUW"}>
                <option value="">Sin indicar</option>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <ImageInput
          name="banner"
          label="Banner"
          hint="Horizontal (16:7). Se reduce a 1600 px. Sin banner se genera un diseño geométrico."
          maxSize={1600}
          shape="banner"
          currentUrl={tournament?.bannerMediaId ? mediaUrl(tournament.bannerMediaId) : null}
        />
        {tournament?.bannerMediaId && <Checkbox name="removeBanner" label="Quitar el banner actual" />}
      </Section>

      <Section title="Formato de competición">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Formato" error={err("format")}>
            {(p) => (
              <Select {...p} name="format" value={format} disabled={locked} onChange={(e) => setFormat(e.target.value as typeof format)}>
                {(["single_elimination", "double_elimination", "league"] as const).map((f) => (
                  <option key={f} value={f}>{label("format", f)}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Participantes" error={err("participantType")}>
            {(p) => (
              <Select {...p} name="participantType" value={participantType} disabled={locked} onChange={(e) => setParticipantType(e.target.value as typeof participantType)}>
                <option value="team">{label("participantType", "team")}</option>
                <option value="solo">{label("participantType", "solo")}</option>
              </Select>
            )}
          </Field>
          {/* Los <select> desactivados no se envían: se repite el valor en un campo oculto. */}
          {locked && (
            <>
              <input type="hidden" name="format" value={format} />
              <input type="hidden" name="participantType" value={participantType} />
            </>
          )}
          <Field label="Series" hint="Al mejor de…" error={err("bestOf")}>
            {(p) => (
              <Select {...p} name="bestOf" defaultValue={tournament?.bestOf ?? 1} disabled={locked}>
                {BEST_OF.map((b) => (
                  <option key={b} value={b}>Bo{b}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={format === "league" ? "Series (sin uso en liga)" : format === "double_elimination" ? "Gran final" : "Final"} error={err("bestOfFinal")}>
            {(p) => (
              <Select {...p} name="bestOfFinal" defaultValue={tournament?.bestOfFinal ?? 3} disabled={locked || format === "league"}>
                {BEST_OF.map((b) => (
                  <option key={b} value={b}>Bo{b}</option>
                ))}
              </Select>
            )}
          </Field>
          {locked && (
            <>
              <input type="hidden" name="bestOf" value={tournament?.bestOf} />
              <input type="hidden" name="bestOfFinal" value={tournament?.bestOfFinal} />
            </>
          )}
          {format === "league" && !locked && <input type="hidden" name="bestOfFinal" value={tournament?.bestOfFinal ?? 3} />}
        </div>

        {participantType === "team" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Titulares por equipo" error={err("teamSize")}>
              {(p) => <Input {...p} name="teamSize" type="number" min={1} max={5} defaultValue={tournament?.teamSize ?? 5} readOnly={locked} />}
            </Field>
            <Field label="Suplentes máximos" error={err("maxSubstitutes")}>
              {(p) => <Input {...p} name="maxSubstitutes" type="number" min={0} max={5} defaultValue={tournament?.maxSubstitutes ?? 2} readOnly={locked} />}
            </Field>
          </div>
        ) : (
          <>
            <input type="hidden" name="teamSize" value="1" />
            <input type="hidden" name="maxSubstitutes" value="0" />
          </>
        )}

        {format === "double_elimination" ? (
          <Checkbox
            name="grandFinalReset"
            defaultChecked={tournament?.grandFinalReset ?? true}
            disabled={locked}
            label="Reinicio de la gran final"
            hint="Si gana quien llega del cuadro de perdedores, se juega otra serie: el campeón de ganadores aún no había perdido."
          />
        ) : (
          <input type="hidden" name="grandFinalReset" value={tournament?.grandFinalReset === false ? "false" : "on"} />
        )}
        {locked && format === "double_elimination" && <input type="hidden" name="grandFinalReset" value={tournament?.grandFinalReset ? "on" : "false"} />}

        {format === "league" ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="Vueltas" error={err("leagueLegs")}>
                {(p) => (
                  <Select {...p} name="leagueLegs" defaultValue={tournament?.leagueLegs ?? 1} disabled={locked}>
                    <option value={1}>Solo ida</option>
                    <option value={2}>Ida y vuelta</option>
                  </Select>
                )}
              </Field>
              <Field label="Pts. victoria" error={err("pointsWin")}>{(p) => <Input {...p} name="pointsWin" type="number" min={0} max={10} defaultValue={tournament?.pointsWin ?? 3} />}</Field>
              <Field label="Pts. derrota" error={err("pointsLoss")}>{(p) => <Input {...p} name="pointsLoss" type="number" min={-5} max={10} defaultValue={tournament?.pointsLoss ?? 0} />}</Field>
              <Field label="Pts. incomparecencia" error={err("pointsForfeitLoss")}>
                {(p) => <Input {...p} name="pointsForfeitLoss" type="number" min={-5} max={10} defaultValue={tournament?.pointsForfeitLoss ?? 0} />}
              </Field>
            </div>
            {locked && <input type="hidden" name="leagueLegs" value={tournament?.leagueLegs} />}
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Desempates, en orden de aplicación</legend>
              <div className="grid gap-2 sm:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <select key={i} name="tiebreakers[]" defaultValue={tiebreakers[i] ?? ""} aria-label={`Desempate ${i + 1}`} className="h-10 rounded-lg border border-line-strong bg-surface px-3 text-sm">
                    <option value="">—</option>
                    {TIEBREAKERS.map((tb) => (
                      <option key={tb} value={tb}>{i + 1}. {label("tiebreaker", tb)}</option>
                    ))}
                  </select>
                ))}
              </div>
              <p className="mt-1 text-xs text-ink-3">Si nada deshace el empate, decide la semilla (orden de aprobación).</p>
            </fieldset>
          </div>
        ) : (
          <>
            <input type="hidden" name="leagueLegs" value={tournament?.leagueLegs ?? 1} />
            <input type="hidden" name="pointsWin" value={tournament?.pointsWin ?? 3} />
            <input type="hidden" name="pointsLoss" value={tournament?.pointsLoss ?? 0} />
            <input type="hidden" name="pointsForfeitLoss" value={tournament?.pointsForfeitLoss ?? 0} />
            {tiebreakers.map((tb) => (
              <input key={tb} type="hidden" name="tiebreakers[]" value={tb} />
            ))}
          </>
        )}
      </Section>

      <Section title="Inscripciones y fechas" description="Horas en horario peninsular español.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Abren" error={err("registrationOpensAt")}>
            {(p) => <Input {...p} name="registrationOpensAt" type="datetime-local" defaultValue={toDateTimeLocal(defaults.opens)} required />}
          </Field>
          <Field label="Cierran" error={err("registrationClosesAt")}>
            {(p) => <Input {...p} name="registrationClosesAt" type="datetime-local" defaultValue={toDateTimeLocal(defaults.closes)} required />}
          </Field>
          <Field label="Empieza la competición" error={err("startsAt")}>
            {(p) => <Input {...p} name="startsAt" type="datetime-local" defaultValue={toDateTimeLocal(defaults.starts)} required />}
          </Field>
          <Field label="Fin previsto" optional error={err("endsAt")}>
            {(p) => <Input {...p} name="endsAt" type="datetime-local" defaultValue={toDateTimeLocal(tournament?.endsAt)} />}
          </Field>
          <Field label="Mínimo de participantes" error={err("minParticipants")}>
            {(p) => <Input {...p} name="minParticipants" type="number" min={2} max={256} defaultValue={tournament?.minParticipants ?? 4} readOnly={locked} />}
          </Field>
          <Field label="Máximo de participantes" error={err("maxParticipants")}>
            {(p) => <Input {...p} name="maxParticipants" type="number" min={2} max={256} defaultValue={tournament?.maxParticipants ?? 16} readOnly={locked} />}
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Aprobación de inscripciones" error={err("approvalMode")}>
            {(p) => (
              <Select {...p} name="approvalMode" defaultValue={tournament?.approvalMode ?? "manual"}>
                <option value="manual">{label("approvalMode", "manual")}</option>
                <option value="automatic">{label("approvalMode", "automatic")}</option>
              </Select>
            )}
          </Field>
          <Field label="Visibilidad" error={err("visibility")}>
            {(p) => (
              <Select {...p} name="visibility" defaultValue={tournament?.visibility ?? "public"}>
                <option value="public">Público (aparece en el explorador)</option>
                <option value="private">Privado (solo con enlace de invitación)</option>
              </Select>
            )}
          </Field>
        </div>
        <div className="space-y-3">
          <Checkbox name="waitlistEnabled" defaultChecked={tournament?.waitlistEnabled ?? true} label="Lista de espera" hint="Con las plazas llenas, las nuevas inscripciones esperan turno y entran solas si alguien se retira." />
          <Checkbox name="requireRiotId" defaultChecked={tournament?.requireRiotId ?? true} label="Exigir Riot ID" hint="Todos los jugadores inscritos deben tener un Riot ID en su perfil." />
        </div>
      </Section>

      <Section title="Reglamento" description="Normas propias del torneo: horarios, comportamiento, elección de lado, pausas, sanciones…">
        <Field label="Texto del reglamento" optional error={err("rulesText")}>
          {(p) => <Textarea {...p} name="rulesText" defaultValue={tournament?.rulesText ?? ""} maxLength={10000} className="min-h-48" />}
        </Field>
      </Section>

      <FormMessage state={state} />
      <div className="flex flex-wrap gap-3">
        <SubmitButton size="lg" pendingLabel="Guardando…">{tournament ? "Guardar cambios" : "Crear borrador"}</SubmitButton>
        {!tournament && <p className="self-center text-sm text-ink-3">Se crea como borrador: nadie lo verá hasta que lo publiques.</p>}
      </div>
    </form>
  );
}
