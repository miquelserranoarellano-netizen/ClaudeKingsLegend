import "server-only";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { canManageTeam, canManageTournament, canViewTournament } from "@/domain/permissions";
import { tournamentPhase } from "@/domain/tournament/phase";
import {
  canWithdraw,
  initialRegistrationStatus,
  type RegistrationBlocker,
  soloRegistrationBlockers,
  teamRegistrationBlockers,
} from "@/domain/tournament/registration";
import type { MessageKey } from "@/i18n";
import { audit } from "@/server/audit";
import type { CurrentUser } from "@/server/auth/session";
import { type DbOrTx, getDb, type Tx } from "@/server/db/client";
import {
  profiles,
  registrationMembers,
  teamMembers,
  teams,
  tournamentParticipants,
  tournamentRegistrations,
  tournamentRules,
  tournaments,
  users,
} from "@/server/db/schema";
import { AppError, forbidden, isUniqueViolation, notFound } from "@/server/errors";
import { enforceRateLimit } from "@/server/rate-limit";
import { notify } from "../notifications/service";
import { lockTournament } from "../tournaments/service";

type RegistrationRow = typeof tournamentRegistrations.$inferSelect;
type TournamentRow = typeof tournaments.$inferSelect;
type RulesRow = typeof tournamentRules.$inferSelect;

const ACTIVE = ["pending", "approved", "waitlisted"] as const;

function blockerError(blocker: RegistrationBlocker, rules: RulesRow): AppError {
  return new AppError("invalid_state", `registrationBlockers.${blocker}` as MessageKey, {
    min: rules.teamSize,
    max: rules.teamSize + rules.maxSubstitutes,
    subs: rules.maxSubstitutes,
  });
}

async function loadRules(tx: DbOrTx, tournamentId: string): Promise<RulesRow> {
  const [rules] = await tx.select().from(tournamentRules).where(eq(tournamentRules.tournamentId, tournamentId));
  if (!rules) throw notFound();
  return rules;
}

async function approvedCount(tx: DbOrTx, tournamentId: string): Promise<number> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(tournamentRegistrations)
    .where(and(eq(tournamentRegistrations.tournamentId, tournamentId), eq(tournamentRegistrations.status, "approved")));
  return row?.count ?? 0;
}

/** Destinatarios de los avisos de una inscripción: la plantilla y el capitán (o el propio jugador). */
async function registrationAudience(tx: DbOrTx, reg: RegistrationRow): Promise<string[]> {
  const members = await tx
    .select({ userId: registrationMembers.userId })
    .from(registrationMembers)
    .where(eq(registrationMembers.registrationId, reg.id));
  const ids = new Set(members.map((m) => m.userId));
  if (reg.userId) ids.add(reg.userId);
  if (reg.teamId) {
    const [team] = await tx.select({ captainId: teams.captainId }).from(teams).where(eq(teams.id, reg.teamId));
    if (team) ids.add(team.captainId);
  }
  return [...ids];
}

async function entrantName(tx: DbOrTx, reg: Pick<RegistrationRow, "teamId" | "userId">): Promise<string> {
  if (reg.teamId) {
    const [team] = await tx.select({ name: teams.name }).from(teams).where(eq(teams.id, reg.teamId));
    return team?.name ?? "—";
  }
  const [profile] = await tx.select({ name: profiles.displayName }).from(profiles).where(eq(profiles.userId, reg.userId!));
  return profile?.name ?? "—";
}

async function createParticipant(tx: Tx, reg: RegistrationRow): Promise<void> {
  await tx
    .insert(tournamentParticipants)
    .values({ tournamentId: reg.tournamentId, registrationId: reg.id, teamId: reg.teamId, userId: reg.userId })
    .onConflictDoNothing({ target: tournamentParticipants.registrationId });
}

