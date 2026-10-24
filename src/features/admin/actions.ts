"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { checkbox, optionalText, text, uuid } from "@/lib/validation";
import { formToObject, runAction } from "@/server/action";
import { actorOrThrow } from "@/server/auth/session";
import { announcementSchema, deleteAnnouncement, saveAnnouncement } from "../announcements/service";
import { saveContentPage } from "../content/service";
import { SOCIAL_NETWORKS, updateSettings } from "../settings/service";
import { disbandTeam } from "../teams/service";
import { setUserRole, setUserSuspension } from "./users";

const done = () => revalidatePath("/", "layout");

export async function setUserRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction("setUserRole", async () => {
    const actor = await actorOrThrow();
    const input = z.object({ userId: z.string().min(1).max(64), role: z.enum(["user", "organizer", "admin"]) }).parse(formToObject(formData));
    await setUserRole(actor, input.userId, input.role);
    return { message: "Rol actualizado." };
  });
  if (result?.ok) done();
  return result;
}

export async function setUserSuspensionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction("setUserSuspension", async () => {
    const actor = await actorOrThrow();
    const input = z
      .object({ userId: z.string().min(1).max(64), suspend: z.enum(["true", "false"]), reason: optionalText(300) })
      .parse(formToObject(formData));
    await setUserSuspension(actor, input.userId, input.suspend === "true", input.reason);
    return { message: input.suspend === "true" ? "Cuenta suspendida y sesiones cerradas." : "Cuenta reactivada." };
  });
  if (result?.ok) done();
  return result;
}

export async function adminDisbandTeamAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction("adminDisbandTeam", async () => {
    const actor = await actorOrThrow();
    const { teamId } = z.object({ teamId: uuid }).parse(formToObject(formData));
    await disbandTeam(actor, teamId);
    return { message: "Equipo disuelto." };
  });
  if (result?.ok) done();
  return result;
}

export async function saveAnnouncementAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction("saveAnnouncement", async () => {
    const actor = await actorOrThrow();
    const raw = formToObject(formData);
    const id = z.union([z.literal(""), uuid]).optional().parse(raw.id) || null;
    await saveAnnouncement(actor, id, announcementSchema.parse(raw));
  });
  if (result?.ok) {
    done();
    redirect("/admin/anuncios?guardado=1");
  }
  return result;
}

export async function deleteAnnouncementAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction("deleteAnnouncement", async () => {
    const actor = await actorOrThrow();
    const { id } = z.object({ id: uuid }).parse(formToObject(formData));
    await deleteAnnouncement(actor, id);
    return { message: "Anuncio eliminado." };
  });
  if (result?.ok) done();
  return result;
}

export async function saveContentPageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction("saveContentPage", async () => {
    const actor = await actorOrThrow();
    const input = z
      .object({ slug: z.string().max(40), title: text(3, 120), body: text(10, 30000), legalReviewed: checkbox })
      .parse(formToObject(formData));
    await saveContentPage(actor, input.slug, input);
    return { message: "Página guardada." };
  });
  if (result?.ok) done();
  return result;
}

const nullableHttps = z
  .string()
  .trim()
  .optional()
  .transform((v) => v || null)
  .refine((v) => v === null || /^https:\/\/[^\s]+$/.test(v), { error: "Tiene que empezar por https://" });

export async function saveSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction("saveSettings", async () => {
    const actor = await actorOrThrow();
    const raw = formToObject(formData);
    const input = z
      .object({
        contactEmail: z
          .string()
          .trim()
          .optional()
          .transform((v) => v || null)
          .pipe(z.email({ error: "Correo no válido." }).nullable()),
        maxTeamMembers: z.coerce.number().int().min(5).max(15),
        allowTeamCreation: checkbox,
        announcementBanner: optionalText(200),
      })
      .parse(raw);
    const socials = z.record(z.string(), nullableHttps).parse(Object.fromEntries(SOCIAL_NETWORKS.map((n) => [`social_${n}`, raw[`social_${n}`]])));
    const socialLinks = Object.fromEntries(SOCIAL_NETWORKS.map((n) => [n, socials[`social_${n}`] ?? null])) as Record<(typeof SOCIAL_NETWORKS)[number], string | null>;
    await updateSettings(actor, {
      contactEmail: input.contactEmail,
      maxTeamMembers: input.maxTeamMembers,
      allowTeamCreation: input.allowTeamCreation,
      announcementBanner: input.announcementBanner,
      socialLinks,
    });
    return { message: "Ajustes guardados." };
  });
  if (result?.ok) done();
  return result;
}
