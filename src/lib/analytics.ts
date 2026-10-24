import { EXCHANGE, FOOD_GROUPS, MUSCLES, CYCLE, SPLIT_ORDER, GROUP_ORDER, exchangeFor, SPLITS } from "./constants";
import { addDays, daysBetween, diffDays, fmt, nowMinutes, rangeDays, timeToMin, today as todayStr, weekStart } from "./dates";
import type {
  DB, DateStr, FoodGroup, Goals, Insight, MealKey, MealLog, MuscleGroup, SleepLog, SplitKey, WorkoutSet,
} from "./types";

/* ---------------------------------------------------------------- generic math ---- */
export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
export const avg = (a: number[]): number | null => (a.length ? sum(a) / a.length : null);
export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
export const pct = (v: number) => Math.round(v * 100);

export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 4) return null;
  const mx = sum(xs) / n, my = sum(ys) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return dx === 0 || dy === 0 ? null : num / Math.sqrt(dx * dy);
}

/** least-squares slope of y over index (per step) */
export function slope(ys: number[]): number | null {
  const n = ys.length;
  if (n < 2) return null;
  const mx = (n - 1) / 2, my = sum(ys) / n;
  let num = 0, den = 0;
  ys.forEach((y, i) => { num += (i - mx) * (y - my); den += (i - mx) ** 2; });
  return den === 0 ? null : num / den;
}

export function movingAvg(vals: (number | null)[], w = 7): (number | null)[] {
  return vals.map((_, i) => {
    const win = vals.slice(Math.max(0, i - w + 1), i + 1).filter((v): v is number => v != null);
    return win.length ? sum(win) / win.length : null;
  });
}

export function deltaPct(cur: number | null, prev: number | null): number | null {
  if (cur == null || prev == null || prev === 0) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

/* -------------------------------------------------------------------- nutrition ---- */
export interface DayNutrition {
  logged: boolean;
  kcal: number; protein: number; carbs: number; fat: number;
  servings: Record<FoodGroup, number>;
  extraKcal: number;
}
const zeroServings = (): Record<FoodGroup, number> => ({ starch: 0, meat: 0, veg: 0, fruit: 0, dairy: 0, fat: 0, legumes: 0 });

export function calcMacros(group: FoodGroup, meal: MealKey, servings: number) {
  const x = exchangeFor(group, meal);
  return { kcal: x.kcal * servings, protein_g: x.p * servings, carbs_g: x.c * servings, fat_g: x.f * servings };
}

export function dayNutrition(logs: MealLog[], date: DateStr): DayNutrition {
  const rows = logs.filter((l) => l.date === date);
  const servings = zeroServings();
  let kcal = 0, protein = 0, carbs = 0, fat = 0, extraKcal = 0;
  for (const r of rows) {
    kcal += r.kcal; protein += r.protein_g; carbs += r.carbs_g; fat += r.fat_g;
    if (r.group === "extra") extraKcal += r.kcal; else servings[r.group] += r.servings;
  }
  return { logged: rows.length > 0, kcal, protein, carbs, fat, servings, extraKcal };
}

/** Food-plan compliance 0..1 — 1 minus normalized deviation from the prescribed servings. null if nothing logged. */
export function foodCompliance(logs: MealLog[], date: DateStr, goals: Goals): number | null {
  const d = dayNutrition(logs, date);
  if (!d.logged) return null;
  let dev = 0, total = 0;
  for (const g of GROUP_ORDER) {
    const t = goals.servings[g] ?? 0;
    total += t;
    dev += Math.abs(d.servings[g] - t);
  }
  dev += d.extraKcal / 80; // off-plan food counts as ~1 serving per 80 kcal of deviation
  return total === 0 ? null : clamp(1 - dev / total);
}

export function mealCompliance(logs: MealLog[], date: DateStr, meal: MealKey, targets: Partial<Record<FoodGroup, number>>): number | null {
  const rows = logs.filter((l) => l.date === date && l.meal === meal);
  if (!rows.length) return null;
  let dev = 0, total = 0;
  for (const g of GROUP_ORDER) {
    const t = targets[g] ?? 0;
    const c = rows.filter((r) => r.group === g).reduce((s, r) => s + r.servings, 0);
    total += t; dev += Math.abs(c - t);
  }
  dev += rows.filter((r) => r.group === "extra").reduce((s, r) => s + r.kcal, 0) / 80;
  return total === 0 ? null : clamp(1 - dev / total);
}

/* ------------------------------------------------------------------------ water ---- */
export const waterOn = (db: DB, date: DateStr) => sum(db.water_logs.filter((w) => w.date === date).map((w) => w.amount_ml));

export function waterStreak(db: DB, goal: number, end: DateStr): number {
  let s = 0;
  let d = waterOn(db, end) >= goal ? end : addDays(end, -1); // today in progress doesn't break the streak
  while (waterOn(db, d) >= goal) { s++; d = addDays(d, -1); }
  return s;
}

/* ------------------------------------------------------------------- medications ---- */
export type SlotState = "taken" | "missed" | "skipped" | "due" | "upcoming";
export interface SlotRow {
  medication_id: string; name: string; color: string; kind: "medication" | "supplement"; dose: string;
  slot_id: string; label: string; time: string; state: SlotState; taken_at: string | null; logId: string | null;
}
const MISSED_AFTER_MIN = 180; // a dose not logged 3h after its time counts as missed
const DUE_BEFORE_MIN = 30;

export function slotsOn(db: DB, date: DateStr, nowMin = nowMinutes(), todayDate = todayStr()): SlotRow[] {
  const rows: SlotRow[] = [];
  for (const m of db.medications) {
    if (!m.active) continue;
    for (const s of m.slots) {
      const log = db.med_logs.find((l) => l.date === date && l.medication_id === m.id && l.slot_id === s.id);
      let state: SlotState;
      if (log) state = log.status;
      else if (date < todayDate) state = "missed";
      else if (date > todayDate) state = "upcoming";
      else {
        const t = timeToMin(s.time);
        state = nowMin - t > MISSED_AFTER_MIN ? "missed" : nowMin >= t - DUE_BEFORE_MIN ? "due" : "upcoming";
      }
      rows.push({
        medication_id: m.id, name: m.name, color: m.color, kind: m.kind, dose: m.dose, slot_id: s.id, label: s.label,
        time: s.time, state, taken_at: log?.taken_at ?? null, logId: log?.id ?? null,
      });
    }
  }
  return rows.sort((a, b) => a.time.localeCompare(b.time) || a.name.localeCompare(b.name));
}

export function trackingStart(db: DB): DateStr | null {
  const ds = db.med_logs.map((l) => l.date).sort();
  return ds[0] ?? null;
}

export interface MedDay { expected: number; taken: number; missed: number; pct: number | null; dueSoFar: number }
export function medDay(db: DB, date: DateStr, nowMin = nowMinutes(), todayDate = todayStr()): MedDay {
  const rows = slotsOn(db, date, nowMin, todayDate);
  const taken = rows.filter((r) => r.state === "taken").length;
  const missed = rows.filter((r) => r.state === "missed" || r.state === "skipped").length;
  const dueSoFar = rows.filter((r) => r.state !== "upcoming").length;
  return { expected: rows.length, taken, missed, dueSoFar, pct: rows.length ? taken / rows.length : null };
}

/** Adherence over [start,end]: taken / (slots already due). Days before the first log are ignored. */
export function medAdherence(db: DB, start: DateStr, end: DateStr): { pct: number | null; taken: number; due: number; missed: number } {
  const ts = trackingStart(db);
  if (!ts) return { pct: null, taken: 0, due: 0, missed: 0 };
  let taken = 0, due = 0, missed = 0;
  for (const d of daysBetween(start < ts ? ts : start, end)) {
    const r = medDay(db, d);
    taken += r.taken; due += r.dueSoFar; missed += r.missed;
  }
  return { pct: due ? taken / due : null, taken, due, missed };
}

export function missedDoses(db: DB, start: DateStr, end: DateStr) {
  const ts = trackingStart(db);
  const out: { date: DateStr; name: string; label: string; time: string; explicit: boolean }[] = [];
  if (!ts) return out;
  for (const d of daysBetween(start < ts ? ts : start, end)) {
    for (const r of slotsOn(db, d)) {
      if (r.state === "missed" || r.state === "skipped") out.push({ date: d, name: r.name, label: r.label, time: r.time, explicit: r.logId != null });
    }
  }
  return out.sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : b.date.localeCompare(a.date)));
}

