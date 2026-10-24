import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";
import { announcementStatus } from "./enums";
import { tournaments } from "./tournaments";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/** Avisos dentro de la aplicación. El tipo es texto (con su unión en TypeScript) para añadir tipos sin migrar. */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    /** Ruta interna a la que lleva el aviso (siempre relativa). */
    link: text("link"),
    /** Parámetros con los que se redactó (para volver a redactarlo en otro idioma). */
    data: jsonb("data"),
    readAt: timestamp("read_at", { withTimezone: true }),
    /** Pendiente de enviarse también por correo (solo se marca si hay SMTP y el usuario lo quiere). */
    emailPending: boolean("email_pending").notNull().default(false),
    emailedAt: timestamp("emailed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("notifications_user_created_idx").on(t.userId, t.createdAt),
    index("notifications_unread_idx").on(t.userId).where(sql`${t.readAt} is null`),
  ],
);

export const announcements = pgTable(
  "announcements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    status: announcementStatus("status").notNull().default("draft"),
    pinned: boolean("pinned").notNull().default(false),
    /** Anuncio de un torneo concreto, o general si es `null`. */
    tournamentId: uuid("tournament_id").references(() => tournaments.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("announcements_status_published_idx").on(t.status, t.publishedAt)],
);

/**
 * Registro de auditoría: quién hizo qué, sobre qué y con qué datos (antes y después). Solo se inserta;
 * la aplicación no tiene ninguna operación que lo modifique o lo borre. No guarda contraseñas, tokens
 * ni direcciones IP.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    tournamentId: uuid("tournament_id").references(() => tournaments.id, { onDelete: "set null" }),
    data: jsonb("data"),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_entity_idx").on(t.entityType, t.entityId),
    index("audit_created_idx").on(t.createdAt),
    index("audit_actor_idx").on(t.actorId),
    index("audit_tournament_idx").on(t.tournamentId),
  ],
);

/** Ajustes de la plataforma editables desde /admin (clave → valor JSON validado con Zod al leer). */
export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedById: text("updated_by_id").references(() => users.id, { onDelete: "set null" }),
  updatedAt: updatedAt(),
});

/** Páginas de contenido editable (privacidad, términos, contacto). */
export const contentPages = pgTable("content_pages", {
  slug: text("slug").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  /** Hasta que un profesional lo revise, la página muestra un aviso visible. */
  legalReviewed: boolean("legal_reviewed").notNull().default(false),
  updatedById: text("updated_by_id").references(() => users.id, { onDelete: "set null" }),
  updatedAt: updatedAt(),
});

/** Ventanas fijas de límite de peticiones (inicio de sesión, registro, acciones sensibles). */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull(),
});

export type RateLimitRow = typeof rateLimits.$inferSelect;
