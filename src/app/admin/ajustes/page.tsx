import { DashboardTitle } from "@/components/layout/dashboard-title";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SettingsForm } from "@/features/admin/components/admin-forms";
import { getSettings } from "@/features/settings/service";
import { formatDateTime } from "@/lib/format";
import { isGoogleConfigured } from "@/server/auth/google";
import { requirePlatformAdmin } from "@/server/auth/session";
import { isCloudflareWorker } from "@/server/db/client";
import { lastMailFailure, mailProvider } from "@/server/mail";

export const metadata = { title: "Ajustes" };

export default async function SettingsPage() {
  await requirePlatformAdmin("/admin/ajustes");
  const [settings, mailFailure] = await Promise.all([getSettings(), lastMailFailure()]);
  const provider = mailProvider();
  const mail = provider !== null;
  const google = isGoogleConfigured();
  return (
    <>
      <DashboardTitle title="Ajustes de la plataforma" />
      <div className="space-y-6">
        <Card>
          <CardBody className="py-5">
            <SettingsForm settings={settings} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Estado del servidor" description="Configuración que se define con variables de entorno (ver .env.example)." />
          <CardBody>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-ink-3">Correo</dt>
                <dd className={mail ? "font-semibold text-open" : "font-semibold text-warning"}>
                  {mail
                    ? `Configurado (${provider === "resend" ? "Resend" : "SMTP"})`
                    : "Sin configurar: no se envían correos (verificación, recuperación ni avisos)"}
                </dd>
              </div>
              {mailFailure && (
                <div className="rounded-sm border border-danger/40 bg-danger-soft px-3 py-2">
                  <dt className="font-semibold text-danger">Último correo que no se pudo enviar · {formatDateTime(mailFailure.at)}</dt>
                  <dd className="mt-1 text-ink-2">
                    «{mailFailure.subject}»: <code className="break-all text-xs">{mailFailure.reason}</code>
                  </dd>
                  <dd className="mt-1 text-xs text-ink-3">
                    Con Gmail, «535» o «Username and Password not accepted» quiere decir que la contraseña de aplicación
                    (SMTP_PASSWORD) o la cuenta (SMTP_USER) no son correctas. Más casos en docs/DESPLIEGUE-CLOUDFLARE.md.
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <dt className="text-ink-3">Entrar con Google</dt>
                <dd className={google ? "font-semibold text-open" : "font-semibold text-warning"}>
                  {google ? "Configurado" : "Sin configurar: no aparece el botón «Continuar con Google»"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-3">Base de datos</dt>
                <dd className="font-semibold">
                  {isCloudflareWorker() ? "PostgreSQL (Hyperdrive)" : process.env.DATABASE_URL ? "PostgreSQL" : "PGlite local (solo desarrollo)"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-3">URL pública</dt>
                <dd className="font-semibold">{process.env.NEXT_PUBLIC_SITE_URL ?? "sin definir (http://localhost:3400)"}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
