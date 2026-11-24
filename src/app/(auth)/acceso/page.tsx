import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { AuthDivider, GoogleButton } from "@/features/auth/components/google-button";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import { safeNext } from "@/lib/safe-redirect";
import { isGoogleConfigured } from "@/server/auth/google";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Iniciar sesión", robots: { index: false } };

/** Errores con los que Better Auth vuelve de Google (parámetro `error`). */
function googleError(value: string | string[] | undefined): string | null {
  const code = Array.isArray(value) ? value.at(-1) : value;
  if (!code) return null;
  if (code === "access_denied") return "Has cancelado el acceso con Google. Puedes intentarlo de nuevo o entrar con tu correo.";
  if (code === "account_not_linked" || code === "unable_to_link_account") {
    return "Ese correo ya tiene una cuenta y no se ha podido enlazar con Google. Entra con tu contraseña o recupérala.";
  }
  if (code === "ACCOUNT_SUSPENDED" || code.includes("suspend")) return "Esta cuenta está suspendida. Si crees que es un error, escríbenos desde Contacto.";
  return "No se ha podido entrar con Google. Vuelve a intentarlo dentro de un momento.";
}

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string | string[] }> }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const error = googleError(params.error);
  if (await getCurrentUser()) redirect(next);
  return (
    <AuthShell
      title="Iniciar sesión"
      description="Entra para gestionar tus equipos, inscripciones y partidos."
      footer={
        <div className="flex flex-wrap justify-between gap-2">
          <span>
            ¿No tienes cuenta?{" "}
            <Link href={`/registro?next=${encodeURIComponent(next)}`} className="font-semibold text-brand underline-offset-4 hover:underline">
              Créala
            </Link>
          </span>
          <Link href="/recuperar" className="font-semibold text-ink-2 underline-offset-4 hover:underline">
            ¿Has olvidado la contraseña?
          </Link>
        </div>
      }
    >
      {error && (
        <p role="alert" className="mb-5 rounded-sm border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      {isGoogleConfigured() && (
        <>
          <GoogleButton next={next} />
          <AuthDivider />
        </>
      )}
      <SignInForm next={next} />
    </AuthShell>
  );
}
