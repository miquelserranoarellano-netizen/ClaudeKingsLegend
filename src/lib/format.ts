import { DISPLAY_TIME_ZONE, getLocale, localeTags } from "@/i18n";

const tag = () => localeTags[getLocale()];

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat(tag(), { dateStyle: "medium", timeZone: DISPLAY_TIME_ZONE }).format(new Date(date));
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat(tag(), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: DISPLAY_TIME_ZONE,
  }).format(new Date(date));
}

/** «sáb, 14 nov» para tarjetas compactas. */
export function formatShortDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat(tag(), {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: DISPLAY_TIME_ZONE,
  }).format(new Date(date));
}

export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat(tag(), { timeStyle: "short", timeZone: DISPLAY_TIME_ZONE }).format(new Date(date));
}

/** «hace 3 h», «dentro de 2 días». */
export function formatRelative(date: Date | string, now: Date = new Date()): string {
  const diff = new Date(date).getTime() - now.getTime();
  const rtf = new Intl.RelativeTimeFormat(tag(), { numeric: "auto" });
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (abs < hour) return rtf.format(Math.round(diff / minute), "minute");
  if (abs < day) return rtf.format(Math.round(diff / hour), "hour");
  if (abs < 30 * day) return rtf.format(Math.round(diff / day), "day");
  return formatDate(date);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(tag()).format(value);
}

/** Valor para un `<input type="datetime-local">` en la zona horaria de la plataforma. */
export function toDateTimeLocal(date: Date | string | null | undefined): string {
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DISPLAY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(date));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/**
 * Convierte el valor de un `<input type="datetime-local">` (hora de la plataforma) a un instante UTC.
 * Calcula el desfase de la zona horaria en esa fecha concreta, así respeta el cambio de hora.
 */
export function fromDateTimeLocal(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number) as [number, number, number, number, number, number];
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  // Desfase de la zona en ese instante: se formatea el instante «como UTC» en la zona y se compara.
  const offsetAt = (instant: number) => {
    const local = toDateTimeLocal(new Date(instant));
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local)!;
    const [, ly, lmo, ld, lh, lmi] = m.map(Number) as [number, number, number, number, number, number];
    return Date.UTC(ly, lmo - 1, ld, lh, lmi) - instant;
  };
  const guess = asUtc - offsetAt(asUtc);
  const result = asUtc - offsetAt(guess);
  return new Date(result);
}
