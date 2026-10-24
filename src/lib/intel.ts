/**
 * FitOS — طبقة الذكاء (Intelligence layer)
 *
 * دوال نقية تقرأ البيانات الحالية فقط، ولا تعدّل شيئًا في:
 *   • النظام الغذائي (الحصص / الأهداف / الـ Exchange)
 *   • برنامج التمرين (التمارين / المجاميع / الدورة)
 * كل ما هنا استرشادي: توقّعات، جاهزية، إيقاع الماء والوجبات، أنماط الأدوية، تحفيز، وخطة اليوم.
 */
import { MEALS, MEAL_ORDER, SPLITS } from "./constants";
import { addDays, daysBetween, diffDays, fmt, nowMinutes, timeToMin, today as todayStr, weekStart } from "./dates";
import {
  avg, clamp, dayNutrition, dayScores, exerciseHistory, foodCompliance, latestValue, medAdherence, nextSplit, pearson, periodReport,
  prEvents, round, scoreSeries, sleepScore, slotsOn, sortedMeasurements, sum, trackingStart, waterOn, waterStreak, weightSeries,
  type Correlation, type DayScores,
} from "./analytics";
import type { DB, DateStr, Insight, MealKey, MuscleGroup } from "./types";

const SHORT_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const doses = (n: number) => (n === 1 ? "جرعة" : n === 2 ? "جرعتان" : n <= 10 ? `${n} جرعات` : `${n} جرعة`);
const cupsText = (n: number) => (n === 1 ? "كوب" : n === 2 ? "كوبين" : n <= 10 ? `${n} أكواب` : `${n} كوبًا`);
const dow = (d: DateStr) => new Date(`${d}T12:00:00`).getDay();

/* ============================================================== weight forecast ==== */
export type TrendStatus = "reached" | "on_track" | "slow" | "stalled" | "wrong_way" | "insufficient";
export interface WeightTrend {
  current: number | null; target: number; remaining: number | null;
  ratePerWeek: number | null; fatRatePerWeek: number | null;
  etaDate: DateStr | null; etaWeeks: number | null;
  status: TrendStatus; points: number; confidence: "low" | "medium" | "high"; plateau: boolean;
  headline: string; detail: string;
}

function regress(points: { x: number; y: number }[]): { slope: number; intercept: number } | null {
  const n = points.length;
  if (n < 2) return null;
  const mx = sum(points.map((p) => p.x)) / n, my = sum(points.map((p) => p.y)) / n;
  let num = 0, den = 0;
  for (const p of points) { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2; }
  if (den === 0) return null;
  const s = num / den;
  return { slope: s, intercept: my - s * mx };
}

export function weightTrend(db: DB, date: DateStr = todayStr(), lookbackDays = 70): WeightTrend {
  const g = db.profile?.goals;
  const target = g?.target_weight_kg ?? 0;
  const pts = weightSeries(db).filter((p) => p.date <= date && diffDays(date, p.date) <= lookbackDays);
  const base: WeightTrend = {
    current: pts.length ? pts[pts.length - 1].weight : null, target, remaining: null, ratePerWeek: null, fatRatePerWeek: null,
    etaDate: null, etaWeeks: null, status: "insufficient", points: pts.length, confidence: "low", plateau: false,
    headline: "محتاج قياسين على الأقل لتوقّع الوصول للهدف", detail: "سجّل وزنك أسبوعيًا (نفس الوقت والظروف) لتظهر التوقعات.",
  };
  if (!pts.length || !target) return base;
  const current = pts[pts.length - 1].weight;
  const remaining = round(current - target, 2);
  base.current = current; base.remaining = remaining;

  const x0 = pts[0].date;
  const reg = regress(pts.map((p) => ({ x: diffDays(p.date, x0), y: p.weight })));
  const span = diffDays(pts[pts.length - 1].date, x0);

  const fatPts = sortedMeasurements(db).filter((m) => m.fat_mass_kg != null && m.date <= date && diffDays(date, m.date) <= lookbackDays);
  const fatReg = fatPts.length >= 2 ? regress(fatPts.map((m) => ({ x: diffDays(m.date, fatPts[0].date), y: m.fat_mass_kg as number }))) : null;
  base.fatRatePerWeek = fatReg && diffDays(fatPts[fatPts.length - 1].date, fatPts[0].date) >= 6 ? round(fatReg.slope * 7, 2) : null;

  if (Math.abs(remaining) <= 0.2) {
    return { ...base, status: "reached", confidence: "high", headline: "وصلت للوزن المستهدف 🎯", detail: `وزنك ${current} كجم ≈ المستهدف ${target} كجم. ركّز الآن على تثبيت العضلات.` };
  }
  if (remaining < -0.2) {
    return { ...base, status: "reached", confidence: "high", headline: "تجاوزت الوزن المستهدف", detail: `وزنك ${current} كجم أقل من ${target} كجم بـ ${Math.abs(remaining)} كجم — راجع نسبة العضلات في InBody.` };
  }
  if (!reg || span < 6 || pts.length < 2) return base;

  const rate = round(reg.slope * 7, 2); // kg / week (negative = losing)
  const confidence: WeightTrend["confidence"] = pts.length >= 4 && span >= 21 ? "high" : pts.length >= 3 ? "medium" : "low";
  const plateau = pts.length >= 3 && diffDays(date, pts[pts.length - 3].date) <= 35 && Math.max(...pts.slice(-3).map((p) => p.weight)) - Math.min(...pts.slice(-3).map((p) => p.weight)) <= 0.4;
  const lossSpeed = -rate;
  let status: TrendStatus, headline: string, detail: string, etaWeeks: number | null = null, etaDate: DateStr | null = null;

  if (lossSpeed >= 0.1) {
    etaWeeks = remaining / lossSpeed;
    if (etaWeeks <= 104) etaDate = addDays(date, Math.round(etaWeeks * 7)); else etaWeeks = null;
  }
  if (lossSpeed >= 0.2) {
    status = "on_track";
    headline = etaDate ? `متوقّع تصل للهدف في ${fmt(etaDate, "d MMMM yyyy")}` : "ماشي في الاتجاه الصحيح";
    detail = `معدل النزول ≈ ${round(lossSpeed, 2)} كجم/أسبوع، وباقي ${remaining} كجم. ${lossSpeed > 0.75 ? "المعدل أسرع من الأمان للحفاظ على العضلات — راقب البروتين والنوم." : "معدل مناسب للحفاظ على العضلات."}`;
  } else if (lossSpeed >= 0.1) {
    status = "slow";
    headline = etaDate ? `بطيء لكن ثابت — الهدف تقريبًا ${fmt(etaDate, "d MMMM yyyy")}` : "النزول بطيء";
    detail = `≈ ${round(lossSpeed, 2)} كجم/أسبوع. في إعادة تركيب الجسم الوزن مش المؤشر الوحيد — قارن بالدهون والعضلات في InBody والمحيطات.`;
  } else if (rate > 0.15) {
    status = "wrong_way";
    headline = "الوزن بيزيد عن المطلوب";
    detail = `الاتجاه +${round(rate, 2)} كجم/أسبوع. لو العضلات بتزيد فده طبيعي، وإلا راجع الالتزام بالحصص مع الدكتور.`;
  } else {
    status = "stalled";
    headline = plateau ? "ثبات في الوزن (Plateau)" : "الوزن شبه ثابت";
    detail = "التغيّر أقل من 0.1 كجم/أسبوع. الثبات لمدة 3–4 أسابيع يستدعي مراجعة السجلّ الغذائي والنوم، وليس تغيير البرنامج بنفسك.";
  }
  return { ...base, ratePerWeek: rate, etaDate, etaWeeks: etaWeeks == null ? null : round(etaWeeks, 1), status, confidence, plateau, headline, detail };
}