/* ---------------------------------------------------------------------- workouts ---- */
export const workingSets = (sets: WorkoutSet[]) => sets.filter((s) => !s.is_warmup && s.reps > 0);

/** Epley, using reps-in-reserve to estimate the true max reps. Capped for accuracy. */
export function e1RM(weight: number, reps: number, rir?: number | null): number {
  if (weight <= 0 || reps <= 0) return 0;
  const eff = Math.min(reps + Math.max(0, rir ?? 0), 15);
  return eff <= 1 ? weight : weight * (1 + eff / 30);
}
export const volumeLoad = (sets: WorkoutSet[]) => sum(workingSets(sets).map((s) => s.weight_kg * s.reps));

export interface ExerciseSession {
  date: DateStr; session_id: string; sets: WorkoutSet[]; topSet: WorkoutSet; e1rm: number; volume: number; bestWeight: number; avgRpe: number | null;
}
export function exerciseHistory(db: DB, name: string): ExerciseSession[] {
  const done = new Set(db.sessions.filter((s) => s.status === "completed" || true).map((s) => s.id));
  const by = new Map<string, WorkoutSet[]>();
  for (const s of workingSets(db.sets)) {
    if (s.exercise_name !== name || !done.has(s.session_id)) continue;
    by.set(s.session_id, [...(by.get(s.session_id) ?? []), s]);
  }
  const out: ExerciseSession[] = [];
  for (const [sid, sets] of by) {
    let top = sets[0], topE = 0;
    for (const s of sets) { const e = e1RM(s.weight_kg, s.reps, s.rir); if (e > topE) { topE = e; top = s; } }
    const rpes = sets.map((s) => s.rpe).filter((v): v is number => v != null);
    out.push({
      date: sets[0].date, session_id: sid, sets: sets.sort((a, b) => a.set_no - b.set_no), topSet: top, e1rm: topE,
      volume: volumeLoad(sets), bestWeight: Math.max(...sets.map((s) => s.weight_kg)), avgRpe: avg(rpes),
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export interface PREvent { date: DateStr; exercise: string; muscle: MuscleGroup; weight: number; reps: number; e1rm: number; previous: number }
/** Chronological list of every set that beat the previous best estimated 1RM for that exercise. */
export function prEvents(db: DB): PREvent[] {
  const sets = workingSets(db.sets).slice().sort((a, b) => a.date.localeCompare(b.date) || a.set_no - b.set_no);
  const best = new Map<string, number>();
  const out: PREvent[] = [];
  const dayBest = new Map<string, PREvent>();
  for (const s of sets) {
    const e = e1RM(s.weight_kg, s.reps, s.rir);
    const prev = best.get(s.exercise_name) ?? 0;
    if (e > prev + 0.01) {
      if (prev > 0) {
        const key = s.exercise_name + s.date;
        dayBest.set(key, { date: s.date, exercise: s.exercise_name, muscle: s.muscle, weight: s.weight_kg, reps: s.reps, e1rm: e, previous: prev });
      }
      best.set(s.exercise_name, e);
    }
  }
  for (const v of dayBest.values()) out.push(v);
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export function currentBests(db: DB) {
  const map = new Map<string, { exercise: string; muscle: MuscleGroup; e1rm: number; weight: number; reps: number; date: DateStr; maxWeight: number }>();
  for (const s of workingSets(db.sets)) {
    const e = e1RM(s.weight_kg, s.reps, s.rir);
    const cur = map.get(s.exercise_name);
    if (!cur) map.set(s.exercise_name, { exercise: s.exercise_name, muscle: s.muscle, e1rm: e, weight: s.weight_kg, reps: s.reps, date: s.date, maxWeight: s.weight_kg });
    else {
      if (e > cur.e1rm) Object.assign(cur, { e1rm: e, weight: s.weight_kg, reps: s.reps, date: s.date });
      cur.maxWeight = Math.max(cur.maxWeight, s.weight_kg);
    }
  }
  return [...map.values()].sort((a, b) => b.e1rm - a.e1rm);
}

export interface OverloadAdvice { status: "increase" | "reps" | "hold" | "new"; text: string; targetWeight: number | null; targetReps: number | null }
/** Double progression: reach top of the rep range on all work sets at RIR ≤ 2 → add load; otherwise add reps. */
export function overloadAdvice(db: DB, name: string, repMin: number, repMax: number, plannedSets: number, lowerBody: boolean): OverloadAdvice {
  const hist = exerciseHistory(db, name);
  if (!hist.length) return { status: "new", text: "أول مرة — ابدأ بوزن تنفّذ به أقل عدات المدى مع RIR 2–3.", targetWeight: null, targetReps: repMin };
  const last = hist[hist.length - 1];
  const w = last.topSet.weight_kg;
  const atWeight = last.sets.filter((s) => s.weight_kg >= w - 0.01);
  const allTop = atWeight.length >= Math.min(plannedSets, last.sets.length) && atWeight.every((s) => s.reps >= repMax);
  const easy = atWeight.every((s) => (s.rir ?? 2) >= 1);
  const step = lowerBody ? 5 : 2.5;
  if (allTop && easy) return { status: "increase", text: `وصلت لأعلى المدى (${repMax}) — ارفع الوزن إلى ${w + step} كجم وابدأ من ${repMin} عدات.`, targetWeight: w + step, targetReps: repMin };
  const minReps = Math.min(...atWeight.map((s) => s.reps));
  if (minReps < repMin) return { status: "hold", text: `العدات أقل من المدى (${repMin}–${repMax}) — ثبّت ${w} كجم وركّز على الأداء الكامل.`, targetWeight: w, targetReps: repMin };
  return { status: "reps", text: `ثبّت ${w} كجم وحاول +1 عدة في كل مجموعة (الهدف ${Math.min(repMax, minReps + 1)}).`, targetWeight: w, targetReps: Math.min(repMax, minReps + 1) };
}

export function weeklyMuscleSets(db: DB, weekStartDate: DateStr): Record<MuscleGroup, { sets: number; volume: number }> {
  const end = addDays(weekStartDate, 6);
  const out = {} as Record<MuscleGroup, { sets: number; volume: number }>;
  (Object.keys(MUSCLES) as MuscleGroup[]).forEach((m) => (out[m] = { sets: 0, volume: 0 }));
  for (const s of workingSets(db.sets)) {
    if (s.date < weekStartDate || s.date > end) continue;
    out[s.muscle].sets += 1;
    out[s.muscle].volume += s.weight_kg * s.reps;
  }
  return out;
}

export function weeklyWorkoutSeries(db: DB, weeks: number, end: DateStr = todayStr()) {
  const ws = weekStart(end);
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(ws, -7 * (weeks - 1 - i));
    const stop = addDays(start, 6);
    const sets = workingSets(db.sets).filter((s) => s.date >= start && s.date <= stop);
    const sessions = db.sessions.filter((s) => s.date >= start && s.date <= stop && s.kind !== "cardio");
    const cardio = db.sessions.filter((s) => s.date >= start && s.date <= stop && s.kind === "cardio");
    const rpes = sets.map((s) => s.rpe).filter((v): v is number => v != null);
    return { start, label: fmt(start, "d/M"), volume: Math.round(volumeLoad(sets)), sets: sets.length, sessions: sessions.length, cardio: cardio.length, avgRpe: avg(rpes) };
  });
}

/** Which split is next in the Anterior/Posterior cycle based on the most recent strength session. */
export function nextSplit(db: DB, date: DateStr = todayStr()): { split: SplitKey | "rest"; reason: string } {
  const strength = db.sessions.filter((s) => SPLIT_ORDER.includes(s.kind as SplitKey)).sort((a, b) => a.date.localeCompare(b.date));
  if (!strength.length) return { split: "anterior_a", reason: "ابدأ الدورة من Anterior A" };
  const last = strength[strength.length - 1];
  const gap = diffDays(date, last.date);
  const idx = CYCLE.indexOf(last.kind as SplitKey);
  const nextIdx = (idx + 1) % CYCLE.length;
  const next = CYCLE[nextIdx];
  if (next === "rest") {
    if (gap >= 1) {
      const after = CYCLE[(nextIdx + 1) % CYCLE.length];
      if (after !== "rest") return { split: after, reason: "انتهى يوم الراحة — حان موعد الجلسة التالية" };
      return { split: CYCLE[(nextIdx + 2) % CYCLE.length] as SplitKey, reason: "انتهت أيام الراحة — ابدأ دورة جديدة" };
    }
    return { split: "rest", reason: "يوم راحة بعد آخر جلسة" };
  }
  return { split: next, reason: gap === 0 ? "الجلسة التالية في الدورة (يمكنك إكمالها اليوم)" : "الجلسة التالية في الدورة" };
}

/* -------------------------------------------------------------------------- sleep ---- */
export function sleepMinutes(bed: string, wake: string): number {
  const b = timeToMin(bed), w = timeToMin(wake);
  return w >= b ? w - b : w + 1440 - b;
}
export function sleepScore(l: Pick<SleepLog, "bedtime" | "duration_h" | "quality">, goals: Goals): number {
  const h = l.duration_h;
  const lo = Math.max(6.5, goals.sleep_hours - 1), hi = goals.sleep_hours + 1;
  let dur = 60;
  if (h < lo) dur = 60 * clamp((h - 4) / (lo - 4));
  else if (h > hi) dur = 60 * clamp(1 - (h - hi) / 3);
  let b = timeToMin(l.bedtime);
  if (b < 12 * 60) b += 1440; // after-midnight bedtimes
  const late = Math.max(0, b - timeToMin(goals.bedtime_before));
  const bed = 25 - Math.min(25, (late / 60) * 12.5);
  const q = l.quality ? ((l.quality - 1) / 4) * 15 : 10;
  return Math.round(dur + bed + q);
}

/* --------------------------------------------------------------------- body ---- */
export function sortedMeasurements(db: DB) {
  return db.measurements.slice().sort((a, b) => a.date.localeCompare(b.date));
}
export function latestOf(db: DB, key: keyof DB["measurements"][number]) {
  const ms = sortedMeasurements(db).filter((m) => m[key] != null);
  return ms.length ? ms[ms.length - 1] : null;
}
export function weightSeries(db: DB) {
  return sortedMeasurements(db).filter((m) => m.weight_kg != null).map((m) => ({ date: m.date, weight: m.weight_kg as number }));
}
export function latestValue(db: DB, key: "weight_kg" | "body_fat_pct" | "muscle_mass_kg" | "fat_mass_kg" | "waist_cm" | "chest_cm" | "arm_cm" | "thigh_cm" | "visceral_fat" | "bmi" | "bmr"): { value: number; prev: number | null; date: DateStr } | null {
  const ms = sortedMeasurements(db).filter((m) => m[key] != null);
  if (!ms.length) return null;
  const last = ms[ms.length - 1];
  return { value: last[key] as number, prev: ms.length > 1 ? (ms[ms.length - 2][key] as number) : null, date: last.date };
}

/* ----------------------------------------------------------- daily composite score ---- */
export type ScoreKey = "overall" | "nutrition" | "water" | "meds" | "workout" | "sleep";
export interface DayScores { date: DateStr; overall: number | null; nutrition: number | null; water: number | null; meds: number | null; workout: number | null; sleep: number | null }

export function dayScores(db: DB, date: DateStr): DayScores {
  const g = db.profile?.goals;
  if (!g) return { date, overall: null, nutrition: null, water: null, meds: null, workout: null, sleep: null };
  const fc = foodCompliance(db.meal_logs, date, g);
  const wl = db.water_logs.some((w) => w.date === date) ? clamp(waterOn(db, date) / g.water_ml) : (date < todayStr() && trackedWater(db, date) ? 0 : null);
  const md = medDay(db, date);
  const ts = trackingStart(db);
  const meds = ts && date >= ts && md.expected ? (date === todayStr() ? (md.dueSoFar ? md.taken / md.dueSoFar : null) : md.taken / md.expected) : null;
  const sess = db.sessions.filter((s) => s.date === date && s.status === "completed");
  const workout = sess.length ? 1 : null;
  const sl = db.sleep_logs.find((s) => s.date === date);
  const sleep = sl ? sleepScore(sl, g) / 100 : null;
  const parts = [fc, wl, meds, workout, sleep].filter((v): v is number => v != null);
  return {
    date,
    overall: parts.length ? avg(parts)! : null,
    nutrition: fc, water: wl, meds, workout, sleep,
  };
}
const trackedWater = (db: DB, date: DateStr) => db.water_logs.some((w) => w.date < date);

export function scoreSeries(db: DB, end: DateStr, count: number): DayScores[] {
  return rangeDays(end, count).map((d) => dayScores(db, d));
}

/* ---------------------------------------------------------------------- reports ---- */
export interface PeriodReport {
  start: DateStr; end: DateStr; days: number;
  avgKcal: number | null; avgProtein: number | null; foodCompliance: number | null; loggedDays: number;
  avgWater: number | null; waterGoalDays: number;
  medAdherence: number | null; missed: number;
  sessions: number; cardio: number; volume: number; sets: number; prs: number;
  avgSleep: number | null; avgSleepScore: number | null;
  weightChange: number | null; fatChange: number | null; muscleChange: number | null;
  avgScore: number | null;
}
export function periodReport(db: DB, start: DateStr, end: DateStr): PeriodReport {
  const g = db.profile!.goals;
  const days = daysBetween(start, end);
  const nut = days.map((d) => dayNutrition(db.meal_logs, d)).filter((n) => n.logged);
  const comp = days.map((d) => foodCompliance(db.meal_logs, d, g)).filter((v): v is number => v != null);
  const waterDays = days.filter((d) => db.water_logs.some((w) => w.date === d));
  const wvals = waterDays.map((d) => waterOn(db, d));
  const med = medAdherence(db, start, end);
  const sess = db.sessions.filter((s) => s.date >= start && s.date <= end);
  const sets = workingSets(db.sets).filter((s) => s.date >= start && s.date <= end);
  const sl = db.sleep_logs.filter((s) => s.date >= start && s.date <= end);
  const prs = prEvents(db).filter((p) => p.date >= start && p.date <= end).length;
  const ms = sortedMeasurements(db);
  const before = (k: "weight_kg" | "body_fat_pct" | "muscle_mass_kg") => ms.filter((m) => m.date < start && m[k] != null).pop()?.[k] ?? null;
  const within = (k: "weight_kg" | "body_fat_pct" | "muscle_mass_kg") => ms.filter((m) => m.date >= start && m.date <= end && m[k] != null);
  const chg = (k: "weight_kg" | "body_fat_pct" | "muscle_mass_kg") => {
    const w = within(k);
    if (!w.length) return null;
    const last = w[w.length - 1][k] as number;
    const first = before(k) ?? (w.length > 1 ? (w[0][k] as number) : null);
    return first == null ? null : round(last - first, 2);
  };
  const scores = days.map((d) => dayScores(db, d).overall).filter((v): v is number => v != null);
  return {
    start, end, days: days.length,
    avgKcal: avg(nut.map((n) => n.kcal)), avgProtein: avg(nut.map((n) => n.protein)), foodCompliance: avg(comp), loggedDays: nut.length,
    avgWater: avg(wvals), waterGoalDays: wvals.filter((v) => v >= g.water_ml).length,
    medAdherence: med.pct, missed: med.missed,
    sessions: sess.filter((s) => s.kind !== "cardio" && s.status === "completed").length,
    cardio: sess.filter((s) => s.kind === "cardio").length,
    volume: Math.round(volumeLoad(sets)), sets: sets.length, prs,
    avgSleep: avg(sl.map((s) => s.duration_h)), avgSleepScore: avg(sl.map((s) => sleepScore(s, g))),
    weightChange: chg("weight_kg"), fatChange: chg("body_fat_pct"), muscleChange: chg("muscle_mass_kg"),
    avgScore: avg(scores),
  };
}

/* ----------------------------------------------------------- sleep ↔ progress ---- */
export interface Correlation { label: string; r: number | null; n: number; note: string }
export function sleepCorrelations(db: DB, end: DateStr = todayStr(), weeks = 12): Correlation[] {
  const g = db.profile!.goals;
  const ws = weekStart(end);
  const rows = Array.from({ length: weeks }, (_, i) => {
    const start = addDays(ws, -7 * (weeks - 1 - i));
    const stop = addDays(start, 6);
    const sl = db.sleep_logs.filter((s) => s.date >= start && s.date <= stop);
    const sets = workingSets(db.sets).filter((s) => s.date >= start && s.date <= stop);
    const rp = sets.map((s) => s.rpe).filter((v): v is number => v != null);
    const e = avg(sets.map((s) => e1RM(s.weight_kg, s.reps, s.rir)));
    const wk = db.measurements.filter((m) => m.date >= start && m.date <= stop && m.weight_kg != null);
    const comp = avg(rangeDays(stop, 7).map((d) => foodCompliance(db.meal_logs, d, g)).filter((v): v is number => v != null));
    return { sleep: avg(sl.map((s) => s.duration_h)), n: sl.length, vol: sets.length ? volumeLoad(sets) : null, rpe: avg(rp), e1: e, w: wk.length ? avg(wk.map((m) => m.weight_kg as number)) : null, comp };
  }).filter((r) => r.sleep != null && r.n >= 3);
  const pair = (label: string, key: "vol" | "rpe" | "e1" | "w" | "comp", note: string): Correlation => {
    const p = rows.filter((r) => r[key] != null);
    return { label, r: pearson(p.map((r) => r.sleep as number), p.map((r) => r[key] as number)), n: p.length, note };
  };
  return [
    pair("النوم ↔ حجم التمرين الأسبوعي", "vol", "هل ينام أكثر في الأسابيع التي يتدرب فيها بحجم أعلى؟"),
    pair("النوم ↔ متوسط القوة (e1RM)", "e1", "ارتباط ساعات النوم بالقوة المقدّرة"),
    pair("النوم ↔ الإجهاد المُدرَك (RPE)", "rpe", "الارتباط السالب يعني أن النوم الأطول يخفّض الإجهاد"),
    pair("النوم ↔ متوسط الوزن", "w", "ارتباط النوم بتغيّر الوزن الأسبوعي"),
    pair("النوم ↔ الالتزام الغذائي", "comp", "هل قلّة النوم تُضعف الالتزام بالنظام؟"),
  ];
}

/* ---------------------------------------------------------------------- insights ---- */
const ins = (id: string, kind: Insight["kind"], area: Insight["area"], title: string, body: string, severity: number, date: DateStr): Insight => ({ id, kind, area, title, body, severity, date });

export function generateInsights(db: DB, date: DateStr = todayStr()): Insight[] {
  const out: Insight[] = [];
  const g = db.profile?.goals;
  if (!g) return out;
  const last7 = rangeDays(date, 7);
  const prev7 = rangeDays(addDays(date, -7), 7);

  /* ---- body composition ---- */
  const ms = sortedMeasurements(db);
  const withFat = ms.filter((m) => m.body_fat_pct != null && m.muscle_mass_kg != null);
  if (withFat.length >= 2) {
    const a = withFat[withFat.length - 2], b = withFat[withFat.length - 1];
    const dFat = (b.body_fat_pct as number) - (a.body_fat_pct as number);
    const dSmm = (b.muscle_mass_kg as number) - (a.muscle_mass_kg as number);
    if (Math.abs(dFat) <= 0.8 && dSmm > 0.05) out.push(ins("recomp-hold", "achievement", "body", "تم الحفاظ على نسبة الدهون مع زيادة الكتلة العضلية", `نسبة الدهون ${a.body_fat_pct}% → ${b.body_fat_pct}% بينما زادت الكتلة العضلية ${round(dSmm, 1)} كجم.`, 1, b.date));
    else if (dFat < -0.3 && dSmm >= -0.3) out.push(ins("fat-loss", "achievement", "body", "انخفضت الدهون مع الحفاظ على العضلات", `الدهون ${round(dFat, 1)} نقطة مئوية والعضلات ${dSmm >= 0 ? "+" : ""}${round(dSmm, 1)} كجم منذ القراءة السابقة.`, 1, b.date));
    else if (dSmm < -0.5) out.push(ins("muscle-loss", "warning", "body", "انخفاض في الكتلة العضلية", `الكتلة العضلية انخفضت ${round(Math.abs(dSmm), 1)} كجم — راجع البروتين والنوم وحجم التمرين.`, 3, b.date));
    const first = withFat[0], lastM = withFat[withFat.length - 1];
    if (withFat.length >= 3) {
      const tf = (lastM.body_fat_pct as number) - (first.body_fat_pct as number), ts = (lastM.muscle_mass_kg as number) - (first.muscle_mass_kg as number);
      if (tf < -1 && ts > 0.5) out.push(ins("recomp-total", "achievement", "body", "إعادة تركيب ناجحة للجسم", `منذ ${fmt(first.date, "d MMM")}: الدهون ${round(tf, 1)} نقطة مئوية والعضلات +${round(ts, 1)} كجم.`, 1, lastM.date));
    }
  }
  const lw = latestValue(db, "weight_kg");
  if (lw && g.target_weight_kg) {
    const diff = round(lw.value - g.target_weight_kg, 1);
    if (diff > 0.2) out.push(ins("target-gap", "insight", "body", `باقي ${diff} كجم على الوزن المستهدف`, `وزنك ${lw.value} كجم والمستهدف ${g.target_weight_kg} كجم (حسب InBody، المطلوب فقدان دهون لا عضلات).`, 1, lw.date));
    else if (Math.abs(diff) <= 0.2) out.push(ins("target-hit", "achievement", "body", "وصلت إلى الوزن المستهدف", `الوزن ${lw.value} كجم ≈ المستهدف ${g.target_weight_kg} كجم.`, 1, lw.date));
  }
  const weights = weightSeries(db).filter((w) => diffDays(date, w.date) <= 28);
  if (weights.length >= 3) {
    const s = slope(weights.map((w) => w.weight));
    const span = Math.max(1, diffDays(weights[weights.length - 1].date, weights[0].date));
    if (s != null) {
      const perWeek = (s * (weights.length - 1) / span) * 7;
      if (Math.abs(perWeek) > 1) out.push(ins("weight-rate", "warning", "body", "تغيّر الوزن سريع", `معدل التغيّر ≈ ${round(perWeek, 2)} كجم/أسبوع — الأفضل أقل من 0.5–0.75 كجم أسبوعيًا للحفاظ على العضلات.`, 2, date));
    }
  }
  const vf = latestValue(db, "visceral_fat");
  if (vf) out.push(vf.value >= 10
    ? ins("visceral", "warning", "body", "الدهون الحشوية مرتفعة", `المستوى ${vf.value} (الطبيعي 1–9). ناقش الأمر مع طبيبك.`, 3, vf.date)
    : ins("visceral-ok", "insight", "body", "الدهون الحشوية ضمن المدى الطبيعي", `المستوى ${vf.value} (الطبيعي 1–9).`, 1, vf.date));

  /* ---- nutrition ---- */
  const nut7 = last7.map((d) => ({ d, n: dayNutrition(db.meal_logs, d) })).filter((x) => x.n.logged);
  const lastLogDay = db.meal_logs.map((l) => l.date).sort().pop();
  if (!lastLogDay || diffDays(date, lastLogDay) >= 3) {
    out.push(ins("nut-gap", "recommendation", "nutrition", "سجّل وجباتك لتحصل على تحليل دقيق", lastLogDay ? `آخر تسجيل كان ${fmt(lastLogDay)} — التسجيل اليومي يرفع دقة التحليلات.` : "لم تُسجَّل أي وجبات بعد.", 2, date));
  } else if (nut7.length >= 3) {
    const k = avg(nut7.map((x) => x.n.kcal))!, p = avg(nut7.map((x) => x.n.protein))!;
    const comps = last7.map((d) => foodCompliance(db.meal_logs, d, g)).filter((v): v is number => v != null);
    const c = avg(comps)!;
    const kd = (k - g.calories) / g.calories;
    if (Math.abs(kd) > 0.12) out.push(ins("kcal-off", "warning", "nutrition", kd > 0 ? "السعرات أعلى من خطتك" : "السعرات أقل من خطتك", `متوسط 7 أيام ${Math.round(k)} كجم سعر مقابل الهدف ${g.calories} (${kd > 0 ? "+" : ""}${pct(kd)}%).`, 2, date));
    if (p < g.protein_g * 0.9) out.push(ins("protein-low", "recommendation", "nutrition", "البروتين أقل من المطلوب", `المتوسط ${Math.round(p)} جم مقابل ${g.protein_g} جم — التزم بحصص اللحوم/البيض والمكمل البروتيني.`, 2, date));
    if (c >= 0.9) out.push(ins("food-great", "achievement", "nutrition", "التزام غذائي ممتاز", `متوسط الالتزام بالنظام ${pct(c)}% خلال آخر 7 أيام.`, 1, date));
    else if (c < 0.7) out.push(ins("food-low", "warning", "nutrition", "انخفض الالتزام بالنظام الغذائي", `متوسط الالتزام ${pct(c)}% خلال آخر 7 أيام.`, 2, date));
    const grpDef = GROUP_ORDER.map((gr) => ({ gr, avg: avg(nut7.map((x) => x.n.servings[gr]))!, t: g.servings[gr] })).filter((x) => x.t > 0).sort((a, b) => a.avg / a.t - b.avg / b.t)[0];
    if (grpDef && grpDef.avg / grpDef.t < 0.7) out.push(ins("group-low", "recommendation", "nutrition", `قصّرت في حصص ${FOOD_GROUPS[grpDef.gr].label}`, `المتوسط ${round(grpDef.avg, 1)} من ${grpDef.t} حصة يوميًا.`, 1, date));
  }

  /* ---- water ---- */
  const wAvg = (days: DateStr[]) => avg(days.map((d) => waterOn(db, d)).filter((_, i) => db.water_logs.some((w) => w.date === days[i])));
  const w7 = wAvg(last7), wP = wAvg(prev7);
  if (w7 != null && wP != null && wP > 0 && (w7 - wP) / wP <= -0.15) out.push(ins("water-drop", "warning", "water", "انخفض الالتزام بالمياه خلال آخر 7 أيام", `المتوسط ${Math.round(w7)} مل مقابل ${Math.round(wP)} مل في الأسبوع السابق.`, 2, date));
  else if (w7 != null && w7 < g.water_ml * 0.75) out.push(ins("water-low", "recommendation", "water", "اشرب ماءً أكثر", `المتوسط ${Math.round(w7)} مل من ${g.water_ml} مل — وزّعها على 8 مرات يوميًا.`, 1, date));
  const ws = waterStreak(db, g.water_ml, date);
  if (ws >= 3) out.push(ins("water-streak", "achievement", "water", `سلسلة ماء ${ws} أيام متتالية`, `حققت هدف ${g.water_ml / 1000} لتر ${ws} أيام متتالية.`, 1, date));

  /* ---- medications ---- */
  const m7 = medAdherence(db, addDays(date, -6), date);
  if (m7.pct != null && m7.due >= 6) {
    if (m7.pct < 0.8) {
      const top = missedDoses(db, addDays(date, -6), date);
      const cnt = new Map<string, number>();
      top.forEach((t) => cnt.set(t.name, (cnt.get(t.name) ?? 0) + 1));
      const worst = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0];
      out.push(ins("med-low", "warning", "meds", "انخفض الالتزام الدوائي", `الالتزام ${pct(m7.pct)}% — فاتتك ${m7.missed} جرعة${worst ? `، أكثرها ${worst[0]} (${worst[1]})` : ""}.`, 3, date));
    } else if (m7.pct >= 0.95) out.push(ins("med-great", "achievement", "meds", "التزام دوائي شبه كامل", `${pct(m7.pct)}% من الجرعات خلال آخر 7 أيام.`, 1, date));
  }

  /* ---- workouts ---- */
  const prs = prEvents(db).filter((p) => diffDays(date, p.date) <= 7);
  prs.slice(0, 3).forEach((p, i) => out.push(ins(`pr-${i}-${p.exercise}`, "achievement", "workout", `قمت بتسجيل رقم قياسي جديد في تمرين ${p.exercise}`, `${p.weight} كجم × ${p.reps} (e1RM ≈ ${round(p.e1rm, 1)} كجم، السابق ${round(p.previous, 1)}).`, 1, p.date)));
  const thisWeek = weekStart(date);
  const doneThisWeek = db.sessions.filter((s) => s.date >= thisWeek && s.date <= date && s.kind !== "cardio" && s.status === "completed").length;
  const dow = diffDays(date, thisWeek);
  if (dow >= 3 && doneThisWeek < Math.floor(g.workouts_per_week / 2)) out.push(ins("workout-behind", "recommendation", "workout", "متأخر عن عدد الجلسات الأسبوعية", `أنجزت ${doneThisWeek} من ${g.workouts_per_week} جلسات هذا الأسبوع.`, 2, date));
  if (doneThisWeek >= g.workouts_per_week) out.push(ins("workout-done", "achievement", "workout", "أنجزت جلسات الأسبوع كاملة", `${doneThisWeek}/${g.workouts_per_week} جلسات مقاومة.`, 1, date));
  const cardioWeek = db.sessions.filter((s) => s.date >= thisWeek && s.date <= date && s.kind === "cardio").length;
  if (dow >= 4 && cardioWeek < Math.min(3, g.cardio_days_per_week)) out.push(ins("cardio-low", "recommendation", "workout", "المشي/الكارديو أقل من المطلوب", `${cardioWeek} من ${g.cardio_days_per_week} أيام هذا الأسبوع (30 دقيقة مشي).`, 1, date));
  const lastWeekStart = addDays(thisWeek, -7);
  const mu = weeklyMuscleSets(db, lastWeekStart);
  if (db.sets.some((s) => s.date >= lastWeekStart)) {
    (Object.keys(MUSCLES) as MuscleGroup[]).forEach((mg) => {
      const v = mu[mg].sets, cfg = MUSCLES[mg];
      if (v > 0 && v < cfg.weeklySetsMin * 0.6 && ["chest", "back", "quads", "shoulders"].includes(mg)) out.push(ins(`vol-low-${mg}`, "recommendation", "workout", `حجم ${cfg.label} منخفض الأسبوع الماضي`, `${v} مجموعة فعلية (المرجع ${cfg.weeklySetsMin}–${cfg.weeklySetsMax}). التزم بالبرنامج كما هو قبل أي تعديل.`, 1, date));
      if (v > cfg.weeklySetsMax * 1.3) out.push(ins(`vol-high-${mg}`, "warning", "workout", `حجم ${cfg.label} مرتفع جدًا`, `${v} مجموعة (المرجع ≤ ${cfg.weeklySetsMax}) — انتبه للاستشفاء.`, 2, date));
    });
  }
  const ready: string[] = [];
  const seen = new Set<string>();
  for (const e of db.exercises) {
    if (seen.has(e.name)) continue; seen.add(e.name);
    const a = overloadAdvice(db, e.name, e.rep_min, e.rep_max, e.work_sets, ["quads", "hamstrings", "calves", "adductors"].includes(e.muscle));
    if (a.status === "increase") ready.push(e.name);
  }
  if (ready.length) out.push(ins("overload-ready", "recommendation", "workout", "جاهز لزيادة الأحمال", `حققت أعلى المدى في: ${ready.slice(0, 4).join("، ")}${ready.length > 4 ? "…" : ""} — ارفع الوزن في الجلسة القادمة.`, 1, date));
  const recent = db.sessions.filter((s) => s.kind !== "cardio").sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const rp = recent.map((s) => avg(db.sets.filter((x) => x.session_id === s.id && !x.is_warmup && x.rpe != null).map((x) => x.rpe as number))).filter((v): v is number => v != null);
  if (rp.length === 3 && rp.every((v) => v >= 9.2)) out.push(ins("rpe-high", "warning", "workout", "إجهاد مرتفع في آخر 3 جلسات", `متوسط RPE ≥ 9 باستمرار — راقب النوم والاستشفاء ولا تتجاوز الفشل بمدى حركي كامل.`, 2, date));

  /* ---- sleep ---- */
  const sl7 = db.sleep_logs.filter((s) => s.date >= addDays(date, -6) && s.date <= date);
  if (sl7.length >= 3) {
    const h = avg(sl7.map((s) => s.duration_h))!;
    if (h < g.sleep_hours - 1) out.push(ins("sleep-short", "warning", "sleep", "متوسط النوم أقل من المطلوب", `${round(h, 1)} ساعة مقابل هدف ${g.sleep_hours} — النوم يؤثر على العضلات والشهية.`, 2, date));
    else if (h >= g.sleep_hours - 0.5) out.push(ins("sleep-good", "achievement", "sleep", "نوم جيد هذا الأسبوع", `متوسط ${round(h, 1)} ساعة.`, 1, date));
    const late = sl7.filter((s) => { let b = timeToMin(s.bedtime); if (b < 720) b += 1440; return b > timeToMin(g.bedtime_before); }).length;
    if (late >= 3) out.push(ins("bed-late", "recommendation", "sleep", "نمت متأخرًا أكثر من مرة", `${late} ليالٍ بعد ${g.bedtime_before} — الخطة تطلب النوم قبل 11 مساءً وبعد الأكل بساعتين.`, 1, date));
  }
  const checks = db.checkins.filter((c) => c.date >= addDays(date, -6) && c.screen_minutes != null);
  if (checks.length >= 3 && avg(checks.map((c) => c.screen_minutes as number))! > g.screen_max_min) out.push(ins("screen-high", "recommendation", "sleep", "وقت الشاشات أعلى من الحد", `المتوسط ${Math.round(avg(checks.map((c) => c.screen_minutes as number))!)} دقيقة مقابل الحد ${g.screen_max_min}.`, 1, date));
  const best = sleepCorrelations(db, date).find((c) => c.r != null && c.n >= 5 && Math.abs(c.r) >= 0.5);
  if (best) out.push(ins("sleep-corr", "insight", "sleep", best.label, `معامل الارتباط r = ${round(best.r!, 2)} (n=${best.n} أسابيع) — ${best.note}`, 1, date));

  /* ---- general streak ---- */
  let streak = 0;
  for (let d = date; ; d = addDays(d, -1)) {
    const s = dayScores(db, d).overall;
    if (s != null && s >= 0.7) streak++; else if (d === date && s == null) continue; else break;
    if (streak > 60) break;
  }
  if (streak >= 3) out.push(ins("streak", "achievement", "general", `${streak} أيام متتالية بنتيجة يومية ≥ 70%`, "استمر — الثبات أهم من الكمال.", 1, date));

  const order = { warning: 0, recommendation: 1, achievement: 2, insight: 3 } as const;
  return out.sort((a, b) => order[a.kind] - order[b.kind] || b.severity - a.severity);
}

export { SPLITS, EXCHANGE };
