import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import { safeNext } from "@/lib/safe-redirect";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Iniciar sesión", robots: { index: false } };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
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
      <SignInForm next={next} />
    </AuthShell>
  );
}