/** نقاط للرسم: الأوزان الفعلية + خط توقّع متقطع للأسابيع القادمة. */
export function weightProjection(db: DB, date: DateStr = todayStr(), weeksAhead = 12, rateOverride?: number | null) {
  const tr = weightTrend(db, date);
  const actual = weightSeries(db).map((p) => ({ date: p.date, actual: p.weight as number | null, projected: null as number | null }));
  if (tr.current == null || (tr.ratePerWeek == null && rateOverride == null) || tr.status === "reached") return { rows: actual, trend: tr };
  const last = actual[actual.length - 1];
  last.projected = last.actual;
  const rate = rateOverride ?? (tr.status === "stalled" ? 0 : (tr.ratePerWeek as number));
  const rows = [...actual];
  for (let w = 1; w <= weeksAhead; w++) {
    const w0 = round(tr.current + rate * w, 2);
    rows.push({ date: addDays(last.date, w * 7), actual: null, projected: w0 });
    if (rate < 0 && w0 <= tr.target) break;
  }
  return { rows, trend: tr };
}

/* ====================================================================== pacing ==== */
export interface WaterPace {
  goal: number; drunk: number; expected: number; gap: number; cupsBehind: number;
  status: "done" | "ahead" | "on_track" | "behind" | "early"; text: string;
}
const WATER_START = 8 * 60, WATER_END = 21 * 60; // نفس نافذة التذكيرات الحالية

export function waterPace(db: DB, date: DateStr = todayStr(), nowMin: number = nowMinutes()): WaterPace {
  const goal = db.profile?.goals.water_ml ?? 2000;
  const drunk = waterOn(db, date);
  const frac = date === todayStr() ? clamp((nowMin - WATER_START) / (WATER_END - WATER_START)) : 1;
  const expected = Math.round(goal * frac);
  const gap = expected - drunk;
  const cupsBehind = Math.max(0, Math.ceil(gap / 250));
  let status: WaterPace["status"], text: string;
  if (drunk >= goal) { status = "done"; text = "خلّصت هدف اليوم 💧"; }
  else if (date === todayStr() && nowMin < WATER_START) { status = "early"; text = "ابدأ يومك بكوب ماء قبل أي شيء."; }
  else if (gap > 300) { status = "behind"; text = `متأخر عن الإيقاع بـ ${gap} مل — اشرب ${cupsText(cupsBehind)} (250 مل) على دفعتين.`; }
  else if (gap < -300) { status = "ahead"; text = "قدّام الإيقاع — ممتاز، كمّل بهدوء."; }
  else { status = "on_track"; text = "على الإيقاع المطلوب."; }
  return { goal, drunk, expected, gap, cupsBehind, status, text };
}

export interface MealState { meal: MealKey; label: string; icon: string; time: string; logged: boolean; state: "done" | "overdue" | "soon" | "later"; minutesLate: number }
export function mealStates(db: DB, date: DateStr = todayStr(), nowMin: number = nowMinutes()): MealState[] {
  const g = db.profile?.goals;
  return MEAL_ORDER.map((meal) => {
    const time = g?.meal_times[meal] ?? MEALS[meal].defaultTime;
    const t = timeToMin(time);
    const logged = db.meal_logs.some((l) => l.date === date && l.meal === meal);
    const isToday = date === todayStr();
    const late = nowMin - t;
    const state: MealState["state"] = logged ? "done" : !isToday ? "overdue" : late > 60 ? "overdue" : late >= -30 ? "soon" : "later";
    return { meal, label: MEALS[meal].label, icon: MEALS[meal].icon, time, logged, state, minutesLate: Math.max(0, late) };
  });
}

export function proteinPace(db: DB, date: DateStr = todayStr()) {
  const goal = db.profile?.goals.protein_g ?? 0;
  const n = dayNutrition(db.meal_logs, date);
  return { goal, logged: Math.round(n.protein), left: Math.max(0, Math.round(goal - n.protein)), hasLogs: n.logged };
}

/* ==================================================================== readiness ==== */
export interface ReadinessDriver { key: "sleep" | "energy" | "load" | "fuel"; label: string; value: number; note: string }
export interface Readiness { score: number | null; level: "high" | "medium" | "low" | "unknown"; label: string; advice: string; drivers: ReadinessDriver[] }

