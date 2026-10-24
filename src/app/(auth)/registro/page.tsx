import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { SignUpForm } from "@/features/auth/components/sign-up-form";
import { safeNext } from "@/lib/safe-redirect";
import { getCurrentUser } from "@/server/auth/session";
import { isMailConfigured } from "@/server/mail";

export const metadata: Metadata = { title: "Crear cuenta", robots: { index: false } };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await getCurrentUser()) redirect(next);
  return (
    <AuthShell
      title="Crear cuenta"
      description="Gratis. Con tu cuenta podrás crear equipos, inscribirte en torneos y comunicar resultados."
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link href={`/acceso?next=${encodeURIComponent(next)}`} className="font-semibold text-brand underline-offset-4 hover:underline">
            Inicia sesión
          </Link>
        </>
      }
    >
      <SignUpForm next={next} verificationRequired={isMailConfigured()} />
    </AuthShell>
  );
}
