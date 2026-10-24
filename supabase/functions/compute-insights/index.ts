// compute-insights — daily server-side insights for every user (service role).
// POST {} | { "date": "YYYY-MM-DD", "user_id": "<uuid>" }
// Auth: Authorization: Bearer <SERVICE_ROLE_KEY>  or  x-cron-secret: <CRON_SECRET>
import {
  adminClient, addDays, avg, e1rm, errorResponse, fetchAll, guard, isDate, json, listUsers, localToday, medAdherence, readBody, round, uuidFrom,
  type DateStr, type MedLogRow, type MedRow,
} from "../_shared/util.ts";

type Kind = "insight" | "recommendation" | "warning" | "achievement";
interface Out { rule: string; kind: Kind; title: string; body: string; severity: number }

Deno.serve(async (req) => {
  const early = guard(req);
  if (early) return early;
  try {
    const body = await readBody(req);
    const date: DateStr = isDate(body.date) ? body.date : localToday();
    const only = typeof body.user_id === "string" ? body.user_id : undefined;
    const sb = adminClient();
    const users = await listUsers(sb, only);

    const summary: { user_id: string; generated: number; error?: string }[] = [];
    for (const u of users) {
      try {
        const insights = await buildInsights(sb, u.id, (u.goals ?? {}) as Record<string, number>, date);
        const rows = await Promise.all(insights.map(async (i) => ({
          id: await uuidFrom(`${u.id}:${date}:${i.rule}`), user_id: u.id, date, kind: i.kind, title: i.title, body: i.body, severity: i.severity,
        })));
        // remove today's rows that no longer apply, then upsert the current set
        const keep = rows.map((r) => r.id);
        let del = sb.from("insights").delete().eq("user_id", u.id).eq("date", date);
        if (keep.length) del = del.not("id", "in", `(${keep.join(",")})`);
        const { error: dErr } = await del;
        if (dErr) throw new Error(`insights delete: ${dErr.message}`);
        if (rows.length) {
          const { error } = await sb.from("insights").upsert(rows, { onConflict: "id" });
          if (error) throw new Error(`insights upsert: ${error.message}`);
        }
        await sb.from("insights").delete().eq("user_id", u.id).lt("date", addDays(date, -60)); // retention
        summary.push({ user_id: u.id, generated: rows.length });
      } catch (e) {
        summary.push({ user_id: u.id, generated: 0, error: e instanceof Error ? e.message : String(e) });
      }
    }
    return json({ ok: true, date, users: summary.length, results: summary });
  } catch (e) {
    return errorResponse(e);
  }
});