export function readiness(db: DB, date: DateStr = todayStr()): Readiness {
  const g = db.profile?.goals;
  const drivers: (ReadinessDriver & { w: number })[] = [];
  if (g) {
    const sl = db.sleep_logs.find((s) => s.date === date) ?? db.sleep_logs.find((s) => s.date === addDays(date, -1));
    if (sl) drivers.push({ key: "sleep", label: "النوم", value: clamp(sleepScore(sl, g) / 100), note: `${sl.duration_h.toFixed(1)} ساعة`, w: 0.4 });

    const en = db.checkins.find((c) => c.date === date)?.energy;
    if (en != null) drivers.push({ key: "energy", label: "الطاقة", value: clamp(en / 5), note: `${en}/5`, w: 0.2 });

    const strength = db.sessions.filter((s) => s.kind !== "cardio" && s.kind !== "custom" && s.date <= date).sort((a, b) => b.date.localeCompare(a.date));
    if (strength.length) {
      const last = strength[0];
      const gap = diffDays(date, last.date);
      const rp = avg(db.sets.filter((x) => x.session_id === last.id && !x.is_warmup && x.rpe != null).map((x) => x.rpe as number));
      const wkCount = strength.filter((s) => diffDays(date, s.date) <= 6).length;
      let v = gap === 0 ? 0.7 : gap === 1 ? 0.82 : gap === 2 ? 0.95 : 1;
      if (rp != null && rp >= 9.2 && gap <= 1) v -= 0.12;
      if (wkCount > g.workouts_per_week) v -= 0.12;
      drivers.push({ key: "load", label: "الاستشفاء", value: clamp(v), note: gap === 0 ? "تدرّبت اليوم" : gap === 1 ? "تدريب أمس" : `آخر جلسة قبل ${gap} أيام`, w: 0.2 });
    }

    const y = addDays(date, -1);
    const fc = foodCompliance(db.meal_logs, y, g);
    const wy = db.water_logs.some((w) => w.date === y) ? clamp(waterOn(db, y) / g.water_ml) : null;
    const fuel = [fc, wy].filter((v): v is number => v != null);
    if (fuel.length) drivers.push({ key: "fuel", label: "التغذية والماء (أمس)", value: avg(fuel)!, note: `${Math.round(avg(fuel)! * 100)}%`, w: 0.2 });
  }
  if (drivers.length < 2) return { score: null, level: "unknown", label: "غير كافٍ", advice: "سجّل نومك وطاقتك لتظهر جاهزيتك للتمرين.", drivers };
  const wsum = sum(drivers.map((d) => d.w));
  const score = Math.round((sum(drivers.map((d) => d.value * d.w)) / wsum) * 100);
  if (score >= 80) return { score, level: "high", label: "جاهز بقوة", advice: "يوم مناسب لتحسين الأحمال: لو وصلت لأعلى المدى بـ RIR ≥ 1 زوّد حسب قاعدة البرنامج.", drivers: strip(drivers) };
  if (score >= 60) return { score, level: "medium", label: "جاهز", advice: "نفّذ الجلسة كما هي في برنامجك بالأوزان المخطّطة.", drivers: strip(drivers) };
  return { score, level: "low", label: "استشفاء منخفض", advice: "نفّذ الجلسة كما هي لكن ثبّت الأوزان اليوم ولا تلاحق الفشل العضلي، وركّز على نوم الليلة.", drivers: strip(drivers) };
}
const strip = (d: (ReadinessDriver & { w: number })[]): ReadinessDriver[] => d.map(({ w: _w, ...r }) => r);

/* ================================================================ energy balance ==== */
export interface EnergyBalance { bmr: number; tdee: number; intake: number; balance: number; weeklyFatKg: number; days: number; factor: number }
/** تقدير فقط: TDEE = BMR (InBody) × معامل نشاط مشتق من جلساتك الفعلية. لا يغيّر هدف السعرات الرسمي. */
export function energyBalance(db: DB, date: DateStr = todayStr(), days = 7): EnergyBalance | null {
  const bmr = latestValue(db, "bmr")?.value;
  if (!bmr) return null;
  const win = daysBetween(addDays(date, -(days - 1)), date);
  const nut = win.map((d) => dayNutrition(db.meal_logs, d)).filter((n) => n.logged);
  if (nut.length < 3) return null;
  const sess = db.sessions.filter((s) => s.date >= win[0] && s.date <= date && s.status === "completed");
  const strengthW = (sess.filter((s) => s.kind !== "cardio").length * 7) / days;
  const cardioW = (sess.filter((s) => s.kind === "cardio").length * 7) / days;
  const factor = clamp(1.2 + 0.035 * strengthW + 0.02 * cardioW, 1.2, 1.6);
  const tdee = Math.round(bmr * factor);
  const intake = Math.round(avg(nut.map((n) => n.kcal))!);
  const balance = intake - tdee;
  return { bmr, tdee, intake, balance, weeklyFatKg: round((balance * 7) / 7700, 2), days: nut.length, factor: round(factor, 2) };
}

/* ==================================================================== medications ==== */
export interface SlotStat { key: string; name: string; label: string; time: string; due: number; taken: number; rate: number }
export interface BucketStat { key: "morning" | "noon" | "evening" | "night"; label: string; due: number; taken: number; rate: number | null }
const bucketOf = (time: string): BucketStat["key"] => { const h = timeToMin(time) / 60; return h < 11 ? "morning" : h < 16 ? "noon" : h < 21 ? "evening" : "night"; };
const BUCKET_LABEL: Record<BucketStat["key"], string> = { morning: "الصباح", noon: "الظهر", evening: "المساء", night: "قبل النوم" };

export function medPatterns(db: DB, date: DateStr = todayStr(), days = 28) {
  const ts = trackingStart(db);
  const empty = { bySlot: [] as SlotStat[], byBucket: [] as BucketStat[], worstBucket: null as BucketStat | null, perfectDays: 0, perfectStreak: 0, daysCounted: 0 };
  if (!ts) return empty;
  const start = addDays(date, -(days - 1));
  const win = daysBetween(start < ts ? ts : start, date);
  const slotMap = new Map<string, SlotStat>();
  const buckets = new Map<BucketStat["key"], { due: number; taken: number }>();
  const perfect: boolean[] = [];
  for (const d of win) {
    const rows = slotsOn(db, d);
    const dueRows = rows.filter((r) => r.state !== "upcoming");
    for (const r of dueRows) {
      const k = `${r.medication_id}:${r.slot_id}`;
      const cur = slotMap.get(k) ?? { key: k, name: r.name, label: r.label, time: r.time, due: 0, taken: 0, rate: 0 };
      cur.due++; if (r.state === "taken") cur.taken++;
      slotMap.set(k, cur);
      const b = buckets.get(bucketOf(r.time)) ?? { due: 0, taken: 0 };
      b.due++; if (r.state === "taken") b.taken++;
      buckets.set(bucketOf(r.time), b);
    }
    perfect.push(rows.length > 0 && dueRows.length === rows.length && dueRows.every((r) => r.state === "taken"));
  }
  const bySlot = [...slotMap.values()].map((s) => ({ ...s, rate: s.due ? s.taken / s.due : 1 })).sort((a, b) => a.rate - b.rate);
  const byBucket: BucketStat[] = (["morning", "noon", "evening", "night"] as const).map((key) => {
    const b = buckets.get(key);
    return { key, label: BUCKET_LABEL[key], due: b?.due ?? 0, taken: b?.taken ?? 0, rate: b && b.due ? b.taken / b.due : null };
  });
  const worstBucket = byBucket.filter((b) => b.rate != null && b.due >= 6).sort((a, b) => (a.rate as number) - (b.rate as number))[0] ?? null;
  let streak = 0;
  for (let i = perfect.length - 1; i >= 0; i--) { if (perfect[i]) streak++; else if (i === perfect.length - 1 && win[i] === date) continue; else break; }
  return { bySlot, byBucket, worstBucket, perfectDays: perfect.filter(Boolean).length, perfectStreak: streak, daysCounted: win.length };
}

