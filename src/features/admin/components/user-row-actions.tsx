"use client";

import { useActionState } from "react";
import { FormMessage, Input, SubmitButton } from "@/components/ui/form";
import { setUserRoleAction, setUserSuspensionAction } from "../actions";

export function UserRoleForm({ userId, role }: { userId: string; role: string }) {
  const [state, formAction] = useActionState(setUserRoleAction, null);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <select name="role" defaultValue={role} aria-label="Rol" className="h-8 rounded-md border border-line-strong bg-surface px-2 text-sm">
        <option value="user">Jugador</option>
        <option value="organizer">Organizador</option>
        <option value="admin">Administrador</option>
      </select>
      <SubmitButton size="sm" variant="outline">Cambiar</SubmitButton>
      {state && !state.ok && <FormMessage state={state} className="w-full py-1.5" />}
    </form>
  );
}

export function UserSuspensionForm({ userId, suspended }: { userId: string; suspended: boolean }) {
  const [state, formAction] = useActionState(setUserSuspensionAction, null);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="suspend" value={suspended ? "false" : "true"} />
      {!suspended && <Input name="reason" placeholder="Motivo" aria-label="Motivo de la suspensión" className="h-8 w-40" maxLength={300} />}
      <SubmitButton size="sm" variant={suspended ? "outline" : "ghost"}>{suspended ? "Reactivar" : "Suspender"}</SubmitButton>
      {state && !state.ok && <FormMessage state={state} className="w-full py-1.5" />}
    </form>
  );
}
