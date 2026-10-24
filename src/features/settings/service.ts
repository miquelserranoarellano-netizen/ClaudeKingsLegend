import "server-only";
import { z } from "zod";
import { canManagePlatform } from "@/domain/permissions";
import { audit } from "@/server/audit";
import type { CurrentUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { platformSettings } from "@/server/db/schema";
import { forbidden } from "@/server/errors";

/**
 * Ajustes de la plataforma, editables desde /admin/ajustes. Cada clave se valida al leerla: si en la
 * base de datos hubiera un valor inválido, se usa el valor por defecto en lugar de romper la página.
 */

const nullableUrl = z
  .string()
  .refine((v) => {
    try {
      return new URL(v).protocol === "https:";
    } catch {
      return false;
    }
  })
  .nullable();

export const SOCIAL_NETWORKS = ["discord", "x", "twitch", "youtube", "instagram", "tiktok"] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

const definitions = {
  contactEmail: z.email().nullable(),
  socialLinks: z.object(Object.fromEntries(SOCIAL_NETWORKS.map((n) => [n, nullableUrl])) as Record<SocialNetwork, typeof nullableUrl>),
  maxTeamMembers: z.number().int().min(5).max(15),
  allowTeamCreation: z.boolean(),
  announcementBanner: z.string().max(200).nullable(),
};

export type PlatformSettings = { [K in keyof typeof definitions]: z.infer<(typeof definitions)[K]> };

export const DEFAULT_SETTINGS: PlatformSettings = {
  contactEmail: null,
  socialLinks: Object.fromEntries(SOCIAL_NETWORKS.map((n) => [n, null])) as Record<SocialNetwork, string | null>,
  maxTeamMembers: 10,
  allowTeamCreation: true,
  announcementBanner: null,
};

export async function getSettings(): Promise<PlatformSettings> {
  const db = await getDb();
  const rows = await db.select().from(platformSettings);
  const settings: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    const schema = definitions[row.key as keyof typeof definitions];
    if (!schema) continue;
    const parsed = schema.safeParse(row.value);
    if (parsed.success) settings[row.key] = parsed.data;
  }
  return settings as PlatformSettings;
}

export async function updateSettings(actor: CurrentUser, input: PlatformSettings): Promise<void> {
  if (!canManagePlatform(actor)) throw forbidden();
  const db = await getDb();
  const before = await getSettings();
  await db.transaction(async (tx) => {
    for (const key of Object.keys(definitions) as (keyof typeof definitions)[]) {
      const value = definitions[key].parse(input[key]);
      await tx
        .insert(platformSettings)
        .values({ key, value, updatedById: actor.id })
        .onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedById: actor.id, updatedAt: new Date() } });
    }
    await audit(tx, { actorId: actor.id, action: "settings.update", entityType: "setting", entityId: "platform", data: { before, after: input } });
  });
}
