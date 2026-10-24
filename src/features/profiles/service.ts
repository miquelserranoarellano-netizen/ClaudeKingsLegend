import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { randomSuffix } from "@/lib/slug";
import { audit } from "@/server/audit";
import type { CurrentUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import {
  accounts,
  profiles,
  registrationMembers,
  sessions,
  teamInvitations,
  teamMembers,
  teams,
  tournamentRegistrations,
  tournaments,
  users,
} from "@/server/db/schema";
import { AppError, isUniqueViolation, notFound, pgConstraint } from "@/server/errors";
import { enforceRateLimit } from "@/server/rate-limit";
import { deleteMedia, storeImage } from "../media/service";
import type { ProfileInput } from "./schemas";

export async function updateProfile(actor: CurrentUser, input: ProfileInput): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [current] = await tx.select().from(profiles).where(eq(profiles.userId, actor.id)).for("update");
    if (!current) throw notFound();
    await tx
      .update(profiles)
      .set({
        displayName: input.displayName,
        handle: input.handle,
        riotGameName: input.riotId?.gameName ?? null,
        riotTagLine: input.riotId?.tagLine ?? null,
        region: input.region,
        mainPosition: input.mainPosition,
        bio: input.bio,
        isPublic: input.isPublic,
        notifyByEmail: input.notifyByEmail,
      })
      .where(eq(profiles.userId, actor.id))
      .catch((error) => {
        if (isUniqueViolation(error)) {
          if (pgConstraint(error) === "profiles_riot_id_uq") {
            throw new AppError("conflict", "errors.riotIdTaken", {}, { riotId: "errors.riotIdTaken" });
          }
          throw new AppError("conflict", "errors.handleTaken", {}, { handle: "errors.handleTaken" });
        }
        throw error;
      });
    // Better Auth guarda su propio nombre: se mantiene igual que el nombre visible.
    await tx.update(users).set({ name: input.displayName }).where(eq(users.id, actor.id));
    await audit(tx, {
      actorId: actor.id,
      action: "profile.update",
      entityType: "profile",
      entityId: actor.id,
      data: {
        before: { handle: current.handle, displayName: current.displayName, riot: current.riotGameName ? `${current.riotGameName}#${current.riotTagLine}` : null },
        after: { handle: input.handle, displayName: input.displayName, riot: input.riotId ? `${input.riotId.gameName}#${input.riotId.tagLine}` : null },
      },
    });
  });
}

export async function setAvatar(actor: CurrentUser, file: File | null): Promise<void> {
  const db = await getDb();
  if (file) await enforceRateLimit(db, "upload", actor.id);
  await db.transaction(async (tx) => {
    const [current] = await tx.select({ avatar: profiles.avatarMediaId }).from(profiles).where(eq(profiles.userId, actor.id)).for("update");
    const mediaId = file ? await storeImage(tx, file, { ownerId: actor.id, kind: "avatar", isPublic: true }) : null;
    await tx.update(profiles).set({ avatarMediaId: mediaId }).where(eq(profiles.userId, actor.id));
    await deleteMedia(tx, current?.avatar ?? null);
  });
}

/**
 * Elimina la cuenta borrando sus datos personales. La fila del usuario se conserva anonimizada para no
 * romper el historial de torneos (resultados, registro de auditoría): sin correo real, sin perfil
 * público, sin credenciales y sin posibilidad de iniciar sesión.
 */
export async function deleteOwnAccount(actor: CurrentUser): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [captain] = await tx
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.captainId, actor.id), eq(teams.status, "active")))
      .limit(1);
    if (captain) throw new AppError("invalid_state", "errors.captainCannotLeave");
    const [active] = await tx
      .select({ one: sql`1` })
      .from(registrationMembers)
      .innerJoin(tournamentRegistrations, eq(tournamentRegistrations.id, registrationMembers.registrationId))
      .innerJoin(tournaments, eq(tournaments.id, tournamentRegistrations.tournamentId))
      .where(
        and(
          eq(registrationMembers.userId, actor.id),
          inArray(tournamentRegistrations.status, ["pending", "approved", "waitlisted"]),
          inArray(tournaments.status, ["published", "in_progress"]),
        ),
      )
      .limit(1);
    if (active) throw new AppError("invalid_state", "errors.memberInActiveTournament");

    const [profile] = await tx.select({ avatar: profiles.avatarMediaId }).from(profiles).where(eq(profiles.userId, actor.id));
    const tag = randomSuffix(8);
    await tx.delete(sessions).where(eq(sessions.userId, actor.id));
    await tx.delete(accounts).where(eq(accounts.userId, actor.id));
    await tx.delete(teamMembers).where(eq(teamMembers.userId, actor.id));
    await tx.delete(teamInvitations).where(and(eq(teamInvitations.inviteeId, actor.id), eq(teamInvitations.status, "pending")));
    await tx
      .update(profiles)
      .set({
        handle: `eliminado-${tag}`,
        displayName: "Jugador eliminado",
        riotGameName: null,
        riotTagLine: null,
        region: null,
        mainPosition: null,
        bio: null,
        avatarMediaId: null,
        isPublic: false,
        notifyByEmail: false,
      })
      .where(eq(profiles.userId, actor.id));
    await deleteMedia(tx, profile?.avatar ?? null);
    await tx
      .update(users)
      .set({
        name: "Jugador eliminado",
        email: `eliminado-${tag}@cuenta-eliminada.invalid`,
        emailVerified: false,
        image: null,
        role: "user",
        suspendedAt: new Date(),
        suspensionReason: "Cuenta eliminada por su titular.",
      })
      .where(eq(users.id, actor.id));
    await audit(tx, { actorId: actor.id, action: "user.delete_self", entityType: "user", entityId: actor.id });
  });
}
