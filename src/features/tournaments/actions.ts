"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { formFile, formToObject, runAction } from "@/server/action";
import { actorOrThrow } from "@/server/auth/session";
import { cancelSchema, editTournamentSchema, seedsSchema, tournamentIdSchema, tournamentSchema } from "./schemas";
import {
  cancelTournament,
  closeRegistrations,
  createTournament,
  deleteDraft,
  publishTournament,
  regenerateAccessCode,
  revertToDraft,
  setSeeds,
  setTournamentBanner,
  startTournament,
  updateTournament,
} from "./service";

const done = () => revalidatePath("/", "layout");

export async function createTournamentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id: string | null = null;
  const result = await runAction("createTournament", async () => {
    const actor = await actorOrThrow();
    const input = tournamentSchema.parse(formToObject(formData));
    const created = await createTournament(actor, input);
    id = created.id;
    const banner = formFile(formData, "banner");
    if (banner) await setTournamentBanner(actor, created.id, banner);
  });
  if (result?.ok && id) {
    done();
    redirect(`/admin/torneos/${id}?creado=1`);
  }
  return result;
}

export async function updateTournamentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id: string | null = null;
  const result = await runAction("updateTournament", async () => {
    const actor = await actorOrThrow();
    const raw = formToObject(formData);
    const { tournamentId, version } = editTournamentSchema.parse(raw);
    await updateTournament(actor, tournamentId, version, tournamentSchema.parse(raw));
    const banner = formFile(formData, "banner");
    if (banner) await setTournamentBanner(actor, tournamentId, banner);
    else if (formData.get("removeBanner") === "on") await setTournamentBanner(actor, tournamentId, null);
    id = tournamentId;
  });
  if (result?.ok && id) {
    done();
    redirect(`/admin/torneos/${id}?guardado=1`);
  }
  return result;
}

function simple(name: string, fn: (actorId: Awaited<ReturnType<typeof actorOrThrow>>, tournamentId: string) => Promise<void>, message: string) {
  return async (_prev: ActionState, formData: FormData): Promise<ActionState> => {
    const result = await runAction(name, async () => {
      const actor = await actorOrThrow();
      const { tournamentId } = tournamentIdSchema.parse(formToObject(formData));
      await fn(actor, tournamentId);
      return { message };
    });
    if (result?.ok) done();
    return result;
  };
}

export async function publishTournamentAction(prev: ActionState, formData: FormData) {
  return simple("publishTournament", publishTournament, "Torneo publicado.")(prev, formData);
}
export async function revertToDraftAction(prev: ActionState, formData: FormData) {
  return simple("revertToDraft", revertToDraft, "El torneo vuelve a ser un borrador.")(prev, formData);
}
export async function closeRegistrationsAction(prev: ActionState, formData: FormData) {
  return simple("closeRegistrations", closeRegistrations, "Inscripciones cerradas.")(prev, formData);
}
export async function startTournamentAction(prev: ActionState, formData: FormData) {
  return simple("startTournament", startTournament, "Competición iniciada: cuadro y calendario generados.")(prev, formData);
}
export async function regenerateAccessCodeAction(prev: ActionState, formData: FormData) {
  return simple("regenerateAccessCode", regenerateAccessCode, "Enlace de invitación renovado: el anterior ya no sirve.")(prev, formData);
}

export async function cancelTournamentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction("cancelTournament", async () => {
    const actor = await actorOrThrow();
    const { tournamentId, reason } = cancelSchema.parse(formToObject(formData));
    await cancelTournament(actor, tournamentId, reason);
    return { message: "Torneo cancelado. Se ha avisado a los inscritos." };
  });
  if (result?.ok) done();
  return result;
}

export async function deleteDraftAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction("deleteDraft", async () => {
    const actor = await actorOrThrow();
    const { tournamentId } = tournamentIdSchema.parse(formToObject(formData));
    await deleteDraft(actor, tournamentId);
  });
  if (result?.ok) {
    done();
    redirect("/admin/torneos");
  }
  return result;
}

export async function setSeedsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction("setSeeds", async () => {
    const actor = await actorOrThrow();
    const raw = formToObject(formData);
    const participantIds = z.array(z.string()).parse([raw.participant].flat().filter(Boolean));
    const seedValues = [raw.seed].flat();
    const { tournamentId, seeds } = seedsSchema.parse({
      tournamentId: raw.tournamentId,
      seeds: participantIds.map((participantId, i) => ({ participantId, seed: seedValues[i] })),
    });
    await setSeeds(actor, tournamentId, seeds);
    return { message: "Semillas guardadas." };
  });
  if (result?.ok) done();
  return result;
}
