"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { optionalText, uuid } from "@/lib/validation";
import { label } from "@/i18n";
import { formToObject, runAction } from "@/server/action";
import { actorOrThrow } from "@/server/auth/session";
import { registerSolo, registerTeam, reviewRegistration, withdrawRegistration } from "./service";

const done = () => revalidatePath("/", "layout");

const ids = z.union([z.string(), z.array(z.string())]).optional().transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]));

const teamRegistrationSchema = z.object({
  tournamentId: uuid,
  teamId: uuid,
  players: ids,
  subs: ids,
  note: optionalText(300),
  accessCode: optionalText(40),
});

export async function registerTeamAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction("registerTeam", async () => {
    const actor = await actorOrThrow();
    const input = teamRegistrationSchema.parse(formToObject(formData));
    const subs = new Set(input.subs);
    const { status } = await registerTeam(actor, {
      tournamentId: input.tournamentId,
      teamId: input.teamId,
      roster: input.players.map((userId) => ({ userId, isSubstitute: subs.has(userId) })),
      note: input.note,
      accessCode: input.accessCode,
    });
    return { message: `Inscripción enviada: ${label("registrationStatus", status).toLowerCase()}.` };
  });
  if (result?.ok) done();
  return result;
}

const soloSchema = z.object({ tournamentId: uuid, note: optionalText(300), accessCode: optionalText(40) });

export async function registerSoloAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction("registerSolo", async () => {
    const actor = await actorOrThrow();
    const { status } = await registerSolo(actor, soloSchema.parse(formToObject(formData)));
    return { message: `Inscripción enviada: ${label("registrationStatus", status).toLowerCase()}.` };
  });
  if (result?.ok) done();
  return result;
}

export async function withdrawRegistrationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction("withdrawRegistration", async () => {
    const actor = await actorOrThrow();
    const { registrationId } = z.object({ registrationId: uuid }).parse(formToObject(formData));
    await withdrawRegistration(actor, registrationId);
    return { message: "Inscripción retirada." };
  });
  if (result?.ok) done();
  return result;
}

const reviewSchema = z.object({
  registrationId: uuid,
  decision: z.enum(["approve", "reject", "waitlist"]),
  reason: optionalText(300),
});

export async function reviewRegistrationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction("reviewRegistration", async () => {
    const actor = await actorOrThrow();
    const input = reviewSchema.parse(formToObject(formData));
    await reviewRegistration(actor, input.registrationId, input.decision, input.reason);
    return { message: { approve: "Inscripción aprobada.", reject: "Inscripción rechazada.", waitlist: "Enviada a la lista de espera." }[input.decision] };
  });
  if (result?.ok) done();
  return result;
}
