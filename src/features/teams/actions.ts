"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { formFile, formToObject, runAction } from "@/server/action";
import { actorOrThrow } from "@/server/auth/session";
import { invitationActionSchema, inviteSchema, memberActionSchema, teamIdSchema, teamSchema } from "./schemas";
import {
  cancelInvitation,
  createTeam,
  disbandTeam,
  inviteMember,
  removeMember,
  respondInvitation,
  setTeamLogo,
  transferCaptaincy,
  updateTeam,
} from "./service";

const done = () => revalidatePath("/", "layout");

export async function createTeamAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let teamId: string | null = null;
  const result = await runAction("createTeam", async () => {
    const actor = await actorOrThrow();
    const input = teamSchema.parse(formToObject(formData));
    const team = await createTeam(actor, input);
    teamId = team.id;
    const logo = formFile(formData, "logo");
    if (logo) await setTeamLogo(actor, team.id, logo);
  });
  if (result?.ok && teamId) {
    done();
    redirect(`/dashboard/equipos/${teamId}`);
  }
  return result;
}

export async function updateTeamAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction("updateTeam", async () => {
    const actor = await actorOrThrow();
    const { teamId } = teamIdSchema.parse(formToObject(formData));
    await updateTeam(actor, teamId, teamSchema.parse(formToObject(formData)));
    const logo = formFile(formData, "logo");
    if (logo) await setTeamLogo(actor, teamId, logo);
    else if (formData.get("removeLogo") === "on") await setTeamLogo(actor, teamId, null);
    return { message: "Cambios guardados." };
  });
  if (result?.ok) done();
  return result;
}

export async function inviteMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction("inviteMember", async () => {
    const actor = await actorOrThrow();
    const input = inviteSchema.parse(formToObject(formData));
    await inviteMember(actor, input);
    return { message: `Invitación enviada a @${input.handle}.` };
  });
  if (result?.ok) done();
  return result;
}

export async function cancelInvitationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction("cancelInvitation", async () => {
    const actor = await actorOrThrow();
    const { invitationId } = invitationActionSchema.parse(formToObject(formData));
    await cancelInvitation(actor, invitationId);
    return { message: "Invitación cancelada." };
  });
  if (result?.ok) done();
  return result;
}

const respondSchema = invitationActionSchema.extend({ decision: z.enum(["accept", "decline"]) });

export async function respondInvitationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction("respondInvitation", async () => {
    const actor = await actorOrThrow();
    const { invitationId, decision } = respondSchema.parse(formToObject(formData));
    await respondInvitation(actor, invitationId, decision === "accept");
    return { message: decision === "accept" ? "¡Bienvenido al equipo!" : "Invitación rechazada." };
  });
  if (result?.ok) done();
  return result;
}

export async function removeMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let left = false;
  const result = await runAction("removeMember", async () => {
    const actor = await actorOrThrow();
    const { teamId, userId } = memberActionSchema.parse(formToObject(formData));
    await removeMember(actor, teamId, userId);
    left = userId === actor.id;
    return { message: left ? "Has salido del equipo." : "Jugador retirado del equipo." };
  });
  if (result?.ok) {
    done();
    if (left) redirect("/dashboard/equipos");
  }
  return result;
}

export async function transferCaptaincyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction("transferCaptaincy", async () => {
    const actor = await actorOrThrow();
    const { teamId, userId } = memberActionSchema.parse(formToObject(formData));
    await transferCaptaincy(actor, teamId, userId);
    return { message: "Capitanía cedida." };
  });
  if (result?.ok) done();
  return result;
}

export async function disbandTeamAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction("disbandTeam", async () => {
    const actor = await actorOrThrow();
    const { teamId } = teamIdSchema.parse(formToObject(formData));
    await disbandTeam(actor, teamId);
  });
  if (result?.ok) {
    done();
    redirect("/dashboard/equipos");
  }
  return result;
}
