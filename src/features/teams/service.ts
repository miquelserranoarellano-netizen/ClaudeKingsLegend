import "server-only";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { canCreateTeam, canManageTeam, isAdmin } from "@/domain/permissions";
import { slugify, randomSuffix } from "@/lib/slug";
import { audit } from "@/server/audit";
import type { CurrentUser } from "@/server/auth/session";
import { type DbOrTx, getDb, type Tx } from "@/server/db/client";
import {
  profiles,
  registrationMembers,
  teamInvitations,
  teamMembers,
  teams,
  tournamentRegistrations,
  tournaments,
  users,
} from "@/server/db/schema";
import { AppError, forbidden, isUniqueViolation, notFound, pgConstraint } from "@/server/errors";
import { enforceRateLimit } from "@/server/rate-limit";
import { notify } from "../notifications/service";
import { deleteMedia, storeImage } from "../media/service";
import { getSettings } from "../settings/service";
import type { TeamInput } from "./schemas";

const INVITATION_DAYS = 14;
const ACTIVE_REGISTRATION = ["pending", "approved", "waitlisted"] as const;
const ACTIVE_TOURNAMENT = ["draft", "published", "in_progress"] as const;

async function lockTeam(tx: Tx, teamId: string) {
  const [team] = await tx.select().from(teams).where(eq(teams.id, teamId)).for("update");
  if (!team) throw notFound();
  return team;
}

/** Comprueba nombre y etiqueta libres entre los equipos activos (sin distinguir mayúsculas). */
async function assertNameAndTagFree(tx: DbOrTx, input: TeamInput, exceptTeamId?: string) {
  const rows = await tx
    .select({ id: teams.id, name: teams.name, tag: teams.tag })
    .from(teams)
    .where(
      and(
        eq(teams.status, "active"),
        exceptTeamId ? ne(teams.id, exceptTeamId) : undefined,
        sql`(lower(${teams.name}) = lower(${input.name}) or lower(${teams.tag}) = lower(${input.tag}))`,
      ),
    );
  if (rows.some((r) => r.name.toLowerCase() === input.name.toLowerCase())) {
    throw new AppError("conflict", "errors.teamNameTaken", {}, { name: "errors.teamNameTaken" });
  }
  if (rows.length > 0) throw new AppError("conflict", "errors.teamTagTaken", {}, { tag: "errors.teamTagTaken" });
}

/** Si dos peticiones simultáneas pasan la comprobación previa, la restricción única decide. */
function mapTeamConflict(error: unknown): never {
  if (isUniqueViolation(error)) {
    const constraint = pgConstraint(error);
    if (constraint === "teams_tag_active_uq") {
      throw new AppError("conflict", "errors.teamTagTaken", {}, { tag: "errors.teamTagTaken" });
    }
    throw new AppError("conflict", "errors.teamNameTaken", {}, { name: "errors.teamNameTaken" });
  }
  throw error;
}

async function uniqueTeamSlug(tx: DbOrTx, name: string): Promise<string> {
  const base = slugify(name, 40);
  const [taken] = await tx.select({ id: teams.id }).from(teams).where(eq(teams.slug, base));
  return taken ? `${base}-${randomSuffix(4)}` : base;
}

/** ¿Está el jugador en la plantilla inscrita de este equipo en un torneo que no ha terminado? */
async function memberInActiveRoster(tx: DbOrTx, teamId: string, userId: string): Promise<boolean> {
  const rows = await tx
    .select({ one: sql`1` })
    .from(registrationMembers)
    .innerJoin(tournamentRegistrations, eq(tournamentRegistrations.id, registrationMembers.registrationId))
    .innerJoin(tournaments, eq(tournaments.id, tournamentRegistrations.tournamentId))
    .where(
      and(
        eq(registrationMembers.userId, userId),
        eq(tournamentRegistrations.teamId, teamId),
        inArray(tournamentRegistrations.status, [...ACTIVE_REGISTRATION]),
        inArray(tournaments.status, [...ACTIVE_TOURNAMENT]),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

async function memberCount(tx: DbOrTx, teamId: string): Promise<number> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId));
  return row?.count ?? 0;
}

export async function createTeam(actor: CurrentUser, input: TeamInput): Promise<{ id: string; slug: string }> {
  if (!canCreateTeam(actor)) throw forbidden();
  const settings = await getSettings();
  if (!settings.allowTeamCreation && !isAdmin(actor)) throw forbidden();
  const db = await getDb();
  await enforceRateLimit(db, "createTeam", actor.id);

  return db.transaction(async (tx) => {
    await assertNameAndTagFree(tx, input);
    const slug = await uniqueTeamSlug(tx, input.name);
    const [team] = await tx
      .insert(teams)
      .values({ name: input.name, tag: input.tag, description: input.description, slug, captainId: actor.id, createdById: actor.id })
      .returning({ id: teams.id, slug: teams.slug })
      .catch(mapTeamConflict);
    await tx.insert(teamMembers).values({ teamId: team!.id, userId: actor.id });
    await audit(tx, { actorId: actor.id, action: "team.create", entityType: "team", entityId: team!.id, data: { after: input } });
    return team!;
  });
}

