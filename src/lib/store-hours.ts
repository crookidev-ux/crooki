// Pure: is the shop open right now, and when does it open next. Orders placed
// while it is closed are scheduled for the next opening. Colombia has no
// daylight saving time, so a fixed UTC-5 offset is exact and the result never
// depends on the visitor's own clock zone.
export const OPEN_HOUR = 11;
export const CLOSE_HOUR = 21;
export const STORE_TIME_ZONE = "America/Bogota";
const UTC_OFFSET_HOURS = -5;

export type StoreStatus =
  | { open: true }
  /** `opensAt` is an ISO instant; `opensToday` is false when it opens tomorrow. */
  | { open: false; opensAt: string; opensToday: boolean };

export function storeStatus(now: Date = new Date()): StoreStatus {
  const local = new Date(now.getTime() + UTC_OFFSET_HOURS * 3_600_000);
  const hour = local.getUTCHours();
  if (hour >= OPEN_HOUR && hour < CLOSE_HOUR) return { open: true };

  const opensToday = hour < OPEN_HOUR;
  const opensAt = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() + (opensToday ? 0 : 1),
    OPEN_HOUR - UTC_OFFSET_HOURS,
  );
  return { open: false, opensAt: new Date(opensAt).toISOString(), opensToday };
}

/** "lunes, 3 de noviembre" / "Monday, November 3", in the shop's time zone. */
export function openingDayLabel(iso: string, locale: "es" | "en"): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: STORE_TIME_ZONE,
  }).format(new Date(iso));
}

/** Line for the shop (WhatsApp, email, admin): "lunes, 3 de noviembre, 11 a. m." */
export function scheduledLabelEs(iso: string): string {
  return `${openingDayLabel(iso, "es")}, desde las 11 a. m.`;
}