/** Crea la fila de inscripción o reutiliza la anterior (retirada o rechazada) del mismo equipo o jugador. */
async function upsertRegistration(
  tx: Tx,
  existing: RegistrationRow | undefined,
  values: { tournamentId: string; teamId: string | null; userId: string | null; submittedById: string; status: RegistrationRow["status"]; note: string | null },
): Promise<RegistrationRow> {
  const now = new Date();
  if (existing) {
    const [row] = await tx
      .update(tournamentRegistrations)
      .set({
        status: values.status,
        submittedById: values.submittedById,
        note: values.note,
        statusChangedAt: now,
        reviewedById: null,
        reviewedAt: null,
        decisionReason: null,
      })
      .where(eq(tournamentRegistrations.id, existing.id))
      .returning();
    return row!;
  }
  const [row] = await tx.insert(tournamentRegistrations).values({ ...values, statusChangedAt: now }).returning();
  return row!;
}

async function notifyAfterRegistration(tx: Tx, t: TournamentRow, reg: RegistrationRow): Promise<void> {
  const params = { entrant: await entrantName(tx, reg), tournament: t.name, reason: "" };
  if (reg.status === "pending") {
    await notify(tx, [t.organizerId], "registrationPending", params, `/admin/torneos/${t.id}/inscripciones`);
  } else if (reg.status === "approved") {
    await notify(tx, await registrationAudience(tx, reg), "registrationApproved", params, `/torneos/${t.slug}`);
  } else if (reg.status === "waitlisted") {
    await notify(tx, await registrationAudience(tx, reg), "registrationWaitlisted", params, `/torneos/${t.slug}`);
  }
}

function assertCanSee(actor: CurrentUser, t: TournamentRow, accessCode: string | null): void {
  const visible = canViewTournament(actor, t, {
    isParticipant: false,
    hasAccessCode: !!t.accessCode && accessCode === t.accessCode,
  });
  if (!visible) throw notFound();
}

export interface TeamRegistrationInput {
  tournamentId: string;
  teamId: string;
  roster: { userId: string; isSubstitute: boolean }[];
  note: string | null;
  accessCode: string | null;
}