export async function updateTeam(actor: CurrentUser, teamId: string, input: TeamInput): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const team = await lockTeam(tx, teamId);
    if (!canManageTeam(actor, team)) throw forbidden();
    if (team.status !== "active") throw new AppError("invalid_state", "errors.teamInactive");
    await assertNameAndTagFree(tx, input, teamId);
    await tx
      .update(teams)
      .set({ name: input.name, tag: input.tag, description: input.description })
      .where(eq(teams.id, teamId))
      .catch(mapTeamConflict);
    await audit(tx, {
      actorId: actor.id,
      action: "team.update",
      entityType: "team",
      entityId: teamId,
      data: { before: { name: team.name, tag: team.tag, description: team.description }, after: input },
    });
  });
}

export async function setTeamLogo(actor: CurrentUser, teamId: string, file: File | null): Promise<void> {
  const db = await getDb();
  if (file) await enforceRateLimit(db, "upload", actor.id);
  await db.transaction(async (tx) => {
    const team = await lockTeam(tx, teamId);
    if (!canManageTeam(actor, team)) throw forbidden();
    const mediaId = file ? await storeImage(tx, file, { ownerId: actor.id, kind: "team_logo", isPublic: true }) : null;
    await tx.update(teams).set({ logoMediaId: mediaId }).where(eq(teams.id, teamId));
    await deleteMedia(tx, team.logoMediaId);
    await audit(tx, { actorId: actor.id, action: file ? "team.logo.set" : "team.logo.remove", entityType: "team", entityId: teamId });
  });
}

export async function inviteMember(
  actor: CurrentUser,
  input: { teamId: string; handle: string; message: string | null },
): Promise<void> {
  const db = await getDb();
  const settings = await getSettings();
  await enforceRateLimit(db, "invite", actor.id);

  await db.transaction(async (tx) => {
    const team = await lockTeam(tx, input.teamId);
    if (!canManageTeam(actor, team)) throw forbidden();
    if (team.status !== "active") throw new AppError("invalid_state", "errors.teamInactive");

    const [invitee] = await tx
      .select({ userId: profiles.userId, displayName: profiles.displayName, suspendedAt: users.suspendedAt })
      .from(profiles)
      .innerJoin(users, eq(users.id, profiles.userId))
      .where(eq(profiles.handle, input.handle));
    if (!invitee || invitee.suspendedAt) {
      throw new AppError("not_found", "errors.playerNotFound", {}, { handle: "errors.playerNotFound" });
    }
    if (invitee.userId === actor.id) {
      throw new AppError("validation", "errors.cannotInviteSelf", {}, { handle: "errors.cannotInviteSelf" });
    }
    const [member] = await tx
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, invitee.userId)));
    if (member) throw new AppError("conflict", "errors.alreadyMember", {}, { handle: "errors.alreadyMember" });
    if ((await memberCount(tx, team.id)) >= settings.maxTeamMembers) {
      throw new AppError("invalid_state", "errors.teamFull", { max: settings.maxTeamMembers });
    }

    const [invitation] = await tx
      .insert(teamInvitations)
      .values({
        teamId: team.id,
        inviteeId: invitee.userId,
        invitedById: actor.id,
        message: input.message,
        expiresAt: new Date(Date.now() + INVITATION_DAYS * 24 * 60 * 60 * 1000),
      })
      .returning({ id: teamInvitations.id })
      .catch((error) => {
        if (isUniqueViolation(error)) {
          throw new AppError("conflict", "errors.alreadyInvited", {}, { handle: "errors.alreadyInvited" });
        }
        throw error;
      });

    await notify(tx, [invitee.userId], "teamInvitation", { team: team.name, inviter: actor.displayName }, "/dashboard/invitaciones");
    await audit(tx, {
      actorId: actor.id,
      action: "team.invite",
      entityType: "team_invitation",
      entityId: invitation!.id,
      data: { teamId: team.id, inviteeId: invitee.userId },
    });
  });
}

export async function cancelInvitation(actor: CurrentUser, invitationId: string): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [inv] = await tx.select().from(teamInvitations).where(eq(teamInvitations.id, invitationId)).for("update");
    if (!inv) throw notFound();
    const team = await lockTeam(tx, inv.teamId);
    if (!canManageTeam(actor, team)) throw forbidden();
    if (inv.status !== "pending") throw new AppError("invalid_state", "errors.invitationNotPending");
    await tx.update(teamInvitations).set({ status: "cancelled", respondedAt: new Date() }).where(eq(teamInvitations.id, inv.id));
    await audit(tx, { actorId: actor.id, action: "team.invite.cancel", entityType: "team_invitation", entityId: inv.id });
  });
}

