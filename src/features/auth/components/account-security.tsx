"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/auth-rules";
import type { ActionState } from "@/lib/action-state";

export function ChangePasswordForm() {
  const [state, setState] = useState<ActionState>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const currentPassword = String(form.get("current") ?? "");
    const newPassword = String(form.get("password") ?? "");
    if (newPassword.length < PASSWORD_MIN || newPassword.length > PASSWORD_MAX) {
      setState({ ok: false, error: `La contraseña nueva debe tener entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres.` });
      return;
    }
    if (newPassword !== form.get("confirm")) {
      setState({ ok: false, error: "Las contraseñas nuevas no coinciden." });
      return;
    }
    setPending(true);
    const { error } = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
    setPending(false);
    if (error) {
      setState({ ok: false, error: error.code === "INVALID_PASSWORD" ? "La contraseña actual no es correcta." : authErrorMessage(error) });
      return;
    }
    formElement.reset();
    setState({ ok: true, message: "Contraseña cambiada. Se han cerrado tus sesiones en otros dispositivos." });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Contraseña actual">{(p) => <Input {...p} name="current" type="password" autoComplete="current-password" required />}</Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contraseña nueva" hint={`Al menos ${PASSWORD_MIN} caracteres.`}>
          {(p) => <Input {...p} name="password" type="password" autoComplete="new-password" required />}
        </Field>
        <Field label="Repite la nueva">{(p) => <Input {...p} name="confirm" type="password" autoComplete="new-password" required />}</Field>
      </div>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Cambiar contraseña"}
      </Button>
    </form>
  );
}

export function RevokeSessionsButton() {
  const router = useRouter();
  const [state, setState] = useState<ActionState>(null);
  const [pending, setPending] = useState(false);
  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          const { error } = await authClient.revokeOtherSessions();
          setPending(false);
          setState(error ? { ok: false, error: authErrorMessage(error) } : { ok: true, message: "Se han cerrado las demás sesiones." });
          router.refresh();
        }}
      >
        {pending ? "Cerrando…" : "Cerrar sesión en los demás dispositivos"}
      </Button>
      <FormMessage state={state} />
    </div>
  );
}