/* =================================================================== strength outlook ==== */
export interface LiftTrend { exercise: string; muscle: MuscleGroup; sessions: number; first: number; last: number; changePct: number; status: "rising" | "flat" | "drop" }
export interface StrengthOutlook {
  programWeek: number | null; firstSessionDate: DateStr | null; lifts: LiftTrend[]; stalled: LiftTrend[]; rising: LiftTrend[];
  avgRecentRpe: number | null; deloadSignal: boolean;
}
/** استرشادي فقط: يقيس اتجاه القوة (e1RM) لكل تمرين دون أي تعديل على البرنامج. */
export function strengthOutlook(db: DB, date: DateStr = todayStr()): StrengthOutlook {
  const strength = db.sessions.filter((s) => s.kind !== "cardio" && s.kind !== "custom" && s.date <= date).sort((a, b) => a.date.localeCompare(b.date));
  const firstSessionDate = strength[0]?.date ?? null;
  const programWeek = firstSessionDate ? Math.floor(diffDays(date, firstSessionDate) / 7) + 1 : null;
  const seen = new Set<string>();
  const lifts: LiftTrend[] = [];
  for (const e of db.exercises) {
    if (seen.has(e.name)) continue;
    seen.add(e.name);
    const h = exerciseHistory(db, e.name).filter((x) => x.date <= date).slice(-4);
    if (h.length < 3) continue;
    const first = h[0].e1rm, last = h[h.length - 1].e1rm;
    const changePct = first ? ((last - first) / first) * 100 : 0;
    lifts.push({ exercise: e.name, muscle: e.muscle, sessions: h.length, first: round(first, 1), last: round(last, 1), changePct: round(changePct, 1), status: changePct > 1.5 ? "rising" : changePct < -3 ? "drop" : "flat" });
  }
  const recent = strength.slice(-3);
  const rpes = recent.map((s) => avg(db.sets.filter((x) => x.session_id === s.id && !x.is_warmup && x.rpe != null).map((x) => x.rpe as number))).filter((v): v is number => v != null);
  const avgRecentRpe = rpes.length ? round(avg(rpes)!, 1) : null;
  const flat = lifts.filter((l) => l.status !== "rising");
  const deloadSignal = lifts.length >= 6 && flat.length / lifts.length >= 0.5 && (avgRecentRpe ?? 0) >= 8.8;
  return { programWeek, firstSessionDate, lifts, stalled: flat, rising: lifts.filter((l) => l.status === "rising"), avgRecentRpe, deloadSignal };
}

/* ================================================================ patterns & focus ==== */
export interface EnergyCorrelations { items: Correlation[]; checkins: number }
export function energyCorrelations(db: DB, end: DateStr = todayStr(), days = 60): EnergyCorrelations {
  const g = db.profile?.goals;
  const cs = db.checkins.filter((c) => c.energy != null && c.date <= end && diffDays(end, c.date) < days);
  const pair = (label: string, note: string, f: (c: (typeof cs)[number]) => number | null): Correlation => {
    const xs: number[] = [], ys: number[] = [];
    cs.forEach((c) => { const v = f(c); if (v != null) { xs.push(v); ys.push(c.energy as number); } });
    return { label, r: pearson(xs, ys), n: xs.length, note };
  };
  return {
    checkins: cs.length,
    items: [
      pair("الطاقة ↔ ساعات النوم", "هل تنام أكثر في الأيام اللي طاقتك فيها أعلى؟", (c) => db.sleep_logs.find((s) => s.date === c.date)?.duration_h ?? null),
      pair("الطاقة ↔ شرب الماء", "هل الترطيب بيرفع طاقتك؟", (c) => (db.water_logs.some((w) => w.date === c.date) ? waterOn(db, c.date) : null)),
      pair("الطاقة ↔ الالتزام الغذائي", "هل الالتزام بالحصص بيحسّن طاقتك؟", (c) => (g ? foodCompliance(db.meal_logs, c.date, g) : null)),
      pair("الطاقة ↔ وقت الشاشات", "الارتباط السالب يعني أن الشاشات الكثيرة تقلّل طاقتك", (c) => c.screen_minutes),
    ],
  };
}

export interface WeekdayStat { day: number; label: string; avg: number | null; n: number }
export function weekdayPattern(db: DB, end: DateStr = todayStr(), weeks = 8) {
  const series = scoreSeries(db, end, weeks * 7).filter((s) => s.date !== end || s.overall != null);
  const byDay: WeekdayStat[] = Array.from({ length: 7 }, (_, d) => {
    const v = series.filter((s) => dow(s.date) === d && s.overall != null).map((s) => s.overall as number);
    return { day: d, label: SHORT_DAYS[d], avg: v.length >= 3 ? avg(v)! : null, n: v.length };
  });
  const ok = byDay.filter((b) => b.avg != null);
  const worst = ok.length >= 4 ? [...ok].sort((a, b) => (a.avg as number) - (b.avg as number))[0] : null;
  const best = ok.length >= 4 ? [...ok].sort((a, b) => (b.avg as number) - (a.avg as number))[0] : null;
  return { byDay, worst, best };
}

export type FocusArea = "nutrition" | "water" | "meds" | "workout" | "sleep";
const FOCUS: Record<FocusArea, { label: string; action: string }> = {
  nutrition: { label: "الالتزام الغذائي", action: "سجّل كل وجبة فور الانتهاء منها، وركّز على المجموعة الأقل تحقيقًا في حصصك." },
  water: { label: "الماء", action: "خلّي زجاجة 500 مل جنبك وخلّصها مرتين قبل الظهر ومرتين قبل المغرب." },
  meds: { label: "الأدوية والمكملات", action: "اربط كل جرعة بعادة ثابتة (الفطار، الصلاة، النوم) وخلّي التذكيرات شغّالة." },
  workout: { label: "التمرين", action: "ثبّت ميعاد الجلسة في جدولك وجهّز شنطتك من الليل." },
  sleep: { label: "النوم", action: "ثبّت ميعاد النوم قبل 11، وبعد العشاء بساعتين، وقلّل الشاشات آخر ساعة." },
};
export function focusArea(db: DB, date: DateStr = todayStr(), series?: DayScores[]) {
  const s = (series ?? scoreSeries(db, date, 14)).slice(-14);
  const rows = (Object.keys(FOCUS) as FocusArea[]).map((area) => {
    const v = s.map((x) => x[area]).filter((x): x is number => x != null);
    return { area, avg: v.length >= 4 ? avg(v)! : null, n: v.length };
  }).filter((r) => r.avg != null);
  if (!rows.length) return null;
  const worst = rows.sort((a, b) => (a.avg as number) - (b.avg as number))[0];
  if ((worst.avg as number) >= 0.9) return null;
  return { area: worst.area, avg: worst.avg as number, label: FOCUS[worst.area].label, action: FOCUS[worst.area].action };
}

