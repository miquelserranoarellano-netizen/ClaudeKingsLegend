"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { scheduleRoundAction } from "../actions";

export function RoundScheduleForm({ roundId }: { roundId: string }) {
  const [state, formAction] = useActionState(scheduleRoundAction, null);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="roundId" value={roundId} />
      <input type="datetime-local" name="scheduledAt" required aria-label="Fecha y hora para toda la ronda" className="h-8 rounded-md border border-line-strong bg-surface px-2 text-sm" />
      <SubmitButton size="sm" variant="outline" pendingLabel="Guardando…">
        Programar la ronda
      </SubmitButton>
      <FormMessage state={state} className="w-full py-1.5" />
    </form>
  );
}