export async function registerTeam(actor: CurrentUser, input: TeamRegistrationInput): Promise<{ status: RegistrationRow["status"] }> {
  const db = await getDb();
  await enforceRateLimit(db, "register", actor.id);

  return db.transaction(async (tx) => {
    // El bloqueo del torneo serializa las inscripciones: dos equipos no pueden ocupar la última plaza a la vez.
    const t = await lockTournament(tx, input.tournamentId);
    assertCanSee(actor, t, input.accessCode);
    if (t.participantType !== "team") throw new AppError("invalid_state", "errors.wrongParticipantType");
    const rules = await loadRules(tx, t.id);

    const [team] = await tx.select().from(teams).where(eq(teams.id, input.teamId)).for("update");
    if (!team) throw notFound();
    const byOrganizer = canManageTournament(actor, t) && !canManageTeam(actor, team);

    const [existing] = await tx
      .select()
      .from(tournamentRegistrations)
      .where(and(eq(tournamentRegistrations.tournamentId, t.id), eq(tournamentRegistrations.teamId, team.id)));

    const rosterIds = [...new Set(input.roster.map((p) => p.userId))];
    const memberRows = rosterIds.length
      ? await tx
          .select({ userId: teamMembers.userId })
          .from(teamMembers)
          .where(and(eq(teamMembers.teamId, team.id), inArray(teamMembers.userId, rosterIds)))
      : [];
    const playerRows = rosterIds.length
      ? await tx
          .select({ userId: users.id, suspendedAt: users.suspendedAt, riot: profiles.riotGameName })
          .from(users)
          .leftJoin(profiles, eq(profiles.userId, users.id))
          .where(inArray(users.id, rosterIds))
      : [];
    const elsewhere = rosterIds.length
      ? await tx
          .select({ userId: registrationMembers.userId })
          .from(registrationMembers)
          .where(
            and(
              eq(registrationMembers.tournamentId, t.id),
              inArray(registrationMembers.userId, rosterIds),
              existing ? ne(registrationMembers.registrationId, existing.id) : undefined,
            ),
          )
      : [];
    const members = new Set(memberRows.map((m) => m.userId));
    const players = new Map(playerRows.map((p) => [p.userId, p]));
    const taken = new Set(elsewhere.map((e) => e.userId));

    const blockers = teamRegistrationBlockers({
      phase: tournamentPhase(t, new Date()),
      byOrganizer,
      alreadyRegistered: !!existing && (ACTIVE as readonly string[]).includes(existing.status),
      actorIsCaptain: team.captainId === actor.id,
      teamActive: team.status === "active",
      teamSize: rules.teamSize,
      maxSubstitutes: rules.maxSubstitutes,
      requireRiotId: rules.requireRiotId,
      roster: input.roster.map((p) => ({
        userId: p.userId,
        isSubstitute: p.isSubstitute,
        isTeamMember: members.has(p.userId),
        hasRiotId: !!players.get(p.userId)?.riot,
        suspended: !!players.get(p.userId)?.suspendedAt,
        registeredElsewhere: taken.has(p.userId),
      })),
    });
    if (blockers.length > 0) throw blockerError(blockers[0]!, rules);

    const status = initialRegistrationStatus({
      approvalMode: rules.approvalMode,
      approvedCount: await approvedCount(tx, t.id),
      maxParticipants: t.maxParticipants,
      waitlistEnabled: rules.waitlistEnabled,
    });
    if (status === "tournament_full") throw blockerError("tournament_full", rules);

    const reg = await upsertRegistration(tx, existing, {
      tournamentId: t.id,
      teamId: team.id,
      userId: null,
      submittedById: actor.id,
      status,
      note: input.note,
    });
    await tx.delete(registrationMembers).where(eq(registrationMembers.registrationId, reg.id));
    const starters = new Set(input.roster.filter((p) => !p.isSubstitute).map((p) => p.userId));
    await tx
      .insert(registrationMembers)
      .values(rosterIds.map((userId) => ({ registrationId: reg.id, tournamentId: t.id, userId, isSubstitute: !starters.has(userId) })))
      .catch((error) => {
        if (isUniqueViolation(error)) throw blockerError("player_already_registered", rules);
        throw error;
      });
    if (status === "approved") await createParticipant(tx, reg);

    await notifyAfterRegistration(tx, t, reg);
    await audit(tx, {
      actorId: actor.id,
      action: "registration.create",
      entityType: "registration",
      entityId: reg.id,
      tournamentId: t.id,
      data: { teamId: team.id, status, roster: input.roster },
    });
    return { status };
  });
}

export async function registerSolo(
  actor: CurrentUser,
  input: { tournamentId: string; note: string | null; accessCode: string | null },
): Promise<{ status: RegistrationRow["status"] }> {
  const db = await getDb();
  await enforceRateLimit(db, "register", actor.id);
  return db.transaction(async (tx) => {
    const t = await lockTournament(tx, input.tournamentId);
    assertCanSee(actor, t, input.accessCode);
    if (t.participantType !== "solo") throw new AppError("invalid_state", "errors.wrongParticipantType");
    const rules = await loadRules(tx, t.id);
    const [existing] = await tx
      .select()
      .from(tournamentRegistrations)
      .where(and(eq(tournamentRegistrations.tournamentId, t.id), eq(tournamentRegistrations.userId, actor.id)));

    const blockers = soloRegistrationBlockers({
      phase: tournamentPhase(t, new Date()),
      byOrganizer: false,
      alreadyRegistered: !!existing && (ACTIVE as readonly string[]).includes(existing.status),
      requireRiotId: rules.requireRiotId,
      hasRiotId: actor.hasRiotId,
      suspended: actor.suspended,
    });
    if (blockers.length > 0) throw blockerError(blockers[0]!, rules);

    const status = initialRegistrationStatus({
      approvalMode: rules.approvalMode,
      approvedCount: await approvedCount(tx, t.id),
      maxParticipants: t.maxParticipants,
      waitlistEnabled: rules.waitlistEnabled,
    });
    if (status === "tournament_full") throw blockerError("tournament_full", rules);

    const reg = await upsertRegistration(tx, existing, {
      tournamentId: t.id,
      teamId: null,
      userId: actor.id,
      submittedById: actor.id,
      status,
      note: input.note,
    });
    await tx.delete(registrationMembers).where(eq(registrationMembers.registrationId, reg.id));
    await tx
      .insert(registrationMembers)
      .values({ registrationId: reg.id, tournamentId: t.id, userId: actor.id, isSubstitute: false });
    if (status === "approved") await createParticipant(tx, reg);
    await notifyAfterRegistration(tx, t, reg);
    await audit(tx, {
      actorId: actor.id,
      action: "registration.create",
      entityType: "registration",
      entityId: reg.id,
      tournamentId: t.id,
      data: { userId: actor.id, status },
    });
    return { status };
  });
}

