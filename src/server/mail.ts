import "server-only";

/**
 * Envío de correo por SMTP, solo si está configurado (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
 * `SMTP_PASSWORD`, `MAIL_FROM`). Sirve el correo que incluye Hostinger o cualquier otro proveedor.
 *
 * Sin configuración no se finge nada: en desarrollo el mensaje (con su enlace) se escribe en la consola del
 * servidor para poder probar los flujos; en producción no se envía, no se registra su contenido y las
 * pantallas que dependen del correo lo dicen.
 */

export function isMailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.MAIL_FROM);
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
  const transport = await getTransporter();
  await transport.sendMail({ from: process.env.MAIL_FROM, to: message.to, subject: message.subject, text: message.text });
  return "sent";
}
