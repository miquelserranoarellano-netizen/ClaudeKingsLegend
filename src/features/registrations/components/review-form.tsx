"use client";

import { useActionState } from "react";
import { FormMessage, Input, SubmitButton } from "@/components/ui/form";
import { reviewRegistrationAction } from "../actions";

/** Aprobar, rechazar o mandar a la lista de espera una inscripción, con un motivo opcional. */
export function ReviewForm({ registrationId, status }: { registrationId: string; status: string }) {
  const [state, formAction] = useActionState(reviewRegistrationAction, null);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="registrationId" value={registrationId} />
      <Input name="reason" placeholder="Motivo (opcional, lo verá el equipo)" maxLength={300} aria-label="Motivo" className="h-9" />
      <div className="flex flex-wrap gap-2">
        {status !== "approved" && (
          <SubmitButton name="decision" value="approve" size="sm">
            Aprobar
          </SubmitButton>
        )}
        {status === "pending" && (
          <SubmitButton name="decision" value="waitlist" size="sm" variant="outline">
            A lista de espera
          </SubmitButton>
        )}
        <SubmitButton name="decision" value="reject" size="sm" variant="ghost">
          {status === "approved" ? "Retirar del torneo" : "Rechazar"}
        </SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
