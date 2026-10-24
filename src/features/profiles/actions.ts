"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { formFile, formToObject, runAction } from "@/server/action";
import { actorOrThrow } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { profileSchema } from "./schemas";
import { deleteOwnAccount, setAvatar, updateProfile } from "./service";

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction("updateProfile", async () => {
    const actor = await actorOrThrow();
    await updateProfile(actor, profileSchema.parse(formToObject(formData)));
    const avatar = formFile(formData, "avatar");
    if (avatar) await setAvatar(actor, avatar);
    else if (formData.get("removeAvatar") === "on") await setAvatar(actor, null);
    return { message: "Perfil guardado." };
  });
  if (result?.ok) revalidatePath("/", "layout");
  return result;
}

export async function deleteAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction("deleteAccount", async () => {
    const actor = await actorOrThrow();
    if (formData.get("confirmation") !== "ELIMINAR") {
      throw new AppError("validation", "errors.validation", {}, { confirmation: "errors.required" });
    }
    await deleteOwnAccount(actor);
  });
  if (result?.ok) {
    revalidatePath("/", "layout");
    redirect("/?cuenta=eliminada");
  }
  return result;
}
