import { MailCheck } from "lucide-react";
import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { ResendVerification } from "@/features/auth/components/password-forms";

export const metadata: Metadata = { title: "Confirma tu correo", robots: { index: false } };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email = "" } = await searchParams;
  return (
    <AuthShell title="Confirma tu correo">
      <div className="space-y-4">
        <MailCheck aria-hidden className="size-10 text-brand" />
        <p className="text-ink-2">
          Te hemos enviado un enlace de confirmación{email ? <> a <strong>{email}</strong></> : null}. Ábrelo para activar tu cuenta;
          caduca en 24 horas.
        </p>
        <p className="text-sm text-ink-3">¿No te llega? Revisa la carpeta de spam o pide otro.</p>
        <ResendVerification email={email} />
      </div>
    </AuthShell>
  );
}
