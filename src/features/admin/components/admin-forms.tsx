"use client";

import { useActionState } from "react";
import { Checkbox, Field, fieldError, FormMessage, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { saveAnnouncementAction, saveContentPageAction, saveSettingsAction } from "../actions";

export function AnnouncementForm({
  announcement,
  tournaments,
}: {
  announcement?: { id: string; title: string; body: string; pinned: boolean; status: string; tournamentId: string | null };
  tournaments: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(saveAnnouncementAction, null);
  return (
    <form action={formAction} className="space-y-4">
      {announcement && <input type="hidden" name="id" value={announcement.id} />}
      <Field label="Título" error={fieldError(state, "title")}>{(p) => <Input {...p} name="title" defaultValue={announcement?.title} required minLength={3} maxLength={120} />}</Field>
      <Field label="Texto" error={fieldError(state, "body")}>{(p) => <Textarea {...p} name="body" defaultValue={announcement?.body} required minLength={10} maxLength={8000} className="min-h-40" />}</Field>
      <Field label="Torneo" optional hint="Si eliges uno, el anuncio sale en su página." error={fieldError(state, "tournamentId")}>
        {(p) => (
          <Select {...p} name="tournamentId" defaultValue={announcement?.tournamentId ?? ""}>
            <option value="">Anuncio general</option>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
        )}
      </Field>
      <div className="flex flex-wrap gap-6">
        <Checkbox name="publish" defaultChecked={announcement?.status === "published"} label="Publicado" />
        <Checkbox name="pinned" defaultChecked={announcement?.pinned} label="Fijado arriba" />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Guardando…">{announcement ? "Guardar anuncio" : "Crear anuncio"}</SubmitButton>
    </form>
  );
}

export function ContentPageForm({ page }: { page: { slug: string; title: string; body: string; legalReviewed: boolean } }) {
  const [state, formAction] = useActionState(saveContentPageAction, null);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="slug" value={page.slug} />
      <Field label="Título" error={fieldError(state, "title")}>{(p) => <Input {...p} name="title" defaultValue={page.title} required />}</Field>
      <Field label="Texto" hint="Texto plano: los saltos de línea se respetan." error={fieldError(state, "body")}>
        {(p) => <Textarea {...p} name="body" defaultValue={page.body} required className="min-h-96 font-mono text-xs" />}
      </Field>
      <Checkbox
        name="legalReviewed"
        defaultChecked={page.legalReviewed}
        label="Revisado por un profesional"
        hint="Mientras no lo marques, la página muestra un aviso de «pendiente de revisión legal»."
      />
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Guardando…">Guardar página</SubmitButton>
    </form>
  );
}

const NETWORK_LABELS: Record<string, string> = { discord: "Discord", x: "X (Twitter)", twitch: "Twitch", youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok" };

export function SettingsForm({
  settings,
}: {
  settings: { contactEmail: string | null; maxTeamMembers: number; allowTeamCreation: boolean; announcementBanner: string | null; socialLinks: Record<string, string | null> };
}) {
  const [state, formAction] = useActionState(saveSettingsAction, null);
  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Correo de contacto" optional hint="Aparece en el pie de página." error={fieldError(state, "contactEmail")}>
          {(p) => <Input {...p} name="contactEmail" type="email" defaultValue={settings.contactEmail ?? ""} />}
        </Field>
        <Field label="Miembros máximos por equipo" hint="Entre 5 y 15. Cada torneo fija además sus titulares y suplentes." error={fieldError(state, "maxTeamMembers")}>
          {(p) => <Input {...p} name="maxTeamMembers" type="number" min={5} max={15} defaultValue={settings.maxTeamMembers} required />}
        </Field>
      </div>
      <Field label="Aviso general" optional hint="Franja visible en todas las páginas (por ejemplo, un mantenimiento). Vacío para quitarla." error={fieldError(state, "announcementBanner")}>
        {(p) => <Input {...p} name="announcementBanner" defaultValue={settings.announcementBanner ?? ""} maxLength={200} />}
      </Field>
      <Checkbox name="allowTeamCreation" defaultChecked={settings.allowTeamCreation} label="Permitir que los jugadores creen equipos" />
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Redes sociales (aparecen en el pie si las rellenas)</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.keys(NETWORK_LABELS).map((network) => (
            <Field key={network} label={NETWORK_LABELS[network]} optional error={fieldError(state, `social_${network}`)}>
              {(p) => <Input {...p} name={`social_${network}`} type="url" placeholder="https://" defaultValue={settings.socialLinks[network] ?? ""} />}
            </Field>
          ))}
        </div>
      </fieldset>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Guardando…">Guardar ajustes</SubmitButton>
    </form>
  );
}