/** Si se ha liberado una plaza, el primero de la lista de espera pasa a aprobado (o a revisión). */
async function promoteFromWaitlist(tx: Tx, t: TournamentRow, rules: RulesRow): Promise<void> {
  if (!rules.waitlistEnabled) return;
  if ((await approvedCount(tx, t.id)) >= t.maxParticipants) return;
  const [next] = await tx
    .select()
    .from(tournamentRegistrations)
    .where(and(eq(tournamentRegistrations.tournamentId, t.id), eq(tournamentRegistrations.status, "waitlisted")))
    .orderBy(asc(tournamentRegistrations.statusChangedAt), asc(tournamentRegistrations.createdAt))
    .limit(1);
  if (!next) return;
  const status = rules.approvalMode === "automatic" ? "approved" : "pending";
  const [promoted] = await tx
    .update(tournamentRegistrations)
    .set({ status, statusChangedAt: new Date() })
    .where(eq(tournamentRegistrations.id, next.id))
    .returning();
  if (status === "approved") await createParticipant(tx, promoted!);
  await notifyAfterRegistration(tx, t, promoted!);
  await audit(tx, {
    actorId: null,
    action: "registration.promote",
    entityType: "registration",
    entityId: next.id,
    tournamentId: t.id,
    data: { status },
  });
}

/**
 * Bloquea primero el torneo y después la inscripción: el mismo orden que al inscribirse, para que dos
 * operaciones simultáneas nunca se esperen mutuamente.
 */
async function lockTournamentAndRegistration(tx: Tx, registrationId: string): Promise<[TournamentRow, RegistrationRow]> {
  const [ref] = await tx
    .select({ tournamentId: tournamentRegistrations.tournamentId })
    .from(tournamentRegistrations)
    .where(eq(tournamentRegistrations.id, registrationId));
  if (!ref) throw new AppError("not_found", "errors.registrationNotFound");
  const t = await lockTournament(tx, ref.tournamentId);
  const [reg] = await tx.select().from(tournamentRegistrations).where(eq(tournamentRegistrations.id, registrationId)).for("update");
  if (!reg) throw new AppError("not_found", "errors.registrationNotFound");
  return [t, reg];
}

