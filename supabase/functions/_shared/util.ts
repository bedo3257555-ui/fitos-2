// Shared helpers for FitOS edge functions (Deno).
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-cron-secret, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } });
}

/** Constant-time string compare. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Accepts `Authorization: Bearer <SERVICE_ROLE_KEY>` or `x-cron-secret: <CRON_SECRET>`. */
export function isAuthorized(req: Request): boolean {
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const cron = Deno.env.get("CRON_SECRET") ?? "";
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const secret = req.headers.get("x-cron-secret") ?? "";
  if (service && bearer && safeEqual(bearer, service)) return true;
  if (cron && secret && safeEqual(secret, cron)) return true;
  return false;
}

export function adminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Handles OPTIONS + method + auth. Returns a Response to short-circuit, or null to continue. */
export function guard(req: Request): Response | null {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!isAuthorized(req)) return json({ error: "unauthorized" }, 401);
  return null;
}

export async function readBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const t = await req.text();
    return t ? (JSON.parse(t) as Record<string, unknown>) : {};
  } catch {
    throw new Error("invalid_json_body");
  }
}

/* ------------------------------------------------------------------------ dates ---- */
export type DateStr = string; // YYYY-MM-DD
const DAY = 86_400_000;

/** Local calendar date for the configured timezone offset (minutes east of UTC; default +180 = Riyadh). */
export function localToday(offsetMin = Number(Deno.env.get("TZ_OFFSET_MIN") ?? "180")): DateStr {
  return new Date(Date.now() + offsetMin * 60_000).toISOString().slice(0, 10);
}
const ms = (d: DateStr) => Date.parse(d + "T00:00:00Z");
export const addDays = (d: DateStr, n: number): DateStr => new Date(ms(d) + n * DAY).toISOString().slice(0, 10);
export const diffDays = (a: DateStr, b: DateStr) => Math.round((ms(a) - ms(b)) / DAY);
export function daysBetween(start: DateStr, end: DateStr): DateStr[] {
  const n = diffDays(end, start);
  return n < 0 ? [] : Array.from({ length: n + 1 }, (_, i) => addDays(start, i));
}
/** Week starts on Saturday (matches the app). */
export function weekStart(d: DateStr): DateStr {
  const dow = new Date(ms(d)).getUTCDay(); // Sun=0 … Sat=6
  return addDays(d, -((dow + 1) % 7));
}
export const isDate = (s: unknown): s is DateStr => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/* ------------------------------------------------------------------------- math ---- */
export const avg = (a: number[]): number | null => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
export const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
/** Epley, reps-in-reserve adjusted (same as src/lib/analytics.ts). */
export function e1rm(weight: number, reps: number, rir?: number | null): number {
  if (weight <= 0 || reps <= 0) return 0;
  const eff = Math.min(reps + Math.max(0, rir ?? 0), 15);
  return eff <= 1 ? weight : weight * (1 + eff / 30);
}

/* ---------------------------------------------------------------------- database --- */
/** Pages through a table (PostgREST caps a response at 1000 rows). */
// deno-lint-ignore no-explicit-any
export async function fetchAll<T = any>(sb: SupabaseClient, table: string, userId: string, opts: { from?: DateStr; to?: DateStr; dateCol?: string } = {}): Promise<T[]> {
  const out: T[] = [];
  const dc = opts.dateCol ?? "date";
  for (let off = 0; ; off += 1000) {
    let q = sb.from(table).select("*").eq("user_id", userId);
    if (opts.from) q = q.gte(dc, opts.from);
    if (opts.to) q = q.lte(dc, opts.to);
    const { data, error } = await q.order("id").range(off, off + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function listUsers(sb: SupabaseClient, only?: string) {
  let q = sb.from("profiles").select("id, goals");
  if (only) q = q.eq("id", only);
  const { data, error } = await q;
  if (error) throw new Error(`profiles: ${error.message}`);
  return (data ?? []) as { id: string; goals: Record<string, unknown> | null }[];
}

/** Deterministic UUID (v5-style, SHA-1) so re-running a job overwrites instead of duplicating. */
export async function uuidFrom(name: string): Promise<string> {
  const data = new TextEncoder().encode("fitos:" + name);
  const h = new Uint8Array(await crypto.subtle.digest("SHA-1", data)).slice(0, 16);
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = [...h].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

export interface MedSlotRow { id: string }
export interface MedRow { id: string; active: boolean; slots: MedSlotRow[] }
export interface MedLogRow { date: DateStr; medication_id: string; slot_id: string; status: string }

/** Adherence over fully-elapsed days in [start,end]; days before the first med log are ignored. */
export function medAdherence(meds: MedRow[], logs: MedLogRow[], start: DateStr, end: DateStr) {
  const active = meds.filter((m) => m.active);
  const perDay = active.reduce((s, m) => s + (m.slots?.length ?? 0), 0);
  const first = logs.map((l) => l.date).sort()[0];
  if (!first || !perDay) return { pct: null as number | null, taken: 0, expected: 0, missed: 0 };
  const from = start < first ? first : start;
  const days = daysBetween(from, end);
  const taken = logs.filter((l) => l.status === "taken" && l.date >= from && l.date <= end).length;
  const expected = days.length * perDay;
  return { pct: expected ? Math.min(1, taken / expected) : null, taken, expected, missed: Math.max(0, expected - taken) };
}

export function errorResponse(e: unknown): Response {
  const message = e instanceof Error ? e.message : String(e);
  const status = message === "invalid_json_body" ? 400 : 500;
  console.error("[fitos]", message);
  return json({ error: status === 400 ? "invalid_json_body" : "internal_error", message }, status);
}