/* =================================================================== weekly story ==== */
export interface WeeklyStory {
  start: DateStr; end: DateStr; score: number | null; prevScore: number | null;
  bestDay: { date: DateStr; score: number } | null; weakDay: { date: DateStr; score: number } | null;
  wins: string[]; gaps: string[];
}
export function weeklyStory(db: DB, date: DateStr = todayStr()): WeeklyStory | null {
  if (!db.profile) return null;
  const g = db.profile.goals;
  const start = addDays(weekStart(date), -7), end = addDays(start, 6);
  const rep = periodReport(db, start, end);
  const prev = periodReport(db, addDays(start, -7), addDays(start, -1));
  const days = daysBetween(start, end).map((d) => dayScores(db, d)).filter((s) => s.overall != null);
  const wins: string[] = [], gaps: string[] = [];
  if (rep.sessions >= g.workouts_per_week) wins.push(`أنجزت ${rep.sessions}/${g.workouts_per_week} جلسات مقاومة`); else if (rep.sessions > 0 || rep.cardio > 0) gaps.push(`جلسات المقاومة ${rep.sessions}/${g.workouts_per_week}`);
  if (rep.prs > 0) wins.push(`${rep.prs} رقم قياسي جديد`);
  if (rep.cardio >= g.cardio_days_per_week) wins.push(`كارديو ${rep.cardio}/${g.cardio_days_per_week} أيام`); else if (rep.cardio > 0) gaps.push(`الكارديو ${rep.cardio}/${g.cardio_days_per_week} أيام`);
  if (rep.medAdherence != null) { if (rep.medAdherence >= 0.9) wins.push(`التزام دوائي ${Math.round(rep.medAdherence * 100)}%`); else gaps.push(`الالتزام الدوائي ${Math.round(rep.medAdherence * 100)}% (فاتتك ${rep.missed})`); }
  if (rep.foodCompliance != null) { if (rep.foodCompliance >= 0.85) wins.push(`التزام غذائي ${Math.round(rep.foodCompliance * 100)}%`); else gaps.push(`الالتزام الغذائي ${Math.round(rep.foodCompliance * 100)}%`); }
  if (rep.waterGoalDays >= 5) wins.push(`هدف الماء ${rep.waterGoalDays}/7 أيام`); else if (rep.avgWater != null) gaps.push(`هدف الماء تحقق ${rep.waterGoalDays}/7 أيام`);
  if (rep.avgSleep != null) { if (rep.avgSleep >= g.sleep_hours - 0.5) wins.push(`متوسط نوم ${round(rep.avgSleep, 1)} ساعة`); else gaps.push(`متوسط النوم ${round(rep.avgSleep, 1)} ساعة (الهدف ${g.sleep_hours})`); }
  const ranked = [...days].sort((a, b) => (b.overall as number) - (a.overall as number));
  return {
    start, end, score: rep.avgScore, prevScore: prev.avgScore,
    bestDay: ranked.length ? { date: ranked[0].date, score: ranked[0].overall as number } : null,
    weakDay: ranked.length > 1 ? { date: ranked[ranked.length - 1].date, score: ranked[ranked.length - 1].overall as number } : null,
    wins, gaps,
  };
}

/* ====================================================================== coach plan ==== */
export type CoachTone = "urgent" | "now" | "next";
export type CoachIcon = "pill" | "utensils" | "droplets" | "dumbbell" | "moon" | "scale" | "camera" | "footprints";
export interface CoachAction { id: string; tone: CoachTone; icon: CoachIcon; title: string; detail: string; href: string; time?: string }
export interface CoachPlan { actions: CoachAction[]; done: string[] }

const TONE_ORDER: Record<CoachTone, number> = { urgent: 0, now: 1, next: 2 };

/** خطة «ماذا أفعل الآن؟» — مرتّبة حسب الأولوية والوقت، مبنية على ما سجّلته فقط. */
export function coachPlan(db: DB, date: DateStr = todayStr(), nowMin: number = nowMinutes()): CoachPlan {
  const g = db.profile?.goals;
  const actions: CoachAction[] = [];
  const done: string[] = [];
  if (!g) return { actions, done };

  /* الأدوية */
  const rows = slotsOn(db, date, nowMin, date);
  const missed = rows.filter((r) => r.state === "missed");
  const due = rows.filter((r) => r.state === "due");
  if (missed.length) actions.push({ id: "meds-missed", tone: "urgent", icon: "pill", title: `فاتتك ${doses(missed.length)}`, detail: `${missed.slice(0, 3).map((r) => r.name).join("، ")}${missed.length > 3 ? "…" : ""} — سجّلها لو أخدتها فعلًا أو علّمها «متخطّاة». لا تضاعف أي جرعة.`, href: "/medications" });
  if (due.length) actions.push({ id: "meds-due", tone: "now", icon: "pill", title: `مستحق الآن: ${doses(due.length)}`, detail: due.slice(0, 3).map((r) => `${r.name} (${r.label})`).join("، "), href: "/medications", time: due[0].time });
  if (rows.length && rows.every((r) => r.state === "taken" || r.state === "skipped")) done.push("كل جرعات اليوم");

  /* الوجبات */
  const meals = mealStates(db, date, nowMin);
  meals.filter((m) => m.state === "overdue").forEach((m) => actions.push({ id: `meal-late-${m.meal}`, tone: "now", icon: "utensils", title: `${m.label} لم يُسجَّل`, detail: `موعده ${m.time} — سجّل ما أكلته بالحصص ليبقى التحليل دقيقًا.`, href: "/nutrition", time: m.time }));
  meals.filter((m) => m.state === "soon").forEach((m) => actions.push({ id: `meal-soon-${m.meal}`, tone: "next", icon: "utensils", title: `موعد ${m.label}`, detail: "جهّز وجبتك حسب حصص خطتك.", href: "/nutrition", time: m.time }));
  if (meals.every((m) => m.logged)) done.push("كل وجبات اليوم مسجّلة");
  const pp = proteinPace(db, date);
  if (pp.hasLogs && nowMin >= 18 * 60 && pp.left > g.protein_g * 0.3) actions.push({ id: "protein", tone: "now", icon: "utensils", title: `باقي ${pp.left} جم بروتين`, detail: "راجع حصص اللحوم/الألبان المتبقية في خطتك لباقي اليوم.", href: "/nutrition" });

  /* الماء */
  const wp = waterPace(db, date, nowMin);
  if (wp.status === "behind") actions.push({ id: "water", tone: "now", icon: "droplets", title: `اشرب ${cupsText(wp.cupsBehind)} ماء`, detail: wp.text, href: "/water" });
  if (wp.status === "done") done.push("هدف الماء");

  /* التمرين */
  const ns = nextSplit(db, date);
  const todaySess = db.sessions.filter((s) => s.date === date);
  const strengthDone = todaySess.some((s) => s.kind !== "cardio" && s.status === "completed");
  const cardioDone = todaySess.some((s) => s.kind === "cardio");
  if (strengthDone) done.push("جلسة المقاومة");
  else if (ns.split !== "rest") {
    const r = readiness(db, date);
    actions.push({ id: "workout", tone: nowMin >= 15 * 60 && nowMin <= 22 * 60 ? "now" : "next", icon: "dumbbell", title: `جلسة اليوم: ${SPLITS[ns.split].en}`, detail: `${SPLITS[ns.split].focus}${r.score != null ? ` · الجاهزية ${r.score}/100` : ""}`, href: `/workouts?split=${ns.split}`, time: "16:30" });
  } else if (!cardioDone) {
    const wkStart = weekStart(date);
    const cardioWeek = db.sessions.filter((s) => s.kind === "cardio" && s.date >= wkStart && s.date <= date).length;
    if (cardioWeek < g.cardio_days_per_week) actions.push({ id: "cardio", tone: "next", icon: "footprints", title: "يوم راحة — مشي 30 دقيقة", detail: `الكارديو هذا الأسبوع ${cardioWeek}/${g.cardio_days_per_week}.`, href: "/workouts" });
  }
  if (cardioDone) done.push("المشي / الكارديو");

  /* النوم */
  const bed = timeToMin(g.bedtime_before);
  if (nowMin >= bed - 75 && nowMin <= bed + 180) actions.push({ id: "sleep", tone: "now", icon: "moon", title: "ابدأ التهدئة للنوم", detail: `الهدف النوم قبل ${g.bedtime_before} وبعد آخر أكلة بساعتين. قلّل الشاشات الآن.`, href: "/sleep", time: g.bedtime_before });
  if (nowMin >= 6 * 60 && nowMin <= 15 * 60 && !db.sleep_logs.some((s) => s.date === date)) actions.push({ id: "sleep-log", tone: "next", icon: "moon", title: "سجّل نوم الليلة اللي فاتت", detail: "ثواني وبتحسّن دقة الجاهزية والتحليلات.", href: "/sleep" });

  /* القياسات والصور */
  const lastM = sortedMeasurements(db).filter((m) => m.weight_kg != null).pop();
  if (!lastM || diffDays(date, lastM.date) >= 14) actions.push({ id: "measure", tone: "next", icon: "scale", title: "حان وقت قياس جديد", detail: lastM ? `آخر قياس قبل ${diffDays(date, lastM.date)} يومًا — الوزن والخصر بنفس الظروف.` : "ابدأ بتسجيل وزنك.", href: "/measurements" });
  const lastP = [...db.photos].sort((a, b) => b.date.localeCompare(a.date))[0];
  if (lastP && diffDays(date, lastP.date) >= 28) actions.push({ id: "photo", tone: "next", icon: "camera", title: "صورة تقدّم جديدة", detail: `آخر صورة قبل ${diffDays(date, lastP.date)} يومًا.`, href: "/photos" });

  actions.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone] || (a.time ?? "99").localeCompare(b.time ?? "99"));
  return { actions, done };
}