export async function withdrawRegistration(actor: CurrentUser, registrationId: string): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [t, reg] = await lockTournamentAndRegistration(tx, registrationId);
    const rules = await loadRules(tx, t.id);

    let allowed = canManageTournament(actor, t) || reg.userId === actor.id;
    if (!allowed && reg.teamId) {
      const [team] = await tx.select().from(teams).where(eq(teams.id, reg.teamId));
      allowed = !!team && canManageTeam(actor, team);
    }
    if (!allowed) throw forbidden();
    if (!(ACTIVE as readonly string[]).includes(reg.status)) throw new AppError("invalid_state", "errors.registrationNotActive");
    if (!canWithdraw(tournamentPhase(t, new Date()))) throw new AppError("invalid_state", "errors.cannotWithdraw");

    const wasApproved = reg.status === "approved";
    await tx
      .update(tournamentRegistrations)
      .set({ status: "withdrawn", statusChangedAt: new Date() })
      .where(eq(tournamentRegistrations.id, reg.id));
    await tx.delete(registrationMembers).where(eq(registrationMembers.registrationId, reg.id));
    // Antes de empezar, ningún partido referencia al participante: se puede borrar sin perder historia.
    await tx.delete(tournamentParticipants).where(eq(tournamentParticipants.registrationId, reg.id));
    if (wasApproved) await promoteFromWaitlist(tx, t, rules);
    await audit(tx, {
      actorId: actor.id,
      action: "registration.withdraw",
      entityType: "registration",
      entityId: reg.id,
      tournamentId: t.id,
      data: { previousStatus: reg.status },
    });
  });
}

export type ReviewDecision = "approve" | "reject" | "waitlist";

export async function reviewRegistration(
  actor: CurrentUser,
  registrationId: string,
  decision: ReviewDecision,
  reason: string | null,
): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [t, reg] = await lockTournamentAndRegistration(tx, registrationId);
    if (!canManageTournament(actor, t)) throw forbidden();
    if (t.status !== "published") throw new AppError("invalid_state", "errors.tournamentNotEditable");
    const rules = await loadRules(tx, t.id);
    const params = { entrant: await entrantName(tx, reg), tournament: t.name, reason: reason ?? "" };
    const audience = await registrationAudience(tx, reg);
    const now = new Date();

    if (decision === "approve") {
      if (reg.status !== "pending" && reg.status !== "waitlisted") throw new AppError("invalid_state", "errors.registrationNotPending");
      if ((await approvedCount(tx, t.id)) >= t.maxParticipants) throw new AppError("invalid_state", "errors.noRoomLeft");
      const [updated] = await tx
        .update(tournamentRegistrations)
        .set({ status: "approved", statusChangedAt: now, reviewedById: actor.id, reviewedAt: now, decisionReason: reason })
        .where(eq(tournamentRegistrations.id, reg.id))
        .returning();
      await createParticipant(tx, updated!);
      await notify(tx, audience, "registrationApproved", params, `/torneos/${t.slug}`);
    } else if (decision === "reject") {
      if (!(ACTIVE as readonly string[]).includes(reg.status)) throw new AppError("invalid_state", "errors.registrationNotPending");
      await tx
        .update(tournamentRegistrations)
        .set({ status: "rejected", statusChangedAt: now, reviewedById: actor.id, reviewedAt: now, decisionReason: reason })
        .where(eq(tournamentRegistrations.id, reg.id));
      await tx.delete(registrationMembers).where(eq(registrationMembers.registrationId, reg.id));
      await tx.delete(tournamentParticipants).where(eq(tournamentParticipants.registrationId, reg.id));
      await notify(tx, audience, "registrationRejected", params, `/torneos/${t.slug}`);
      if (reg.status === "approved") await promoteFromWaitlist(tx, t, rules);
    } else {
      if (reg.status !== "pending") throw new AppError("invalid_state", "errors.registrationNotPending");
      await tx
        .update(tournamentRegistrations)
        .set({ status: "waitlisted", statusChangedAt: now, reviewedById: actor.id, reviewedAt: now, decisionReason: reason })
        .where(eq(tournamentRegistrations.id, reg.id));
      await notify(tx, audience, "registrationWaitlisted", params, `/torneos/${t.slug}`);
    }

    await audit(tx, {
      actorId: actor.id,
      action: `registration.${decision}`,
      entityType: "registration",
      entityId: reg.id,
      tournamentId: t.id,
      data: { previousStatus: reg.status, reason },
    });
  });
}
