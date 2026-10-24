"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import type { ActionState } from "@/lib/action-state";

export function SignInForm({ next }: { next: string }) {
  const router = useRouter();
  const [state, setState] = useState<ActionState>(null);
  const [pending, setPending] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!email || !password) {
      setState({ ok: false, error: "Escribe tu correo y tu contraseña." });
      return;
    }
    setPending(true);
    setState(null);
    const { error } = await authClient.signIn.email({ email, password, callbackURL: next });
    setPending(false);
    if (error) {
      setUnverifiedEmail(error.code === "EMAIL_NOT_VERIFIED" ? email : null);
      setState({ ok: false, error: authErrorMessage(error) });
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Correo electrónico">{(p) => <Input {...p} name="email" type="email" autoComplete="email" required />}</Field>
      <Field label="Contraseña">{(p) => <Input {...p} name="password" type="password" autoComplete="current-password" required />}</Field>
      <FormMessage state={state} />
      {unverifiedEmail && (
        <Button
          variant="outline"
          className="w-full"
          onClick={async () => {
            await authClient.sendVerificationEmail({ email: unverifiedEmail, callbackURL: next });
            setState({ ok: true, message: "Te hemos enviado otro enlace de confirmación." });
          }}
        >
          Reenviar el correo de confirmación
        </Button>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
