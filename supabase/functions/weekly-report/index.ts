// weekly-report — builds a weekly (Sat→Fri) or monthly summary per user into `reports`.
// POST { "period"?: "weekly"|"monthly", "week_start"?: "YYYY-MM-DD", "month"?: "YYYY-MM", "user_id"?: uuid }
// Default: the most recently completed week / month. Auth: service-role bearer or x-cron-secret.
import {
  adminClient, addDays, avg, daysBetween, errorResponse, fetchAll, guard, isDate, json, listUsers, localToday, medAdherence, readBody, round,
  weekStart, type DateStr, type MedLogRow, type MedRow,
} from "../_shared/util.ts";

Deno.serve(async (req) => {
  const early = guard(req);
  if (early) return early;
  try {
    const body = await readBody(req);
    const period = body.period === "monthly" ? "monthly" : "weekly";
    const today = localToday();
    let start: DateStr, end: DateStr;
    if (period === "weekly") {
      start = isDate(body.week_start) ? body.week_start : addDays(weekStart(today), -7);
      end = addDays(start, 6);
    } else {
      const m = typeof body.month === "string" && /^\d{4}-\d{2}$/.test(body.month) ? body.month : null;
      const first = m ? `${m}-01` : (() => { const d = new Date(today + "T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() - 1, 1); return d.toISOString().slice(0, 10); })();
      const d = new Date(first + "T00:00:00Z");
      d.setUTCMonth(d.getUTCMonth() + 1, 0);
      start = first; end = d.toISOString().slice(0, 10);
    }
    const only = typeof body.user_id === "string" ? body.user_id : undefined;
    const sb = adminClient();
    const users = await listUsers(sb, only);
    const results: { user_id: string; ok: boolean; error?: string }[] = [];

    for (const u of users) {
      try {
        const data = await buildReport(sb, u.id, (u.goals ?? {}) as Record<string, number>, start, end);
        const { error } = await sb.from("reports").upsert(
          { user_id: u.id, period, start_date: start, end_date: end, data },
          { onConflict: "user_id,period,start_date" },
        );
        if (error) throw new Error(error.message);
        results.push({ user_id: u.id, ok: true });
      } catch (e) {
        results.push({ user_id: u.id, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }
    return json({ ok: true, period, start, end, users: results.length, results });
  } catch (e) {
    return errorResponse(e);
  }
});

// deno-lint-ignore no-explicit-any
async function buildReport(sb: any, userId: string, goals: Record<string, number>, start: DateStr, end: DateStr) {
  const waterGoal = Number(goals.water_ml) || 2000;
  const [meals, water, medsRaw, medLogs, sessions, sets, sleep, meas] = await Promise.all([
    fetchAll<{ date: DateStr; kcal: number; protein_g: number }>(sb, "meal_logs", userId, { from: start, to: end }),
    fetchAll<{ date: DateStr; amount_ml: number }>(sb, "water_logs", userId, { from: start, to: end }),
    fetchAll<MedRow>(sb, "medications", userId, { dateCol: "created_at" }),
    fetchAll<MedLogRow>(sb, "med_logs", userId),
    fetchAll<{ date: DateStr; kind: string; status: string }>(sb, "workout_sessions", userId, { from: start, to: end }),
    fetchAll<{ date: DateStr; weight_kg: number; reps: number; is_warmup: boolean }>(sb, "workout_sets", userId, { from: start, to: end }),
    fetchAll<{ date: DateStr; duration_h: number }>(sb, "sleep_logs", userId, { from: start, to: end }),
    fetchAll<{ date: DateStr; weight_kg: number | null; body_fat_pct: number | null; muscle_mass_kg: number | null }>(sb, "measurements", userId),
  ]);

  const perDay = (rows: { date: DateStr }[], f: (r: never) => number) => {
    const m = new Map<DateStr, number>();
    // deno-lint-ignore no-explicit-any
    rows.forEach((r: any) => m.set(r.date, (m.get(r.date) ?? 0) + f(r as never)));
    return [...m.values()];
  };
  // deno-lint-ignore no-explicit-any
  const kcalDays = perDay(meals, (r: any) => Number(r.kcal));
  // deno-lint-ignore no-explicit-any
  const protDays = perDay(meals, (r: any) => Number(r.protein_g));
  // deno-lint-ignore no-explicit-any
  const waterDays = perDay(water, (r: any) => Number(r.amount_ml));
  const med = medAdherence(medsRaw, medLogs, start, end);
  const working = sets.filter((s) => !s.is_warmup && s.reps > 0);

  const sorted = meas.slice().sort((a, b) => a.date.localeCompare(b.date));
  const change = (k: "weight_kg" | "body_fat_pct" | "muscle_mass_kg") => {
    const inside = sorted.filter((m) => m.date >= start && m.date <= end && m[k] != null);
    if (!inside.length) return null;
    const before = sorted.filter((m) => m.date < start && m[k] != null).pop();
    const base = before ? Number(before[k]) : inside.length > 1 ? Number(inside[0][k]) : null;
    return base == null ? null : round(Number(inside[inside.length - 1][k]) - base, 2);
  };

  return {
    days: daysBetween(start, end).length,
    nutrition: { avg_kcal: round(avg(kcalDays) ?? 0, 0) || null, avg_protein_g: round(avg(protDays) ?? 0, 0) || null, logged_days: kcalDays.length, kcal_target: goals.calories ?? null, protein_target: goals.protein_g ?? null },
    water: { avg_ml: waterDays.length ? Math.round(avg(waterDays)!) : null, goal_days: waterDays.filter((v) => v >= waterGoal).length, goal_ml: waterGoal },
    medications: { adherence_pct: med.pct == null ? null : Math.round(med.pct * 100), taken: med.taken, missed: med.missed },
    training: {
      strength_sessions: sessions.filter((s) => s.kind !== "cardio" && s.status === "completed").length,
      cardio_sessions: sessions.filter((s) => s.kind === "cardio").length,
      hard_sets: working.length,
      volume_load_kg: Math.round(working.reduce((s, x) => s + Number(x.weight_kg) * x.reps, 0)),
    },
    sleep: { avg_hours: sleep.length ? round(avg(sleep.map((s) => Number(s.duration_h)))!) : null, nights: sleep.length },
    body: { weight_change_kg: change("weight_kg"), fat_pct_change: change("body_fat_pct"), smm_change_kg: change("muscle_mass_kg") },
    generated_at: new Date().toISOString(),
  };
}
