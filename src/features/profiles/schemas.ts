import { z } from "zod";
import { t } from "@/i18n";
import { parseRiotId, POSITIONS, REGIONS } from "@/lib/lol";
import { HANDLE_PATTERN } from "@/lib/slug";
import { checkbox, optionalText, text } from "@/lib/validation";

export const profileSchema = z.object({
  displayName: text(2, 40),
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .regex(HANDLE_PATTERN, { error: t("errors.handleInvalid") }),
  riotId: z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform((value, ctx) => {
      if (!value) return null;
      const parsed = parseRiotId(value);
      if (!parsed) {
        ctx.addIssue({ code: "custom", message: t("errors.riotIdInvalid") });
        return z.NEVER;
      }
      return parsed;
    }),
  region: z
    .union([z.literal(""), z.enum(REGIONS)])
    .optional()
    .transform((v) => v || null),
  mainPosition: z
    .union([z.literal(""), z.enum(POSITIONS)])
    .optional()
    .transform((v) => v || null),
  bio: optionalText(500),
  isPublic: checkbox,
  notifyByEmail: checkbox,
});

export type ProfileInput = z.infer<typeof profileSchema>;
