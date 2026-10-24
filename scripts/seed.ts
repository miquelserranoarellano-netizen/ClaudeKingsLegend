/**
 * SEED DE DESARROLLO — datos de demostración. Nunca se ejecuta en producción.
 *
 *   npm run db:seed
 *
 * Crea cuentas, equipos, torneos (abiertos, próximos, en curso y terminados), resultados y anuncios, todos
 * marcados como demo (`is_demo`) para que la interfaz los señale como tales. Usa los mismos servicios que
 * la aplicación, así que los cuadros, los BYE y las clasificaciones se generan con las reglas reales.
 *
 * Cuentas de demostración (contraseña de todas: `demo-kings-legend`, solo para desarrollo):
 *   admin@demo.kingslegend.test       administrador
 *   organiza@demo.kingslegend.test    organizador
 *   jugador1@demo.kingslegend.test … jugador40@demo.kingslegend.test
 *
 * Con la base local (PGlite), para antes el servidor de desarrollo: solo admite un proceso a la vez.
 */
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, eq, inArray } from "drizzle-orm";
import type { CurrentUser } from "@/server/auth/session";
import { type Db, getDb } from "@/server/db/client";
import { accounts, announcements, matches, profiles, teamMembers, teams, tournaments, users } from "@/server/db/schema";
import { validateResult } from "@/features/matches/service";
import { registerSolo, registerTeam } from "@/features/registrations/service";
import { createTeam } from "@/features/teams/service";
import type { TournamentInput } from "@/features/tournaments/schemas";
import { closeRegistrations, createTournament, publishTournament, startTournament } from "@/features/tournaments/service";

const DEMO_PASSWORD = "demo-kings-legend";
const DAY = 24 * 60 * 60 * 1000;

function guard() {
  if (process.env.NODE_ENV === "production") {
    console.error("El seed de demostración no se ejecuta con NODE_ENV=production.");
    process.exit(1);
  }
  const url = process.env.DATABASE_URL?.trim();
  if (url && !/@(localhost|127\.0\.0\.1|db)(:\d+)?\//.test(url) && !process.argv.includes("--permitir-remota")) {
    console.error("DATABASE_URL apunta a un servidor remoto. El seed solo se ejecuta contra bases locales (usa --permitir-remota si de verdad es de pruebas).");
    process.exit(1);
  }
}

async function createUser(db: Db, input: { email: string; name: string; handle: string; role?: "user" | "organizer" | "admin"; riot?: [string, string]; position?: "top" | "jungle" | "mid" | "bottom" | "support" | "fill" }): Promise<CurrentUser> {
  const id = randomUUID().replace(/-/g, "");
  await db.insert(users).values({ id, name: input.name, email: input.email, emailVerified: true, role: input.role ?? "user", isDemo: true });
  await db.insert(accounts).values({ id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: await hashPassword(DEMO_PASSWORD) });
  await db.insert(profiles).values({
    userId: id,
    handle: input.handle,
    displayName: input.name,
    riotGameName: input.riot?.[0] ?? null,
    riotTagLine: input.riot?.[1] ?? null,
    region: "EUW",
    mainPosition: input.position ?? null,
  });
  return { id, role: input.role ?? "user", suspended: false, email: input.email, emailVerified: true, handle: input.handle, displayName: input.name, avatarMediaId: null, hasRiotId: !!input.riot };
}

function tournamentInput(overrides: Partial<TournamentInput> & Pick<TournamentInput, "name">): TournamentInput {
  const now = Date.now();
  return {
    summary: null,
    description: null,
    rulesText:
      "1. Los equipos deben estar en la sala 10 minutos antes de la hora.\n2. Elección de lado: el equipo con mejor semilla elige en la primera partida; después, el perdedor.\n3. Pausas: máximo 10 minutos por equipo y partida.\n4. Incomparecencia: 15 minutos de cortesía.\n5. Comportamiento: cualquier conducta tóxica puede suponer la descalificación.",
    prizeDescription: null,
    format: "single_elimination",
    participantType: "team",
    visibility: "public",
    region: "EUW",
    registrationOpensAt: new Date(now - 10 * DAY),
    registrationClosesAt: new Date(now + 5 * DAY),
    startsAt: new Date(now + 7 * DAY),
    endsAt: null,
    minParticipants: 4,
    maxParticipants: 16,
    teamSize: 5,
    maxSubstitutes: 1,
    bestOf: 1,
    bestOfFinal: 3,
    pointsWin: 3,
    pointsLoss: 0,
    pointsForfeitLoss: 0,
    tiebreakers: ["head_to_head", "game_difference", "games_won"],
    leagueLegs: 1,
    grandFinalReset: true,
    approvalMode: "automatic",
    waitlistEnabled: true,
    requireRiotId: true,
    ...overrides,
  };
}

