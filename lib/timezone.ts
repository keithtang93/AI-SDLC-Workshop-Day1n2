import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

export const SINGAPORE_TIMEZONE = "Asia/Singapore";

export function getSingaporeNow(): Date {
  return toZonedTime(new Date(), SINGAPORE_TIMEZONE);
}

export function formatSingaporeDate(
  date: Date | string,
  format = "yyyy-MM-dd'T'HH:mm:ssXXX",
): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return formatInTimeZone(value, SINGAPORE_TIMEZONE, format);
}

export function fromSingaporeLocal(localDateTime: string): Date {
  return fromZonedTime(localDateTime, SINGAPORE_TIMEZONE);
}