// deno-lint-ignore no-explicit-any
async function buildInsights(sb: any, userId: string, goals: Record<string, number>, date: DateStr): Promise<Out[]> {
  const out: Out[] = [];
  const waterGoal = Number(goals.water_ml) || 2000;
  const proteinGoal = Number(goals.protein_g) || 66;
  const from14 = addDays(date, -13);
  const last7From = addDays(date, -6);
  const prev7From = addDays(date, -13);
  const prev7To = addDays(date, -7);

  const [water, meals, medsRaw, medLogs, sleep, sets] = await Promise.all([
    fetchAll<{ date: DateStr; amount_ml: number }>(sb, "water_logs", userId, { from: from14, to: date }),
    fetchAll<{ date: DateStr; protein_g: number }>(sb, "meal_logs", userId),
    fetchAll<MedRow>(sb, "medications", userId, { dateCol: "created_at" }),
    fetchAll<MedLogRow>(sb, "med_logs", userId),
    fetchAll<{ date: DateStr; duration_h: number }>(sb, "sleep_logs", userId, { from: last7From, to: date }),
    fetchAll<{ date: DateStr; exercise_name: string; weight_kg: number; reps: number; rir: number | null; is_warmup: boolean }>(sb, "workout_sets", userId),
  ]);

  // 1) Water: 7-day average (days with logs) dropped ≥15% vs previous 7 days
  const dailyWater = (from: DateStr, to: DateStr) => {
    const m = new Map<DateStr, number>();
    water.filter((w) => w.date >= from && w.date <= to).forEach((w) => m.set(w.date, (m.get(w.date) ?? 0) + w.amount_ml));
    return [...m.values()];
  };
  const w7 = avg(dailyWater(last7From, date)), wPrev = avg(dailyWater(prev7From, prev7To));
  if (w7 != null && wPrev != null && wPrev > 0 && (w7 - wPrev) / wPrev <= -0.15) {
    out.push({ rule: "water-drop", kind: "warning", severity: 2, title: "انخفض الالتزام بالمياه خلال آخر 7 أيام", body: `المتوسط ${Math.round(w7)} مل مقابل ${Math.round(wPrev)} مل في الأسبوع السابق (الهدف ${waterGoal} مل).` });
  }

  // 2) Medication adherence < 80% over the last 7 fully elapsed days
  const med = medAdherence(medsRaw, medLogs, last7From, addDays(date, -1));
  if (med.pct != null && med.expected >= 6 && med.pct < 0.8) {
    out.push({ rule: "med-low", kind: "warning", severity: 3, title: "انخفض الالتزام الدوائي", body: `الالتزام ${Math.round(med.pct * 100)}% — فاتتك ${med.missed} جرعة خلال آخر 7 أيام. (التطبيق يتتبع الالتزام فقط ولا يعدّل الجرعات؛ ناقش أي تغيير مع طبيبك.)` });
  }

  // 3) Protein average < 90% of goal (days with logs, at least 3 days)
  const byDay = new Map<DateStr, number>();
  meals.filter((m) => m.date >= last7From && m.date <= date).forEach((m) => byDay.set(m.date, (byDay.get(m.date) ?? 0) + Number(m.protein_g)));
  if (byDay.size >= 3) {
    const p = avg([...byDay.values()])!;
    if (p < proteinGoal * 0.9) out.push({ rule: "protein-low", kind: "recommendation", severity: 2, title: "البروتين أقل من المطلوب", body: `المتوسط ${Math.round(p)} جم مقابل ${proteinGoal} جم يوميًا.` });
  }

  // 4) New PR in the last 7 days (Epley e1RM beats all previous history)
  const sorted = sets.filter((s) => !s.is_warmup && s.reps > 0).sort((a, b) => a.date.localeCompare(b.date));
  const best = new Map<string, number>();
  const prs = new Map<string, { e: number; prev: number; w: number; r: number }>();
  for (const s of sorted) {
    const e = e1rm(Number(s.weight_kg), s.reps, s.rir);
    const prev = best.get(s.exercise_name) ?? 0;
    if (e > prev + 0.01) {
      if (prev > 0 && s.date >= last7From) prs.set(s.exercise_name, { e, prev, w: Number(s.weight_kg), r: s.reps });
      best.set(s.exercise_name, e);
    }
  }
  [...prs.entries()].slice(0, 3).forEach(([name, p]) => out.push({
    rule: `pr-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, kind: "achievement", severity: 1,
    title: `قمت بتسجيل رقم قياسي جديد في تمرين ${name}`, body: `${p.w} كجم × ${p.r} (e1RM ≈ ${round(p.e)} كجم، السابق ${round(p.prev)}).`,
  }));

  // 5) Sleep average < 6.5h (at least 3 nights)
  if (sleep.length >= 3) {
    const h = avg(sleep.map((s) => Number(s.duration_h)))!;
    if (h < 6.5) out.push({ rule: "sleep-short", kind: "warning", severity: 2, title: "متوسط النوم أقل من 6.5 ساعة", body: `المتوسط ${round(h)} ساعة خلال آخر 7 أيام. الخطة تطلب النوم قبل 11 مساءً.` });
  }

  // 6) No meal logs for 3 days
  const lastMeal = meals.map((m) => m.date).sort().pop();
  if (!lastMeal || lastMeal <= addDays(date, -3)) {
    out.push({ rule: "no-meals", kind: "recommendation", severity: 2, title: "سجّل وجباتك لتحصل على تحليل دقيق", body: lastMeal ? `آخر تسجيل للوجبات كان بتاريخ ${lastMeal}.` : "لم تُسجَّل أي وجبات بعد." });
  }
  return out;
}
