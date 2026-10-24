import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { ResetPasswordForm } from "@/features/auth/components/password-forms";

export const metadata: Metadata = { title: "Nueva contraseña", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  return (
    <AuthShell title="Nueva contraseña" description="Elige la contraseña con la que entrarás a partir de ahora.">
      {token && !error ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="space-y-4">
          <p className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">El enlace no es válido o ha caducado.</p>
          <Link href="/recuperar" className="font-semibold text-brand underline-offset-4 hover:underline">
            Pedir un enlace nuevo
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
