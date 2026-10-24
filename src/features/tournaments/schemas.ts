import { z } from "zod";
import { BEST_OF_VALUES } from "@/domain/competition/series";
import { TIEBREAKERS } from "@/domain/competition/standings";
import { scheduleProblems } from "@/domain/tournament/phase";
import { REGIONS } from "@/lib/lol";
import {
  checkbox,
  dateTimeLocal,
  integer,
  optionalDateTimeLocal,
  optionalText,
  text,
  uuid,
} from "@/lib/validation";

const bestOf = z.coerce
  .number()
  .refine((v) => (BEST_OF_VALUES as readonly number[]).includes(v), { error: "Elige 1, 3, 5 o 7." });

export const tournamentSchema = z
  .object({
    name: text(3, 80),
    summary: optionalText(160),
    description: optionalText(5000),
    rulesText: optionalText(10000),
    prizeDescription: optionalText(1000),
    format: z.enum(["single_elimination", "double_elimination", "league"]),
    participantType: z.enum(["team", "solo"]),
    visibility: z.enum(["public", "private"]),
    region: z
      .union([z.literal(""), z.enum(REGIONS)])
      .optional()
      .transform((v) => v || null),
    registrationOpensAt: dateTimeLocal,
    registrationClosesAt: dateTimeLocal,
    startsAt: dateTimeLocal,
    endsAt: optionalDateTimeLocal,
    minParticipants: integer(2, 256),
    maxParticipants: integer(2, 256),
    teamSize: integer(1, 5),
    maxSubstitutes: integer(0, 5),
    bestOf,
    bestOfFinal: bestOf,
    pointsWin: integer(0, 10),
    pointsLoss: integer(-5, 10),
    pointsForfeitLoss: integer(-5, 10),
    tiebreakers: z
      .array(z.union([z.literal(""), z.enum(TIEBREAKERS)]))
      .optional()
      .transform((list) => [...new Set((list ?? []).filter((v) => v !== ""))] as (typeof TIEBREAKERS)[number][]),
    leagueLegs: z.coerce.number().refine((v) => v === 1 || v === 2, { error: "Elige ida o ida y vuelta." }),
    grandFinalReset: checkbox,
    approvalMode: z.enum(["manual", "automatic"]),
    waitlistEnabled: checkbox,
    requireRiotId: checkbox,
  })
  .superRefine((value, ctx) => {
    const problems = scheduleProblems(value);
    const messages: Record<(typeof problems)[number], [string, string]> = {
      registration_order: ["registrationClosesAt", "El cierre de inscripciones debe ser posterior a la apertura."],
      start_before_close: ["startsAt", "El torneo debe empezar después de cerrar las inscripciones."],
      end_before_start: ["endsAt", "La fecha de fin no puede ser anterior al inicio."],
      participants_order: ["maxParticipants", "El máximo no puede ser menor que el mínimo."],
      participants_range: ["minParticipants", "Entre 2 y 256 participantes."],
    };
    for (const problem of problems) {
      const [path, message] = messages[problem];
      ctx.addIssue({ code: "custom", path: [path], message });
    }
    if (value.pointsWin <= value.pointsLoss) {
      ctx.addIssue({ code: "custom", path: ["pointsWin"], message: "La victoria debe valer más que la derrota." });
    }
    if (value.pointsForfeitLoss > value.pointsLoss) {
      ctx.addIssue({
        code: "custom",
        path: ["pointsForfeitLoss"],
        message: "Perder por incomparecencia no puede valer más que perder jugando.",
      });
    }
  });

export type TournamentInput = z.infer<typeof tournamentSchema>;

export const tournamentIdSchema = z.object({ tournamentId: uuid });
export const editTournamentSchema = z.object({ tournamentId: uuid, version: z.coerce.number().int().min(0) });
export const cancelSchema = z.object({ tournamentId: uuid, reason: text(5, 300) });
export const seedsSchema = z.object({
  tournamentId: uuid,
  seeds: z.array(z.object({ participantId: uuid, seed: z.coerce.number().int().min(1).max(256) })),
});
