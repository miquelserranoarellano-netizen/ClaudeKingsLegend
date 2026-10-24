"use client";

import { useActionState } from "react";
import { Checkbox, Field, fieldError, FormMessage, Input, SubmitButton, Textarea } from "@/components/ui/form";
import { ImageInput } from "@/components/ui/image-input";
import { mediaUrl } from "@/components/ui/avatar";
import { createTeamAction, updateTeamAction } from "../actions";

export function TeamForm({
  team,
}: {
  team?: { id: string; name: string; tag: string; description: string | null; logoMediaId: string | null };
}) {
  const [state, formAction] = useActionState(team ? updateTeamAction : createTeamAction, null);
  return (
    <form action={formAction} className="space-y-5">
      {team && <input type="hidden" name="teamId" value={team.id} />}
      <div className="grid gap-5 sm:grid-cols-[1fr_10rem]">
        <Field label="Nombre del equipo" hint="Único entre los equipos activos." error={fieldError(state, "name")}>
          {(p) => <Input {...p} name="name" defaultValue={team?.name} required minLength={3} maxLength={32} />}
        </Field>
        <Field label="Etiqueta" hint="2-5 letras o números." error={fieldError(state, "tag")}>
          {(p) => (
            <Input
              {...p}
              name="tag"
              defaultValue={team?.tag}
              required
              minLength={2}
              maxLength={5}
              pattern="[A-Za-z0-9]{2,5}"
              className="uppercase"
              autoCapitalize="characters"
            />
          )}
        </Field>
      </div>
      <Field label="Descripción" optional error={fieldError(state, "description")}>
        {(p) => <Textarea {...p} name="description" defaultValue={team?.description ?? ""} maxLength={500} />}
      </Field>
      <ImageInput
        name="logo"
        label="Logotipo"
        hint="PNG, JPEG o WebP. Se reduce a 512 px. Sin logotipo se muestra un escudo con la etiqueta."
        maxSize={512}
        currentUrl={team?.logoMediaId ? mediaUrl(team.logoMediaId) : null}
      />
      {team?.logoMediaId && <Checkbox name="removeLogo" label="Quitar el logotipo actual" />}
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Guardando…">{team ? "Guardar cambios" : "Crear equipo"}</SubmitButton>
    </form>
  );
}