/* ===================================================================== progression ==== */
export interface Badge { id: string; icon: string; title: string; desc: string; progress: number; earned: boolean; detail: string }
export interface Progression {
  xp: number; level: number; levelStart: number; levelEnd: number; pct: number; title: string; streak: number; bestStreak: number; badges: Badge[];
}
const LEVEL_TITLES = ["مبتدئ", "ملتزم", "منضبط", "محترف", "نخبة", "أسطورة"];
const lvlStart = (l: number) => 125 * l * (l - 1);

export function progression(db: DB, date: DateStr = todayStr(), series?: DayScores[]): Progression {
  const g = db.profile?.goals;
  const s = series ?? scoreSeries(db, date, 120);
  let xp = 0;
  s.forEach((d) => { if (d.overall != null) xp += Math.round(d.overall * 100); });
  const prs = prEvents(db);
  xp += prs.length * 50;

  let streak = 0, best = 0, run = 0;
  s.forEach((d) => { if (d.overall != null && d.overall >= 0.7) { run++; best = Math.max(best, run); } else if (d.date === date && d.overall == null) { /* اليوم لم يكتمل بعد */ } else run = 0; });
  for (let i = s.length - 1; i >= 0; i--) { const v = s[i].overall; if (v != null && v >= 0.7) streak++; else if (i === s.length - 1 && v == null) continue; else break; }

  const strengthSessions = db.sessions.filter((x) => x.kind !== "cardio" && x.status === "completed");
  const weekly = Array.from({ length: 12 }, (_, i) => {
    const st = addDays(weekStart(date), -7 * i), en = addDays(st, 6);
    const ss = db.sessions.filter((x) => x.date >= st && x.date <= en && x.status === "completed");
    return { strength: ss.filter((x) => x.kind !== "cardio").length, cardio: ss.filter((x) => x.kind === "cardio").length };
  });
  const fullWeeks = g ? weekly.filter((w) => w.strength >= g.workouts_per_week).length : 0;
  xp += fullWeeks * 100;

  let level = 1;
  while (xp >= lvlStart(level + 1)) level++;
  const levelStart = lvlStart(level), levelEnd = lvlStart(level + 1);

  const mp = medPatterns(db, date, 28);
  const sl7 = db.sleep_logs.filter((x) => x.date > addDays(date, -7) && x.date <= date);
  const goodNights = g ? sl7.filter((x) => x.duration_h >= g.sleep_hours - 0.5).length : 0;
  const preciseDays = g ? s.slice(-14).filter((d) => d.nutrition != null && d.nutrition >= 0.9).length : 0;
  const wStreak = g ? waterStreak(db, g.water_ml, date) : 0;
  const bestCardio = Math.max(0, ...weekly.map((w) => w.cardio));
  const bestStrength = Math.max(0, ...weekly.map((w) => w.strength));
  const withFat = sortedMeasurements(db).filter((m) => m.body_fat_pct != null && m.muscle_mass_kg != null);
  let recomp = 0, recompDetail = "يحتاج قراءتي InBody";
  if (withFat.length >= 2) {
    const a = withFat[0], b = withFat[withFat.length - 1];
    const df = (a.body_fat_pct as number) - (b.body_fat_pct as number), dm = (b.muscle_mass_kg as number) - (a.muscle_mass_kg as number);
    recomp = Math.min(clamp(df / 1), clamp(dm / 0.5));
    recompDetail = `دهون ${df >= 0 ? "−" : "+"}${Math.abs(round(df, 1))}٪ · عضلات ${dm >= 0 ? "+" : "−"}${Math.abs(round(dm, 1))} كجم`;
  }
  const mk = (id: string, icon: string, title: string, desc: string, progress: number, detail: string): Badge => ({ id, icon, title, desc, progress: clamp(progress), earned: progress >= 1, detail });
  const badges: Badge[] = [
    mk("first", "🚀", "البداية", "أنهِ أول جلسة مقاومة", strengthSessions.length / 1, `${Math.min(1, strengthSessions.length)}/1`),
    mk("water7", "💧", "سلسلة الماء", "حقق هدف الماء 7 أيام متتالية", wStreak / 7, `${Math.min(7, wStreak)}/7 أيام`),
    mk("meds7", "🛡️", "درع الالتزام", "كل جرعات اليوم 7 أيام متتالية", mp.perfectStreak / 7, `${Math.min(7, mp.perfectStreak)}/7 أيام`),
    mk("pr5", "🏆", "صائد الأرقام", "سجّل 5 أرقام قياسية", prs.length / 5, `${Math.min(5, prs.length)}/5`),
    mk("week", "📅", "أسبوع مكتمل", `أنهِ ${g?.workouts_per_week ?? 4} جلسات في أسبوع واحد`, g ? bestStrength / g.workouts_per_week : 0, `${bestStrength}/${g?.workouts_per_week ?? 4}`),
    mk("walk", "🚶", "ماشي مثابر", `${g?.cardio_days_per_week ?? 5} أيام كارديو في أسبوع`, g ? bestCardio / g.cardio_days_per_week : 0, `${bestCardio}/${g?.cardio_days_per_week ?? 5}`),
    mk("sleep", "🌙", "نوم ذهبي", "5 ليالٍ بنوم كافٍ خلال أسبوع", goodNights / 5, `${goodNights}/5 ليالٍ`),
    mk("precise", "🎯", "دقة التغذية", "التزام غذائي ≥ 90% في 5 أيام من آخر 14", preciseDays / 5, `${preciseDays}/5 أيام`),
    mk("streak7", "🔥", "7 أيام متواصلة", "درجة يومية ≥ 70% لمدة 7 أيام", best / 7, `أفضل سلسلة ${best}`),
    mk("recomp", "💪", "إعادة تركيب", "دهون أقل −1٪ وعضلات أكثر +0.5 كجم", recomp, recompDetail),
  ];
  return { xp, level, levelStart, levelEnd, pct: clamp((xp - levelStart) / (levelEnd - levelStart)), title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)], streak, bestStreak: best, badges };
}

