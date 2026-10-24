import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { invitationStatus, lolPosition, mediaKind, teamStatus } from "./enums";

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType() {
    return "bytea";
  },
});

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/**
 * Imágenes subidas (avatares, logotipos, banners y evidencias). Se reducen en el navegador antes de
 * subirse y el servidor comprueba el tipo real por su firma binaria. Se guardan en la base de datos para
 * no depender de un servicio de archivos: con poco volumen es lo más sencillo de desplegar y respaldar.
 */
export const media = pgTable(
  "media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
    kind: mediaKind("kind").notNull(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width"),
    height: integer("height"),
    data: bytea("data").notNull(),
    /** Las evidencias son privadas: solo las ven los implicados en el partido y la organización. */
    isPublic: boolean("is_public").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("media_owner_idx").on(t.ownerId),
    check("media_size_ck", sql`${t.byteSize} > 0 and ${t.byteSize} <= 3145728`),
  ],
);

/** Perfil público del jugador (1:1 con `users`). */
export const profiles = pgTable(
  "profiles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Identificador de la URL pública (`/jugadores/<handle>`), en minúsculas. */
    handle: text("handle").notNull().unique(),
    displayName: text("display_name").notNull(),
    /** Riot ID declarado por el jugador. No se verifica contra Riot (requiere clave de su API). */
    riotGameName: text("riot_game_name"),
    riotTagLine: text("riot_tag_line"),
    region: text("region"),
    mainPosition: lolPosition("main_position"),
    bio: text("bio"),
    avatarMediaId: uuid("avatar_media_id").references(() => media.id, { onDelete: "set null" }),
    isPublic: boolean("is_public").notNull().default(true),
    /** Recibir también por correo los avisos (solo si hay un servidor de correo configurado). */
    notifyByEmail: boolean("notify_by_email").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("profiles_riot_id_uq")
      .on(sql`lower(${t.riotGameName})`, sql`lower(${t.riotTagLine})`)
      .where(sql`${t.riotGameName} is not null`),
    check("profiles_handle_ck", sql`${t.handle} ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$'`),
    check(
      "profiles_riot_id_ck",
      sql`(${t.riotGameName} is null) = (${t.riotTagLine} is null)`,
    ),
  ],
);

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    /** Etiqueta corta (2-5 caracteres), como las de las ligas profesionales. */
    tag: text("tag").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    logoMediaId: uuid("logo_media_id").references(() => media.id, { onDelete: "set null" }),
    captainId: text("captain_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    status: teamStatus("status").notNull().default("active"),
    disbandedAt: timestamp("disbanded_at", { withTimezone: true }),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // Nombre y etiqueta únicos entre los equipos activos, sin distinguir mayúsculas.
    uniqueIndex("teams_name_active_uq").on(sql`lower(${t.name})`).where(sql`${t.status} = 'active'`),
    uniqueIndex("teams_tag_active_uq").on(sql`lower(${t.tag})`).where(sql`${t.status} = 'active'`),
    index("teams_captain_idx").on(t.captainId),
    check("teams_tag_ck", sql`${t.tag} ~ '^[A-Za-z0-9]{2,5}$'`),
  ],
);

export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    position: lolPosition("position"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("team_members_team_user_uq").on(t.teamId, t.userId),
    index("team_members_user_idx").on(t.userId),
  ],
);

export const teamInvitations = pgTable(
  "team_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    inviteeId: text("invitee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    invitedById: text("invited_by_id").references(() => users.id, { onDelete: "set null" }),
    status: invitationStatus("status").notNull().default("pending"),
    message: text("message"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    // Una sola invitación pendiente por equipo y jugador.
    uniqueIndex("team_invitations_pending_uq")
      .on(t.teamId, t.inviteeId)
      .where(sql`${t.status} = 'pending'`),
    index("team_invitations_invitee_idx").on(t.inviteeId, t.status),
  ],
);
