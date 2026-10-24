import { DashboardTitle } from "@/components/layout/dashboard-title";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SettingsForm } from "@/features/admin/components/admin-forms";
import { getSettings } from "@/features/settings/service";
import { requirePlatformAdmin } from "@/server/auth/session";
import { isMailConfigured } from "@/server/mail";

export const metadata = { title: "Ajustes" };

export default async function SettingsPage() {
  await requirePlatformAdmin("/admin/ajustes");
  const settings = await getSettings();
  const mail = isMailConfigured();
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
                <dt className="text-ink-3">Correo (SMTP)</dt>
                <dd className={mail ? "font-semibold text-open" : "font-semibold text-warning"}>
                  {mail ? "Configurado" : "Sin configurar: no se envían correos (verificación, recuperación ni avisos)"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-3">Base de datos</dt>
                <dd className="font-semibold">{process.env.DATABASE_URL ? "PostgreSQL" : "PGlite local (solo desarrollo)"}</dd>
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
