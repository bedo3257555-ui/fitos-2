import { addDays as fnsAdd, differenceInCalendarDays, format, parseISO, startOfWeek } from "date-fns";
import { arSA } from "date-fns/locale";
import type { DateStr } from "./types";

export const WEEK_STARTS_ON = 6 as const; // Saturday (Egypt / KSA work-week start)

export const toDateStr = (d: Date): DateStr => format(d, "yyyy-MM-dd");
export const today = (): DateStr => toDateStr(new Date());
export const parse = (s: DateStr): Date => parseISO(s);
export const addDays = (s: DateStr, n: number): DateStr => toDateStr(fnsAdd(parseISO(s), n));
export const diffDays = (a: DateStr, b: DateStr) => differenceInCalendarDays(parseISO(a), parseISO(b));
export const weekStart = (s: DateStr): DateStr => toDateStr(startOfWeek(parseISO(s), { weekStartsOn: WEEK_STARTS_ON }));
export const monthKey = (s: DateStr) => s.slice(0, 7);

export function rangeDays(end: DateStr, count: number): DateStr[] {
  return Array.from({ length: count }, (_, i) => addDays(end, i - (count - 1)));
}
export function daysBetween(start: DateStr, end: DateStr): DateStr[] {
  const n = diffDays(end, start);
  return n < 0 ? [] : Array.from({ length: n + 1 }, (_, i) => addDays(start, i));
}

export const fmt = (s: DateStr, f = "d MMM") => format(parseISO(s), f, { locale: arSA });
export const fmtLong = (s: DateStr) => format(parseISO(s), "EEEE d MMMM yyyy", { locale: arSA });
export const fmtShort = (s: DateStr) => format(parseISO(s), "d/M");

export function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}
export function minToTime(m: number): string {
  const mm = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(mm / 60)).padStart(2, "0")}:${String(mm % 60).padStart(2, "0")}`;
}
export function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}
/** 24h "HH:mm" -> Arabic 12h label like "8:00 ص" */
export function time12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "م" : "ص";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, "0")} ${suffix}`;
}
export const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
