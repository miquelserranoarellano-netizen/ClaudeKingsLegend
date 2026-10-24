import { desc, eq } from "drizzle-orm";
import { DashboardTitle } from "@/components/layout/dashboard-title";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { Input } from "@/components/ui/form";
import { ChangePasswordForm, RevokeSessionsButton } from "@/features/auth/components/account-security";
import { deleteAccountAction } from "@/features/profiles/actions";
import { formatDateTime } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { sessions } from "@/server/db/schema";
import { isMailConfigured } from "@/server/mail";

export const metadata = { title: "Ajustes de cuenta" };

/** Resumen legible del navegador a partir del user-agent (sin guardar nada nuevo). */
function deviceLabel(userAgent: string | null): string {
  if (!userAgent) return "Dispositivo desconocido";
  const browser = /Edg\//.test(userAgent) ? "Edge" : /Chrome\//.test(userAgent) ? "Chrome" : /Firefox\//.test(userAgent) ? "Firefox" : /Safari\//.test(userAgent) ? "Safari" : "Navegador";
  const os = /Windows/.test(userAgent) ? "Windows" : /Android/.test(userAgent) ? "Android" : /iPhone|iPad/.test(userAgent) ? "iOS" : /Mac OS/.test(userAgent) ? "macOS" : /Linux/.test(userAgent) ? "Linux" : "";
  return os ? `${browser} en ${os}` : browser;
}

export default async function AccountSettingsPage() {
  const user = await requireUser("/dashboard/ajustes");
  const db = await getDb();
  const active = await db
    .select({ id: sessions.id, userAgent: sessions.userAgent, updatedAt: sessions.updatedAt, expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(eq(sessions.userId, user.id))
    .orderBy(desc(sessions.updatedAt));

  return (
    <>
      <DashboardTitle title="Ajustes de cuenta" description="Acceso, seguridad y eliminación de la cuenta." />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Correo electrónico" />
          <CardBody className="space-y-1 text-sm">
            <p className="font-semibold">{user.email}</p>
            <p className="text-ink-3">
              {user.emailVerified ? "Confirmado." : isMailConfigured() ? "Sin confirmar." : "Sin confirmar (este servidor no envía correos todavía)."} Para cambiarlo, escríbenos desde Contacto.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Contraseña" />
          <CardBody className="py-5">
            <ChangePasswordForm />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Sesiones abiertas" description="Dispositivos en los que tienes la sesión iniciada." />
          <CardBody className="space-y-4">
            <ul className="divide-y divide-line rounded-lg border border-line">
              {active.map((s) => (
                <li key={s.id} className="flex flex-wrap justify-between gap-2 px-3 py-2.5 text-sm">
                  <span className="font-medium">{deviceLabel(s.userAgent)}</span>
                  <span className="text-ink-3">Última actividad: {formatDateTime(s.updatedAt)}</span>
                </li>
              ))}
            </ul>
            <RevokeSessionsButton />
          </CardBody>
        </Card>

        <Card className="border-danger/30">
          <CardHeader title="Eliminar la cuenta" />
          <CardBody className="space-y-3 text-sm text-ink-2">
            <p>
              Se borran tu correo, tu contraseña, tu perfil, tu avatar y tus equipos como miembro. Tus resultados en torneos
              pasados se conservan como «Jugador eliminado» para no alterar los cuadros. No se puede deshacer.
            </p>
            <p className="text-ink-3">Antes tienes que ceder la capitanía de tus equipos y no estar inscrito en torneos en curso.</p>
            <ConfirmForm
              action={deleteAccountAction}
              hidden={{}}
              trigger="Eliminar mi cuenta"
              triggerVariant="outline"
              variant="danger"
              title="¿Eliminar tu cuenta?"
              description="Escribe ELIMINAR para confirmar."
              confirmLabel="Eliminar definitivamente"
            >
              <Input name="confirmation" aria-label="Escribe ELIMINAR" autoComplete="off" required />
            </ConfirmForm>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
