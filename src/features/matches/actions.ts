"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Side } from "@/domain/competition/types";
import type { ActionState } from "@/lib/action-state";
import { checkbox, integer, optionalDateTimeLocal, optionalHttpsUrl, optionalText, dateTimeLocal, text, uuid } from "@/lib/validation";
import { formFiles, formToObject, runAction } from "@/server/action";
import { actorOrThrow } from "@/server/auth/session";
import {
  confirmOpponentReport,
  correctResult,
  markInProgress,
  openDispute,
  reportResult,
  resolveDispute,
  scheduleMatch,
  scheduleRound,
  validateResult,
} from "./service";

const done = () => revalidatePath("/", "layout");

const scoreFields = {
  scoreA: integer(0, 7),
  scoreB: integer(0, 7),
  isForfeit: checkbox,
  games: z
    .array(z.union([z.literal("a"), z.literal("b"), z.literal("")]))
    .optional()
    .transform((list) => {
      const games = (list ?? []).filter((g): g is Side => g === "a" || g === "b");
      return games.length > 0 ? games : null;
    }),
  mvpUserId: optionalText(64),
};

const versioned = { matchId: uuid, version: z.coerce.number().int().min(0) };

export async function scheduleMatchAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction("scheduleMatch", async () => {
    const actor = await actorOrThrow();
    const input = z.object({ ...versioned, scheduledAt: optionalDateTimeLocal }).parse(formToObject(formData));
    await scheduleMatch(actor, input);
    return { message: input.scheduledAt ? "Partido programado. Se ha avisado a los dos equipos." : "Fecha retirada." };
  });
  if (result?.ok) done();
  return result;
}

export async function scheduleRoundAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction("scheduleRound", async () => {
    const actor = await actorOrThrow();
    const input = z.object({ roundId: uuid, scheduledAt: dateTimeLocal }).parse(formToObject(formData));
    const count = await scheduleRound(actor, input);
    return { message: count === 1 ? "1 partido programado." : `${count} partidos programados.` };
  });
  if (result?.ok) done();
  return result;
}

export async function markInProgressAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction("markInProgress", async () => {
    const actor = await actorOrThrow();
    await markInProgress(actor, z.object(versioned).parse(formToObject(formData)));
    return { message: "Partido marcado como en juego." };
  });
  if (result?.ok) done();
  return result;
}

export async function reportResultAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction("reportResult", async () => {
    const actor = await actorOrThrow();
    const input = z
      .object({ matchId: uuid, ...scoreFields, notes: optionalText(500), evidenceUrl: optionalHttpsUrl })
      .parse(formToObject(formData));
    await reportResult(actor, {
      ...input,
      gameWinners: input.games,
      evidenceFiles: formFiles(formData, "evidence"),
    });
    return { message: "Resultado enviado. La organización lo validará." };
  });
  if (result?.ok) done();
  return result;
}

export async function confirmOpponentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction("confirmOpponent", async () => {
    const actor = await actorOrThrow();
    const { resultId } = z.object({ resultId: uuid }).parse(formToObject(formData));
    await confirmOpponentReport(actor, resultId);
    return { message: "Has confirmado el resultado del rival." };
  });
  if (result?.ok) done();
  return result;
}

export async function validateReportAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction("validateReport", async () => {
    const actor = await actorOrThrow();
    const input = z.object({ ...versioned, resultId: uuid }).parse(formToObject(formData));
    await validateResult(actor, input);
    return { message: "Resultado confirmado. El cuadro se ha actualizado." };
  });
  if (result?.ok) done();
  return result;
}

export async function manualResultAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction("manualResult", async () => {
    const actor = await actorOrThrow();
    const input = z.object({ ...versioned, ...scoreFields, notes: optionalText(500) }).parse(formToObject(formData));
    await validateResult(actor, {
      matchId: input.matchId,
      version: input.version,
      manual: { scoreA: input.scoreA, scoreB: input.scoreB, isForfeit: input.isForfeit, gameWinners: input.games, mvpUserId: input.mvpUserId, notes: input.notes },
    });
    return { message: "Resultado registrado y confirmado." };
  });
  if (result?.ok) done();
  return result;
}

export async function correctResultAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction("correctResult", async () => {
    const actor = await actorOrThrow();
    const input = z.object({ ...versioned, ...scoreFields, reason: text(5, 500) }).parse(formToObject(formData));
    await correctResult(actor, { ...input, gameWinners: input.games });
    return { message: "Resultado corregido. Queda registrado en la auditoría." };
  });
  if (result?.ok) done();
  return result;
}

export async function openDisputeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction("openDispute", async () => {
    const actor = await actorOrThrow();
    const input = z
      .object({ matchId: uuid, reason: text(10, 1000), resultId: optionalText(64), evidenceUrl: optionalHttpsUrl })
      .parse(formToObject(formData));
    await openDispute(actor, { ...input, evidenceFiles: formFiles(formData, "evidence") });
    return { message: "Disputa abierta. La organización la revisará." };
  });
  if (result?.ok) done();
  return result;
}

export async function resolveDisputeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction("resolveDispute", async () => {
    const actor = await actorOrThrow();
    const input = z
      .object({ disputeId: uuid, outcome: z.enum(["resolved", "rejected"]), resolution: text(5, 1000) })
      .parse(formToObject(formData));
    await resolveDispute(actor, input);
    return { message: "Disputa cerrada." };
  });
  if (result?.ok) done();
  return result;
}
