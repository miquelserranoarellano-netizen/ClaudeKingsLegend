import "server-only";
import { desc, eq } from "drizzle-orm";
import { audit } from "./audit";
import { getDb, isCloudflareWorker } from "./db/client";
import { auditLogs } from "./db/schema";

/**
 * Envío de correo, solo si está configurado. Dos formas (siempre con `MAIL_FROM`):
 *
 * - **Resend** (`RESEND_API_KEY`): una API HTTP. Es la recomendada en Cloudflare Workers, donde las
 *   conexiones SMTP no son fiables. Plan gratuito suficiente para una liga.
 * - **SMTP** (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`): una cuenta de Gmail con contraseña
 *   de aplicación (gratis y sin dominio propio), el correo de Hostinger o cualquier otro proveedor. En
 *   Cloudflare Workers se envía con `worker-mailer` (sockets TCP del Worker); en Node, con `nodemailer`.
 *
 * Sin configuración no se finge nada: en desarrollo el mensaje (con su enlace) se escribe en la consola del
 * servidor para poder probar los flujos; en producción no se envía, no se registra su contenido y las
 * pantallas que dependen del correo lo dicen.
 */

export function mailProvider(): "resend" | "smtp" | null {
  if (!process.env.MAIL_FROM) return null;
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.SMTP_HOST) return "smtp";
  return null;
}

export function isMailConfigured(): boolean {
  return mailProvider() !== null;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

type Transporter = { sendMail(message: Record<string, unknown>): Promise<unknown> };
let transporter: Promise<Transporter> | null = null;

async function getTransporter(): Promise<Transporter> {
  if (!transporter) {
    transporter = import("nodemailer").then((nodemailer) =>
      nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 465,
        secure: (Number(process.env.SMTP_PORT) || 465) === 465,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
      }),
    );
  }
  return transporter;
}

export type MailOutcome = "sent" | "logged" | "skipped";

export async function sendMail(message: MailMessage): Promise<MailOutcome> {
  if (!isMailConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.info(
        `\n[correo NO enviado: no hay SMTP configurado — solo desarrollo]\nAsunto: ${message.subject}\n${message.text}\n`,
      );
      return "logged";
    }
    console.warn("[correo] no hay SMTP configurado; no se ha enviado un correo:", message.subject);
    return "skipped";
  }
  try {
    if (mailProvider() === "resend") await sendWithResend(message);
    else if (isCloudflareWorker()) await sendWithWorkerSmtp(message);
    else {
      const transport = await getTransporter();
      await transport.sendMail({ from: process.env.MAIL_FROM, to: message.to, subject: message.subject, text: message.text });
    }
    return "sent";
  } catch (error) {
    // Better Auth se traga los errores de sus correos: sin esto, un SMTP mal configurado no deja rastro.
    // Solo el asunto y el motivo; ni el destinatario ni el enlace.
    const reason = (error instanceof Error ? error.message : String(error)).slice(0, 500);
    console.error(`[correo] no se ha podido enviar «${message.subject}»:`, reason);
    await recordMailFailure(message.subject, reason);
    throw error;
  }
}

/**
 * Deja el fallo en la auditoría para que se vea en `/admin/ajustes` sin tener que buscar en los registros del
 * servidor. Si tampoco se puede guardar, solo queda la línea de la consola.
 */
async function recordMailFailure(subject: string, reason: string): Promise<void> {
  try {
    await audit(await getDb(), {
      actorId: null,
      action: "mail.failed",
      entityType: "mail",
      entityId: mailProvider() ?? "none",
      data: { subject, reason },
    });
  } catch (error) {
    console.error("[correo] tampoco se ha podido guardar el fallo:", error instanceof Error ? error.message : error);
  }
}

/** Último fallo de envío registrado (para el estado del servidor en la administración). */
export async function lastMailFailure(): Promise<{ at: Date; subject: string; reason: string } | null> {
  const db = await getDb();
  const [row] = await db
    .select({ createdAt: auditLogs.createdAt, data: auditLogs.data })
    .from(auditLogs)
    .where(eq(auditLogs.action, "mail.failed"))
    .orderBy(desc(auditLogs.createdAt))
    .limit(1);
  if (!row) return null;
  const data = (row.data ?? {}) as { subject?: string; reason?: string };
  return { at: row.createdAt, subject: data.subject ?? "", reason: data.reason ?? "" };
}

/** API de Resend (https://resend.com/docs/api-reference/emails/send-email). */
async function sendWithResend(message: MailMessage): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to: [message.to], subject: message.subject, text: message.text }),
  });
  if (!response.ok) {
    // Sin el cuerpo de la respuesta ni el destinatario en el registro: solo el código.
    throw new Error(`Resend respondió ${response.status}`);
  }
}

/**
 * «Kings Legend <liga@gmail.com>» → nombre y dirección (o solo la dirección). También acepta el olvido de los
 * `< >` («Kings Legend liga@gmail.com»): la dirección es la palabra con arroba y el resto, el nombre.
 */
export function parseFrom(from: string): { name?: string; email: string } {
  const match = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(from);
  if (match) return match[1] ? { name: match[1].trim(), email: match[2]!.trim() } : { email: match[2]!.trim() };
  const loose = /^(.*?)\s*([^\s<>"]+@[^\s<>"]+)\s*$/.exec(from.trim());
  if (loose) {
    const name = loose[1]!.replace(/^"|"$/g, "").trim();
    return name ? { name, email: loose[2]! } : { email: loose[2]! };
  }
  return { email: from.trim() };
}

/**
 * SMTP desde un Worker. Puerto 465: TLS desde el principio; 587: STARTTLS. El paquete solo funciona en el
 * runtime de Workers (`cloudflare:sockets`), así que se importa aquí, cuando hace falta. Se pide su versión ESM:
 * la CommonJS (la que elegiría el empaquetador) hace `require("cloudflare:sockets")`, que el Worker no admite.
 */
async function sendWithWorkerSmtp(message: MailMessage): Promise<void> {
  const { WorkerMailer } = await import("worker-mailer/dist/index.mjs");
  const port = Number(process.env.SMTP_PORT) || 465;
  await WorkerMailer.send(
    {
      host: process.env.SMTP_HOST!,
      port,
      secure: port === 465,
      startTls: port !== 465,
      credentials: process.env.SMTP_USER ? { username: process.env.SMTP_USER, password: process.env.SMTP_PASSWORD ?? "" } : undefined,
      authType: ["plain", "login"],
    },
    { from: parseFrom(process.env.MAIL_FROM!), to: message.to, subject: message.subject, text: message.text },
  );
}