/* ================================================================ extra insights ==== */
const ins = (id: string, kind: Insight["kind"], area: Insight["area"], title: string, body: string, severity: number, date: DateStr): Insight => ({ id, kind, area, title, body, severity, date });

/** تحليلات إضافية تُضاف فوق generateInsights (لا تستبدلها). */
export function extraInsights(db: DB, date: DateStr = todayStr(), nowMin: number = nowMinutes()): Insight[] {
  const out: Insight[] = [];
  const g = db.profile?.goals;
  if (!g) return out;

  const tr = weightTrend(db, date);
  if (tr.status === "on_track" || tr.status === "slow") out.push(ins("x-forecast", "insight", "body", tr.headline, tr.detail, 1, date));
  else if (tr.status === "stalled" && tr.plateau) out.push(ins("x-plateau", "recommendation", "body", tr.headline, tr.detail, 2, date));
  else if (tr.status === "wrong_way") out.push(ins("x-wrongway", "recommendation", "body", tr.headline, tr.detail, 2, date));

  const eb = energyBalance(db, date);
  if (eb) out.push(ins("x-energy", "insight", "nutrition", `ميزان الطاقة التقديري: ${eb.balance > 0 ? "+" : ""}${eb.balance} kcal/يوم`, `متوسط ما سجّلته ${eb.intake} kcal مقابل صرف تقديري ${eb.tdee} (BMR ${eb.bmr} × ${eb.factor}). يعادل نحو ${eb.weeklyFatKg > 0 ? "+" : ""}${eb.weeklyFatKg} كجم دهون/أسبوع. تقدير فقط — خطتك الرسمية ${g.calories} kcal.`, 1, date));

  if (date === todayStr()) {
    const r = readiness(db, date);
    if (r.level === "low") out.push(ins("x-ready-low", "recommendation", "workout", `الجاهزية منخفضة اليوم (${r.score}/100)`, r.advice, 2, date));
    else if (r.level === "high") out.push(ins("x-ready-high", "achievement", "workout", `جاهزية ممتازة اليوم (${r.score}/100)`, r.advice, 1, date));
    const wp = waterPace(db, date, nowMin);
    if (wp.status === "behind" && nowMin >= 12 * 60) out.push(ins("x-water-pace", "recommendation", "water", "متأخر عن إيقاع الماء اليوم", wp.text, 2, date));
  }

  const mp = medPatterns(db, date, 28);
  if (mp.worstBucket && (mp.worstBucket.rate as number) < 0.8) out.push(ins("x-med-bucket", "recommendation", "meds", `أكثر وقت بتفوّت فيه الجرعات: ${mp.worstBucket.label}`, `الالتزام في هذا الوقت ${Math.round((mp.worstBucket.rate as number) * 100)}% (${mp.worstBucket.taken}/${mp.worstBucket.due}). اربط الجرعة بعادة ثابتة أو ضبط تذكير إضافي.`, 2, date));
  if (mp.perfectStreak >= 3) out.push(ins("x-med-streak", "achievement", "meds", `${mp.perfectStreak} أيام متتالية بكل الجرعات`, "التزام دوائي كامل — كمّل.", 1, date));

  const ec = energyCorrelations(db, date).items.find((c) => c.r != null && c.n >= 6 && Math.abs(c.r) >= 0.4);
  if (ec) out.push(ins("x-energy-corr", "insight", "general", ec.label, `r = ${round(ec.r!, 2)} (n=${ec.n} يومًا) — ${ec.note}`, 1, date));

  const wd = weekdayPattern(db, date);
  if (wd.worst && wd.best && (wd.best.avg as number) - (wd.worst.avg as number) >= 0.15) out.push(ins("x-weekday", "insight", "general", `أضعف أيامك التزامًا: ${wd.worst.label}`, `متوسط درجتك فيه ${Math.round((wd.worst.avg as number) * 100)}% مقابل ${Math.round((wd.best.avg as number) * 100)}% يوم ${wd.best.label}. خطّط لهذا اليوم مسبقًا.`, 1, date));

  const so = strengthOutlook(db, date);
  if (so.deloadSignal) out.push(ins("x-deload", "recommendation", "workout", "إشارات إجهاد وثبات في القوة", `نصف تمارينك تقريبًا ثابتة مع RPE ≈ ${so.avgRecentRpe}. راجع النوم والبروتين أولًا، وناقش أسبوع تخفيف مع مختصّك — التطبيق لا يغيّر برنامجك.`, 2, date));
  else if (so.rising.length >= 3) out.push(ins("x-strength-up", "achievement", "workout", `القوة في صعود في ${so.rising.length} تمارين`, `${so.rising.slice(0, 3).map((l) => `${l.exercise} (+${l.changePct}%)`).join("، ")}.`, 1, date));
  if (so.programWeek != null && [4, 8, 12].includes(so.programWeek)) out.push(ins(`x-week-${so.programWeek}`, "insight", "workout", `الأسبوع ${so.programWeek} من 12 في البرنامج`, so.programWeek === 12 ? "أكملت 12 أسبوعًا — وقت مناسب لمراجعة تقدّمك مع الدكتور." : "كمّل بنفس البرنامج كما هو — القواعد تمنع التعديل قبل 12 أسبوعًا.", 1, date));

  const fa = focusArea(db, date);
  if (fa) out.push(ins("x-focus", "recommendation", "general", `تركيز الأسبوع: ${fa.label}`, `أضعف مجال لديك آخر أسبوعين (${Math.round(fa.avg * 100)}%). ${fa.action}`, 2, date));
  return out;
}

