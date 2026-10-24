"use client";

import { useActionState, useEffect, useRef } from "react";
import { Field, fieldError, FormMessage, Input, SubmitButton } from "@/components/ui/form";
import { inviteMemberAction } from "../actions";

export function InviteForm({ teamId }: { teamId: string }) {
  const [state, formAction] = useActionState(inviteMemberAction, null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={formAction} className="space-y-4">
      <input type="hidden" name="teamId" value={teamId} />
      <Field label="Identificador del jugador" hint="El que aparece en su perfil público, por ejemplo @ana-mid." error={fieldError(state, "handle")}>
        {(p) => <Input {...p} name="handle" placeholder="@identificador" required autoComplete="off" />}
      </Field>
      <Field label="Mensaje" optional error={fieldError(state, "message")}>
        {(p) => <Input {...p} name="message" maxLength={200} placeholder="¡Te queremos de jungla!" />}
      </Field>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Enviando…">Enviar invitación</SubmitButton>
    </form>
  );
}
