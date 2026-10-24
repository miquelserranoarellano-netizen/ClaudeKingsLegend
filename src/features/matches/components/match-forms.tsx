"use client";

import { useActionState, useId, useState } from "react";
import { Checkbox, Field, fieldError, FormMessage, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import type { ActionState } from "@/lib/action-state";
import { toDateTimeLocal } from "@/lib/format";
import {
  correctResultAction,
  manualResultAction,
  openDisputeAction,
  reportResultAction,
  resolveDisputeAction,
  scheduleMatchAction,
} from "../actions";

/** Capturas de evidencia: se reducen en el navegador (máx. 1600 px) antes de subirlas. Hasta 4. */
function EvidenceInput() {
  const id = useId();
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []).filter((f) => ["image/png", "image/jpeg", "image/webp"].includes(f.type)).slice(0, 4);
    setBusy(true);
    const transfer = new DataTransfer();
    for (const file of files) {
      try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
        if (blob) transfer.items.add(new File([blob], "captura.webp", { type: blob.type }));
      } catch {
        // Imagen ilegible: se omite.
      }
    }
    input.files = transfer.files;
    setCount(transfer.files.length);
    setBusy(false);
  }
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        Capturas <span className="text-xs font-normal text-ink-3">(opcional, hasta 4)</span>
      </label>
      <input id={id} type="file" name="evidence" accept="image/png,image/jpeg,image/webp" multiple onChange={onChange} className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:font-semibold" />
      <p className="text-xs text-ink-3">{busy ? "Procesando…" : count > 0 ? `${count} imagen(es) lista(s).` : "Solo las verán los dos equipos y la organización."}</p>
    </div>
  );
}

export interface ScoreFormProps {
  mode: "report" | "manual" | "correct";
  matchId: string;
  version: number;
  bestOf: number;
  names: { a: string; b: string };
  players: { userId: string; displayName: string; side: "a" | "b" }[];
  initial?: { scoreA: number | null; scoreB: number | null; isForfeit: boolean; mvpUserId: string | null };
}

const ACTIONS: Record<ScoreFormProps["mode"], (state: ActionState, formData: FormData) => Promise<ActionState>> = {
  report: reportResultAction,
  manual: manualResultAction,
  correct: correctResultAction,
};

