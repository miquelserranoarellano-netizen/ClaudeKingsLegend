"use client";

import { useActionState } from "react";
import { mediaUrl } from "@/components/ui/avatar";
import { Checkbox, Field, fieldError, FormMessage, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { ImageInput } from "@/components/ui/image-input";
import { label } from "@/i18n";
import { POSITIONS, REGIONS } from "@/lib/lol";
import { updateProfileAction } from "../actions";

export interface ProfileFormValues {
  displayName: string;
  handle: string;
  riotId: string | null;
  region: string | null;
  mainPosition: string | null;
  bio: string | null;
  isPublic: boolean;
  notifyByEmail: boolean;
  avatarMediaId: string | null;
}

export function ProfileForm({ profile, mailConfigured }: { profile: ProfileFormValues; mailConfigured: boolean }) {
  const [state, formAction] = useActionState(updateProfileAction, null);
  return (
    <form action={formAction} className="space-y-5">
      <ImageInput
        name="avatar"
        label="Avatar"
        hint="Se reduce a 400 px. Sin avatar se muestran tus iniciales."
        maxSize={400}
        shape="round"
        currentUrl={profile.avatarMediaId ? mediaUrl(profile.avatarMediaId) : null}
      />
      {profile.avatarMediaId && <Checkbox name="removeAvatar" label="Quitar el avatar actual" />}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nombre visible" error={fieldError(state, "displayName")}>
          {(p) => <Input {...p} name="displayName" defaultValue={profile.displayName} required minLength={2} maxLength={40} />}
        </Field>
        <Field label="Identificador" hint="Tu dirección pública: /jugadores/identificador. Los capitanes te invitan con él." error={fieldError(state, "handle")}>
          {(p) => <Input {...p} name="handle" defaultValue={profile.handle} required pattern="[a-z0-9][a-z0-9-]{1,30}[a-z0-9]" />}
        </Field>
        <Field
          label="Riot ID"
          optional
          hint="Formato Nombre#TAG. Lo declaras tú: Kings Legend no lo verifica con Riot."
          error={fieldError(state, "riotId")}
        >
          {(p) => <Input {...p} name="riotId" defaultValue={profile.riotId ?? ""} placeholder="Nombre#EUW" maxLength={30} />}
        </Field>
        <Field label="Servidor" optional error={fieldError(state, "region")}>
          {(p) => (
            <Select {...p} name="region" defaultValue={profile.region ?? ""}>
              <option value="">Sin indicar</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Posición principal" optional error={fieldError(state, "mainPosition")}>
          {(p) => (
            <Select {...p} name="mainPosition" defaultValue={profile.mainPosition ?? ""}>
              <option value="">Sin indicar</option>
              {POSITIONS.map((pos) => (
                <option key={pos} value={pos}>
                  {label("position", pos)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field label="Biografía" optional error={fieldError(state, "bio")}>
        {(p) => <Textarea {...p} name="bio" defaultValue={profile.bio ?? ""} maxLength={500} placeholder="Campeones favoritos, horario, objetivos…" />}
      </Field>
      <div className="space-y-3 rounded-lg border border-line bg-page p-4">
        <Checkbox
          name="isPublic"
          defaultChecked={profile.isPublic}
          label="Perfil público"
          hint="Si lo desactivas, tu página de jugador deja de mostrarse y no aparece en buscadores. Tu nombre seguirá saliendo en los equipos y cuadros."
        />
        <Checkbox
          name="notifyByEmail"
          defaultChecked={profile.notifyByEmail}
          label="Recibir también los avisos por correo"
          hint={mailConfigured ? undefined : "El envío de correos no está configurado en este servidor: de momento solo verás los avisos aquí."}
        />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Guardando…">Guardar perfil</SubmitButton>
    </form>
  );
}