export async function respondInvitation(actor: CurrentUser, invitationId: string, accept: boolean): Promise<{ teamSlug: string }> {
  const db = await getDb();
  const settings = await getSettings();
  return db.transaction(async (tx) => {
    const [inv] = await tx.select().from(teamInvitations).where(eq(teamInvitations.id, invitationId)).for("update");
    // Una invitación ajena se trata como inexistente: no se confirma que exista.
    if (!inv || inv.inviteeId !== actor.id) throw notFound();
    if (inv.status !== "pending") throw new AppError("invalid_state", "errors.invitationNotPending");
    if (inv.expiresAt < new Date()) throw new AppError("invalid_state", "errors.invitationExpired");

    const team = await lockTeam(tx, inv.teamId);
    if (team.status !== "active") throw new AppError("invalid_state", "errors.teamInactive");

    if (accept) {
      const [existing] = await tx
        .select({ id: teamMembers.id })
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, actor.id)));
      if (!existing) {
        if ((await memberCount(tx, team.id)) >= settings.maxTeamMembers) {
          throw new AppError("invalid_state", "errors.teamFull", { max: settings.maxTeamMembers });
        }
        await tx.insert(teamMembers).values({ teamId: team.id, userId: actor.id });
      }
    }

    await tx
      .update(teamInvitations)
      .set({ status: accept ? "accepted" : "declined", respondedAt: new Date() })
      .where(eq(teamInvitations.id, inv.id));
    await notify(
      tx,
      [team.captainId],
      accept ? "invitationAccepted" : "invitationDeclined",
      { player: actor.displayName, team: team.name },
      `/dashboard/equipos/${team.id}`,
    );
    await audit(tx, {
      actorId: actor.id,
      action: accept ? "team.invite.accept" : "team.invite.decline",
      entityType: "team_invitation",
      entityId: inv.id,
      data: { teamId: team.id },
    });
    return { teamSlug: team.slug };
  });
}

/** Expulsar a un miembro (capitán) o salir del equipo (el propio jugador). */
export async function removeMember(actor: CurrentUser, teamId: string, userId: string): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const team = await lockTeam(tx, teamId);
    const leaving = userId === actor.id;
    if (!leaving && !canManageTeam(actor, team)) throw forbidden();
    if (userId === team.captainId) throw new AppError("invalid_state", "errors.captainCannotLeave");
    const [member] = await tx
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
    if (!member) throw new AppError("not_found", "errors.notMember");
    if (await memberInActiveRoster(tx, teamId, userId)) {
      throw new AppError("invalid_state", "errors.memberInActiveTournament");
    }
    await tx.delete(teamMembers).where(eq(teamMembers.id, member.id));
    if (!leaving) await notify(tx, [userId], "removedFromTeam", { team: team.name }, `/equipos/${team.slug}`);
    await audit(tx, {
      actorId: actor.id,
      action: leaving ? "team.leave" : "team.member.remove",
      entityType: "team_member",
      entityId: member.id,
      data: { teamId, userId },
    });
  });
}

export async function transferCaptaincy(actor: CurrentUser, teamId: string, newCaptainId: string): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const team = await lockTeam(tx, teamId);
    if (!canManageTeam(actor, team)) throw forbidden();
    if (team.status !== "active") throw new AppError("invalid_state", "errors.teamInactive");
    const [member] = await tx
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, newCaptainId)));
    if (!member) throw new AppError("not_found", "errors.notMember");
    await tx.update(teams).set({ captainId: newCaptainId }).where(eq(teams.id, teamId));
    await notify(tx, [newCaptainId], "captaincyTransferred", { team: team.name }, `/dashboard/equipos/${team.id}`);
    await audit(tx, {
      actorId: actor.id,
      action: "team.captain.transfer",
      entityType: "team",
      entityId: teamId,
      data: { before: team.captainId, after: newCaptainId },
    });
  });
}

export async function disbandTeam(actor: CurrentUser, teamId: string): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const team = await lockTeam(tx, teamId);
    if (!canManageTeam(actor, team)) throw forbidden();
    if (team.status !== "active") throw new AppError("invalid_state", "errors.teamInactive");
    const active = await tx
      .select({ id: tournamentRegistrations.id })
      .from(tournamentRegistrations)
      .innerJoin(tournaments, eq(tournaments.id, tournamentRegistrations.tournamentId))
      .where(
        and(
          eq(tournamentRegistrations.teamId, teamId),
          inArray(tournamentRegistrations.status, [...ACTIVE_REGISTRATION]),
          inArray(tournaments.status, [...ACTIVE_TOURNAMENT]),
        ),
      )
      .limit(1);
    if (active.length > 0) throw new AppError("invalid_state", "errors.teamHasActiveTournaments");
    await tx.update(teams).set({ status: "disbanded", disbandedAt: new Date() }).where(eq(teams.id, teamId));
    await tx
      .update(teamInvitations)
      .set({ status: "cancelled", respondedAt: new Date() })
      .where(and(eq(teamInvitations.teamId, teamId), eq(teamInvitations.status, "pending")));
    await audit(tx, { actorId: actor.id, action: "team.disband", entityType: "team", entityId: teamId });
  });
}