export function ScoreForm({ mode, matchId, version, bestOf, names, players, initial }: ScoreFormProps) {
  const [state, formAction] = useActionState(ACTIONS[mode], null);
  const [showGames, setShowGames] = useState(false);
  const needed = Math.floor(bestOf / 2) + 1;
  const options = Array.from({ length: needed + 1 }, (_, i) => i);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="matchId" value={matchId} />
      {mode !== "report" && <input type="hidden" name="version" value={version} />}
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Marcador (al mejor de {bestOf}: gana quien llega a {needed})</legend>
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
          <Field label={names.a} error={fieldError(state, "scoreA")}>
            {(p) => (
              <Select {...p} name="scoreA" defaultValue={initial?.scoreA ?? 0} className="text-center font-display text-lg">
                {options.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </Select>
            )}
          </Field>
          <span className="pb-2 font-display text-xl text-ink-3">:</span>
          <Field label={names.b} error={fieldError(state, "scoreB")}>
            {(p) => (
              <Select {...p} name="scoreB" defaultValue={initial?.scoreB ?? 0} className="text-center font-display text-lg">
                {options.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </fieldset>
      <Checkbox name="isForfeit" defaultChecked={initial?.isForfeit} label="Victoria por incomparecencia" hint={`Marca ${needed}-0 para el equipo que se presentó.`} />
      {bestOf > 1 && (
        <div>
          <button type="button" className="text-sm font-semibold text-brand hover:underline" onClick={() => setShowGames((v) => !v)} aria-expanded={showGames}>
            {showGames ? "Ocultar el detalle de partidas" : "Añadir el ganador de cada partida (opcional)"}
          </button>
          {showGames && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {Array.from({ length: bestOf }, (_, i) => (
                <label key={i} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                  <span className="font-semibold">Partida {i + 1}</span>
                  <select name="games[]" defaultValue="" className="rounded-md border border-line-strong bg-surface px-2 py-1">
                    <option value="">No se jugó</option>
                    <option value="a">{names.a}</option>
                    <option value="b">{names.b}</option>
                  </select>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
      {players.length > 0 && (
        <Field label="MVP" optional error={fieldError(state, "mvpUserId")}>
          {(p) => (
            <Select {...p} name="mvpUserId" defaultValue={initial?.mvpUserId ?? ""}>
              <option value="">Sin MVP</option>
              {(["a", "b"] as const).map((side) => (
                <optgroup key={side} label={names[side]}>
                  {players.filter((pl) => pl.side === side).map((pl) => (
                    <option key={pl.userId} value={pl.userId}>{pl.displayName}</option>
                  ))}
                </optgroup>
              ))}
            </Select>
          )}
        </Field>
      )}
      {mode === "correct" ? (
        <Field label="Motivo de la corrección" hint="Queda en el historial y en el registro de auditoría." error={fieldError(state, "reason")}>
          {(p) => <Textarea {...p} name="reason" required minLength={5} maxLength={500} />}
        </Field>
      ) : (
        <Field label="Notas" optional error={fieldError(state, "notes")}>
          {(p) => <Textarea {...p} name="notes" maxLength={500} className="min-h-16" />}
        </Field>
      )}
      {mode === "report" && (
        <>
          <EvidenceInput />
          <Field label="Enlace a vídeo o captura" optional hint="Solo enlaces https://." error={fieldError(state, "evidenceUrl")}>
            {(p) => <Input {...p} name="evidenceUrl" type="url" placeholder="https://" />}
          </Field>
        </>
      )}
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Enviando…" variant={mode === "correct" ? "danger" : "primary"}>
        {mode === "report" ? "Enviar resultado" : mode === "manual" ? "Registrar y confirmar" : "Corregir resultado"}
      </SubmitButton>
    </form>
  );
}

export function ScheduleForm({ matchId, version, scheduledAt }: { matchId: string; version: number; scheduledAt: Date | null }) {
  const [state, formAction] = useActionState(scheduleMatchAction, null);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="matchId" value={matchId} />
      <input type="hidden" name="version" value={version} />
      <Field label="Fecha y hora" hint="Hora peninsular española. Déjalo vacío para quitar la fecha." error={fieldError(state, "scheduledAt")}>
        {(p) => <Input {...p} name="scheduledAt" type="datetime-local" defaultValue={toDateTimeLocal(scheduledAt)} />}
      </Field>
      <FormMessage state={state} />
      <SubmitButton variant="outline" pendingLabel="Guardando…">Guardar horario</SubmitButton>
    </form>
  );
}

export function DisputeForm({ matchId, resultId }: { matchId: string; resultId: string | null }) {
  const [state, formAction] = useActionState(openDisputeAction, null);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="matchId" value={matchId} />
      {resultId && <input type="hidden" name="resultId" value={resultId} />}
      <Field label="¿Qué ha pasado?" hint="Explica la incidencia con detalle: hora, partida, jugadores implicados." error={fieldError(state, "reason")}>
        {(p) => <Textarea {...p} name="reason" required minLength={10} maxLength={1000} />}
      </Field>
      <EvidenceInput />
      <Field label="Enlace a vídeo o captura" optional error={fieldError(state, "evidenceUrl")}>
        {(p) => <Input {...p} name="evidenceUrl" type="url" placeholder="https://" />}
      </Field>
      <FormMessage state={state} />
      <SubmitButton variant="danger" pendingLabel="Enviando…">Abrir disputa</SubmitButton>
    </form>
  );
}

export function ResolveDisputeForm({ disputeId }: { disputeId: string }) {
  const [state, formAction] = useActionState(resolveDisputeAction, null);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="disputeId" value={disputeId} />
      <Field label="Resolución" hint="La verán los dos equipos." error={fieldError(state, "resolution")}>
        {(p) => <Textarea {...p} name="resolution" required minLength={5} maxLength={1000} className="min-h-20" />}
      </Field>
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="outcome" value="resolved">Resolver</SubmitButton>
        <SubmitButton name="outcome" value="rejected" variant="outline">Desestimar</SubmitButton>
      </div>
    </form>
  );
}
