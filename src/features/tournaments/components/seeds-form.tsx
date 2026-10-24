"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { setSeedsAction } from "../actions";

export function SeedsForm({ tournamentId, participants }: { tournamentId: string; participants: { id: string; name: string; seed: number | null }[] }) {
  const [state, formAction] = useActionState(setSeedsAction, null);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="tournamentId" value={tournamentId} />
      <ol className="divide-y divide-line rounded-lg border border-line">
        {participants.map((p, index) => (
          <li key={p.id} className="flex items-center gap-3 px-3 py-2">
            <input type="hidden" name="participant" value={p.id} />
            <label className="flex flex-1 items-center gap-3 text-sm">
              <input
                type="number"
                name="seed"
                min={1}
                max={participants.length}
                defaultValue={p.seed ?? index + 1}
                className="h-9 w-16 rounded-md border border-line-strong bg-surface px-2 text-center tabular"
                aria-label={`Semilla de ${p.name}`}
              />
              <span className="font-medium">{p.name}</span>
            </label>
          </li>
        ))}
      </ol>
      <p className="text-xs text-ink-3">1 = mejor cabeza de serie. Las semillas más altas reciben los BYE y no se cruzan entre sí hasta el final.</p>
      <FormMessage state={state} />
      <SubmitButton variant="outline" size="sm" pendingLabel="Guardando…">Guardar semillas</SubmitButton>
    </form>
  );
}