/* ================================================================ weekly challenge ==== */
export interface Challenge {
  id: string; area: FocusArea | "streak"; icon: string; title: string; desc: string;
  target: number; progress: number; unit: string; done: boolean; daysLeft: number;
}
/** تحدّي أسبوعي يُولَّد تلقائيًا من أضعف مجال عندك — يُحسب من سجلّاتك فقط (الأسبوع يبدأ السبت). */
export function weeklyChallenge(db: DB, date: DateStr = todayStr(), series?: DayScores[]): Challenge | null {
  const g = db.profile?.goals;
  if (!g) return null;
  const ws = weekStart(date);
  const days = daysBetween(ws, date).map((d) => dayScores(db, d));
  const daysLeft = Math.max(0, 6 - diffDays(date, ws));
  const fa = focusArea(db, date, series);
  const area: Challenge["area"] = fa?.area ?? "streak";
  const count = (f: (d: DayScores) => boolean) => days.filter(f).length;
  const mk = (icon: string, title: string, desc: string, target: number, progress: number, unit: string): Challenge =>
    ({ id: `${area}-${ws}`, area, icon, title, desc, target, progress, unit, done: progress >= target, daysLeft });
  switch (area) {
    case "water": return mk("💧", "أسبوع الترطيب", `حقق هدف الماء (${g.water_ml / 1000} لتر) في 5 أيام`, 5, count((d) => (d.water ?? 0) >= 0.999), "أيام");
    case "meds": return mk("🛡️", "أسبوع بلا نسيان", "كل جرعات اليوم في 6 أيام", 6, count((d) => (d.meds ?? 0) >= 0.999), "أيام");
    case "nutrition": return mk("🎯", "أسبوع الدقة", "التزام غذائي ≥ 85% في 5 أيام", 5, count((d) => (d.nutrition ?? 0) >= 0.85), "أيام");
    case "sleep": return mk("🌙", "أسبوع النوم", "نوم كافٍ (درجة ≥ 85%) في 5 ليالٍ", 5, count((d) => (d.sleep ?? 0) >= 0.85), "ليالٍ");
    case "workout": {
      const n = db.sessions.filter((x) => x.date >= ws && x.date <= date && x.status === "completed" && x.kind !== "cardio").length;
      return mk("🏋️", "أسبوع كامل", `أنهِ ${g.workouts_per_week} جلسات مقاومة هذا الأسبوع`, g.workouts_per_week, n, "جلسات");
    }
    default: return mk("🔥", "أسبوع ثابت", "درجة يومية ≥ 80% في 5 أيام", 5, count((d) => (d.overall ?? 0) >= 0.8), "أيام");
  }
}

/* ===================================================================== day review ==== */
export interface DayReview {
  score: number | null; wins: string[]; misses: string[];
  tomorrow: { workout: string; firstDose: string | null; tip: string };
}
/** مراجعة نهاية اليوم + معاينة الغد. معاينة التمرين تقرأ دورتك الحالية ولا تغيّرها. */
export function dayReview(db: DB, date: DateStr = todayStr()): DayReview | null {
  const g = db.profile?.goals;
  if (!g) return null;
  const sc = dayScores(db, date);
  const wins: string[] = [], misses: string[] = [];
  const add = (v: number | null, okTxt: string, badTxt: string, hi = 0.85, lo = 0.6) => { if (v == null) return; if (v >= hi) wins.push(okTxt); else if (v < lo) misses.push(badTxt); };
  add(sc.water, "هدف الماء تحقق", `الماء ${Math.round((sc.water ?? 0) * 100)}% فقط`, 0.999);
  add(sc.meds, "كل الجرعات في وقتها", `الجرعات ${Math.round((sc.meds ?? 0) * 100)}%`, 0.999, 0.8);
  add(sc.nutrition, "التزام غذائي ممتاز", `الالتزام الغذائي ${Math.round((sc.nutrition ?? 0) * 100)}%`);
  add(sc.sleep, "نوم كافٍ", "النوم أقل من المطلوب");
  if (sc.workout != null && sc.workout >= 0.99) wins.push("أنجزت تمرين اليوم");
  const tomorrow = addDays(date, 1);
  const strengthDone = db.sessions.some((x) => x.date === date && x.kind !== "cardio" && x.status === "completed");
  const ns = nextSplit(db, date);
  const workout = strengthDone
    ? (ns.split === "rest" ? "غدًا يوم راحة (مشي خفيف اختياري)" : `غدًا: ${SPLITS[ns.split].en}`)
    : (ns.split === "rest" ? "يوم راحة" : `لسه عليك جلسة ${SPLITS[ns.split].en} — يمكن تأجيلها لغد حسب دورتك`);
  const first = slotsOn(db, tomorrow, 0, date)[0];
  const fa = focusArea(db, date);
  return { score: sc.overall, wins, misses, tomorrow: { workout, firstDose: first ? `${first.name} الساعة ${first.time}` : null, tip: fa ? fa.action : "كمّل على نفس النسق 👌" } };
}

/* ================================================================== what-if scenario ==== */
export interface Scenario { baseAdherence: number; scenarioRate: number | null; etaDate: DateStr | null; etaWeeks: number | null }
/** تقدير تقريبي: افترض أن معدل النزول يتناسب طرديًا مع التزامك العام. للتحفيز والتخطيط فقط. */
export function scenarioEta(db: DB, date: DateStr, adherence: number, series?: DayScores[]): Scenario {
  const s = (series ?? scoreSeries(db, date, 28)).slice(-28).map((x) => x.overall).filter((v): v is number => v != null);
  const base = clamp(avg(s) ?? 0.75, 0.3, 1);
  const tr = weightTrend(db, date);
  if (tr.ratePerWeek == null || tr.remaining == null || tr.remaining <= 0.2) return { baseAdherence: base, scenarioRate: null, etaDate: null, etaWeeks: null };
  const base0 = tr.ratePerWeek < 0 ? tr.ratePerWeek : -0.2; // لو الوزن ثابت نفترض معدلًا أساسيًا صغيرًا للمحاكاة
  const rate = round(base0 * (adherence / base), 2);
  if (rate > -0.05) return { baseAdherence: base, scenarioRate: rate, etaDate: null, etaWeeks: null };
  const weeks = tr.remaining / -rate;
  return { baseAdherence: base, scenarioRate: rate, etaWeeks: round(weeks, 1), etaDate: weeks <= 104 ? addDays(date, Math.round(weeks * 7)) : null };
}

export { SHORT_DAYS, medAdherence };
