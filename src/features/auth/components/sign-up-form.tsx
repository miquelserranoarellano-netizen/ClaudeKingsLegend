"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormMessage, Input } from "@/components/ui/form";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/auth-rules";
import type { ActionState } from "@/lib/action-state";

export function SignUpForm({ next, verificationRequired }: { next: string; verificationRequired: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<ActionState>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");

    // Validación en el navegador (el servidor vuelve a validar todo).
    const found: Record<string, string> = {};
    if (name.length < 2 || name.length > 40) found.name = "Entre 2 y 40 caracteres.";
    if (password.length < PASSWORD_MIN) found.password = `Al menos ${PASSWORD_MIN} caracteres.`;
    if (password.length > PASSWORD_MAX) found.password = `Como máximo ${PASSWORD_MAX} caracteres.`;
    if (password !== confirm) found.confirm = "Las contraseñas no coinciden.";
    if (!form.get("terms")) found.terms = "Tienes que aceptar los términos para crear la cuenta.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setPending(true);
    setState(null);
    const { data, error } = await authClient.signUp.email({ name, email, password, callbackURL: next });
    setPending(false);
    if (error) {
      setState({ ok: false, error: authErrorMessage(error) });
      return;
    }
    if (verificationRequired || !data?.token) {
      router.push(`/verificar-correo?email=${encodeURIComponent(email)}`);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field label="Nombre visible" hint="Es el nombre que verán los demás. Podrás cambiarlo." error={errors.name}>
        {(p) => <Input {...p} name="name" autoComplete="nickname" required minLength={2} maxLength={40} />}
      </Field>
      <Field label="Correo electrónico" error={errors.email}>
        {(p) => <Input {...p} name="email" type="email" autoComplete="email" required />}
      </Field>
      <Field label="Contraseña" hint={`Al menos ${PASSWORD_MIN} caracteres. Mejor una frase larga que algo corto y raro.`} error={errors.password}>
        {(p) => <Input {...p} name="password" type="password" autoComplete="new-password" required minLength={PASSWORD_MIN} maxLength={PASSWORD_MAX} />}
      </Field>
      <Field label="Repite la contraseña" error={errors.confirm}>
        {(p) => <Input {...p} name="confirm" type="password" autoComplete="new-password" required />}
      </Field>
      <div>
        <Checkbox
          name="terms"
          required
          label={
            <>
              Acepto los <Link href="/terminos" className="underline underline-offset-2" target="_blank">términos de uso</Link> y he leído la{" "}
              <Link href="/privacidad" className="underline underline-offset-2" target="_blank">política de privacidad</Link>.
            </>
          }
        />
        {errors.terms && <p className="mt-1 text-xs font-medium text-danger">{errors.terms}</p>}
      </div>
      <FormMessage state={state} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Creando la cuenta…" : "Crear cuenta"}
      </Button>
    </form>
  );
}