/** Valida todos los partidos disputables de un torneo (el ganador, al azar pero reproducible). */
async function playMatches(db: Db, organizer: CurrentUser, tournamentId: string, limit = Infinity, seed = 7) {
  let random = seed;
  const next = () => {
    random = (random * 9301 + 49297) % 233280;
    return random / 233280;
  };
  let played = 0;
  while (played < limit) {
    const open = await db
      .select()
      .from(matches)
      .where(and(eq(matches.tournamentId, tournamentId), inArray(matches.status, ["pending", "scheduled"])));
    const playable = open.find((m) => m.participantAId && m.participantBId);
    if (!playable) break;
    const needed = Math.floor(playable.bestOf / 2) + 1;
    const loserGames = Math.floor(next() * needed);
    const aWins = next() < 0.55;
    await validateResult(organizer, {
      matchId: playable.id,
      version: playable.version,
      manual: {
        scoreA: aWins ? needed : loserGames,
        scoreB: aWins ? loserGames : needed,
        isForfeit: false,
        gameWinners: null,
        mvpUserId: null,
        notes: null,
      },
    });
    played += 1;
  }
  return played;
}

async function main() {
  guard();
  const db = await getDb();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.isDemo, true)).limit(1);
  if (existing) {
    console.log("Ya hay datos de demostración. Para empezar de cero, borra la carpeta .data (base local) y vuelve a ejecutar el seed.");
    return;
  }

  console.log("Creando cuentas de demostración…");
  await createUser(db, { email: "admin@demo.kingslegend.test", name: "Admin Demo", handle: "admin-demo", role: "admin" });
  const organizer = await createUser(db, { email: "organiza@demo.kingslegend.test", name: "Organización Demo", handle: "organiza-demo", role: "organizer" });

  const positions = ["top", "jungle", "mid", "bottom", "support"] as const;
  const nicknames = [
    "Aurora", "Brisa", "Cobalto", "Dardo", "Eclipse", "Fénix", "Granito", "Halcón", "Ícaro", "Jade",
    "Kraken", "Lince", "Mistral", "Nébula", "Onix", "Pólvora", "Quásar", "Rayo", "Sable", "Tormenta",
    "Umbra", "Vórtice", "Wyvern", "Xenón", "Yunque", "Zafiro", "Ámbar", "Bruma", "Centella", "Duna",
    "Escarcha", "Forja", "Glaciar", "Hydra", "Iris", "Jaguar", "Karma", "Lava", "Magma", "Niebla",
  ];
  const players: CurrentUser[] = [];
  for (const [i, nick] of nicknames.entries()) {
    players.push(
      await createUser(db, {
        email: `jugador${i + 1}@demo.kingslegend.test`,
        name: nick,
        handle: `demo-${nick.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()}`,
        riot: [`${nick}KL`, "EUW"],
        position: positions[i % 5],
      }),
    );
  }

  console.log("Creando equipos…");
  const teamNames: [string, string][] = [
    ["Coronas de Hierro", "CDH"], ["Lobos del Norte", "LDN"], ["Atlas Esports", "ATL"], ["Marea Roja", "MRJ"],
    ["Centinelas", "CNT"], ["Vanguardia Azul", "VGA"], ["Dragones Pálidos", "DRP"], ["Nexo Rebelde", "NXR"],
  ];
  const createdTeams: { id: string; captain: CurrentUser; members: CurrentUser[] }[] = [];
  for (const [i, [name, tag]] of teamNames.entries()) {
    const members = players.slice(i * 5, i * 5 + 5);
    const captain = members[0]!;
    const team = await createTeam(captain, { name, tag, description: `Equipo de demostración ${i + 1}.` });
    for (const m of members.slice(1)) await db.insert(teamMembers).values({ teamId: team.id, userId: m.id });
    createdTeams.push({ id: team.id, captain, members });
  }
  await db.update(teams).set({ isDemo: true });

  const register = async (tournamentId: string, entries: typeof createdTeams) => {
    for (const team of entries) {
      await registerTeam(team.captain, {
        tournamentId,
        teamId: team.id,
        roster: team.members.map((m) => ({ userId: m.id, isSubstitute: false })),
        note: null,
        accessCode: null,
      });
    }
  };

  console.log("Torneo en curso (eliminación simple, 8 equipos)…");
  const cup = await createTournament(
    organizer,
    tournamentInput({ name: "Copa Otoño Kings", summary: "Ocho equipos, eliminación directa y final al mejor de tres.", prizeDescription: "Trofeo y medallas para el equipo campeón.", maxSubstitutes: 0, maxParticipants: 8 }),
  );
  await publishTournament(organizer, cup.id);
  await register(cup.id, createdTeams);
  await closeRegistrations(organizer, cup.id);
  await startTournament(organizer, cup.id);
  await playMatches(db, organizer, cup.id, 5, 3);
  const pending = await db.select().from(matches).where(and(eq(matches.tournamentId, cup.id), inArray(matches.status, ["pending"])));
  const programmable = pending.filter((m) => m.participantAId && m.participantBId);
  for (const [i, m] of programmable.entries()) {
    await db.update(matches).set({ scheduledAt: new Date(Date.now() + (i + 1) * DAY), status: "scheduled" }).where(eq(matches.id, m.id));
  }

  console.log("Liga en curso (6 equipos)…");
  const league = await createTournament(
    organizer,
    tournamentInput({ name: "Liga Invierno", summary: "Todos contra todos a una vuelta. Puntúa cada victoria.", format: "league", maxSubstitutes: 0, maxParticipants: 6 }),
  );
  await publishTournament(organizer, league.id);
  await register(league.id, createdTeams.slice(0, 6));
  await closeRegistrations(organizer, league.id);
  await startTournament(organizer, league.id);
  await playMatches(db, organizer, league.id, 9, 11);

  console.log("Torneo terminado (doble eliminación, 5 equipos)…");
  const de = await createTournament(
    organizer,
    tournamentInput({ name: "Relámpago de Medianoche", summary: "Doble eliminación exprés con cinco equipos (incluye BYE).", format: "double_elimination", maxSubstitutes: 0, maxParticipants: 8 }),
  );
  await publishTournament(organizer, de.id);
  await register(de.id, createdTeams.slice(2, 7));
  await closeRegistrations(organizer, de.id);
  await startTournament(organizer, de.id);
  await playMatches(db, organizer, de.id, Infinity, 29);

  console.log("Torneos abiertos y próximos…");
  const open = await createTournament(
    organizer,
    tournamentInput({ name: "Open Primavera", summary: "Inscripción abierta: hasta 16 equipos.", prizeDescription: "Camisetas para el equipo campeón.", approvalMode: "manual" }),
  );
  await publishTournament(organizer, open.id);
  await register(open.id, createdTeams.slice(5, 8));

  const upcoming = await createTournament(
    organizer,
    tournamentInput({
      name: "Clash de Verano",
      summary: "Las inscripciones abren pronto.",
      registrationOpensAt: new Date(Date.now() + 3 * DAY),
      registrationClosesAt: new Date(Date.now() + 10 * DAY),
      startsAt: new Date(Date.now() + 12 * DAY),
      format: "double_elimination",
    }),
  );
  await publishTournament(organizer, upcoming.id);

  const solo = await createTournament(
    organizer,
    tournamentInput({ name: "Duelo 1v1 Abismo", summary: "Torneo individual de 1 contra 1 en el Abismo de los Lamentos.", participantType: "solo", teamSize: 1, maxSubstitutes: 0, minParticipants: 4, maxParticipants: 32, bestOf: 1, bestOfFinal: 3 }),
  );
  await publishTournament(organizer, solo.id);
  for (const p of players.slice(0, 6)) await registerSolo(p, { tournamentId: solo.id, note: null, accessCode: null });

  await db.update(tournaments).set({ isDemo: true });

  await db.insert(announcements).values([
    {
      title: "Bienvenidos a Kings Legend (demo)",
      body: "Esto es un anuncio de demostración: así se ven las noticias de la plataforma. Los datos que ves son de ejemplo y solo existen en desarrollo.",
      status: "published",
      pinned: true,
      publishedAt: new Date(),
      authorId: organizer.id,
      isDemo: true,
    },
    {
      title: "Horarios de cuartos de final",
      body: "Los cuartos de la Copa Otoño se juegan esta semana. Revisad la pestaña de partidos para ver vuestro horario.",
      status: "published",
      tournamentId: cup.id,
      publishedAt: new Date(Date.now() - DAY),
      authorId: organizer.id,
      isDemo: true,
    },
  ]);

  console.log(`\nListo. Cuentas de demostración con la contraseña «${DEMO_PASSWORD}»: admin@demo.kingslegend.test, organiza@demo.kingslegend.test y jugador1…40@demo.kingslegend.test.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("El seed ha fallado:", error);
    process.exit(1);
  });
