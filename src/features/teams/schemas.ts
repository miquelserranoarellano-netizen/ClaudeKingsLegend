import { z } from "zod";
import { optionalText, text, uuid } from "@/lib/validation";

export const TEAM_TAG_PATTERN = /^[A-Za-z0-9]{2,5}$/;

export const teamSchema = z.object({
  name: text(3, 32),
  tag: z
    .string()
    .trim()
    .regex(TEAM_TAG_PATTERN, { error: "Entre 2 y 5 letras o números, sin espacios." })
    .transform((tag) => tag.toUpperCase()),
  description: optionalText(500),
});
export type TeamInput = z.infer<typeof teamSchema>;

export const inviteSchema = z.object({
  teamId: uuid,
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .transform((h) => h.replace(/^@/, ""))
    .pipe(z.string().min(3, { error: "Escribe el identificador del jugador." }).max(32)),
  message: optionalText(200),
});

export const memberActionSchema = z.object({ teamId: uuid, userId: z.string().min(1).max(64) });
export const invitationActionSchema = z.object({ invitationId: uuid });
export const teamIdSchema = z.object({ teamId: uuid });
