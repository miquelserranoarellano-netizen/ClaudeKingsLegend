"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { formToObject, runAction } from "@/server/action";
import { actorOrThrow } from "@/server/auth/session";
import { markRead } from "./service";

const schema = z.object({ id: z.uuid().optional() });

export async function markReadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction("markRead", async () => {
    const actor = await actorOrThrow();
    const { id } = schema.parse(formToObject(formData));
    await markRead(actor.id, id ? [id] : "all");
  });
  if (result?.ok) revalidatePath("/", "layout");
  return result;
}
