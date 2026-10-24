import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { ForgotPasswordForm } from "@/features/auth/components/password-forms";
import { isMailConfigured } from "@/server/mail";

export const metadata: Metadata = { title: "Recuperar contraseña", robots: { index: false } };

export default function ForgotPasswordPage() {
  const mail = isMailConfigured();
  return (
    <AuthShell
      title="Recuperar contraseña"
      description="Te enviaremos un enlace para elegir una contraseña nueva."
      footer={
        <Link href="/acceso" className="font-semibold text-ink-2 underline-offset-4 hover:underline">
          Volver a iniciar sesión
        </Link>
      }
    >
      {mail || process.env.NODE_ENV !== "production" ? (
        <>
          {!mail && (
            <p className="mb-4 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
              Modo desarrollo: no hay servidor de correo configurado, así que el enlace no se envía; aparece en la consola del servidor.
            </p>
          )}
          <ForgotPasswordForm />
        </>
      ) : (
        <p className="rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning">
          La recuperación por correo no está disponible todavía en este servidor (no hay servicio de envío configurado).
          Escríbenos desde <Link href="/contacto" className="font-semibold underline">Contacto</Link> y te ayudaremos a recuperar la cuenta.
        </p>
      )}
    </AuthShell>
  );
}
