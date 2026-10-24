import { MEAL_TARGETS, MEAL_ORDER } from "./constants";
import { addDays, rangeDays, timeToMin, minToTime } from "./dates";
import { calcMacros, sleepMinutes } from "./analytics";
import type { DB, DateStr, FoodGroup, MealLog, MedLog, Measurement, SleepLog, WaterLog, WorkoutSession, WorkoutSet, Checkin } from "./types";
import { CYCLE } from "./constants";

export const SAMPLE_PREFIX = "sample-";
export const isSample = (id: string) => id.startsWith(SAMPLE_PREFIX);

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const BASE: Record<string, number> = {
  "Machine Shoulder Press": 40, "Chest Press Machine": 60, "Hack Squat": 80, "Machine Lateral Raises": 25, "Overhead Extension": 25,
  Butterfly: 45, "Lat Pulldown Crunches": 30, "Leg Extension": 55, "T Bar Row": 50, "Machine Wide Grip Lat Pulldown": 55, RDL: 70,
  "SA Rear Delt Flies": 10, "Seated Leg Curl": 45, "Preacher Curl Machine": 30, "Leg Press Calf Raises": 90, "Wrist Curls": 15,
  "Incline Chest Press Machine": 50, "Cable Lateral Raises": 7.5, "SA Tricep Pushdown": 15, "Hip Adduction": 50, "Reverse Grip Curls": 15,
  "SA Lat Row": 30, "Face Away Curl": 12.5, "Cable Shrugs": 40,
};

/** Fake-but-plausible history (28 days) so charts/heatmaps can be previewed. All ids start with "sample-". */
export function buildSample(db: DB, end: DateStr): Partial<DB> {
  const r = rng(42);
  let n = 0;
  const id = () => `${SAMPLE_PREFIX}${++n}`;
  const days = rangeDays(end, 28);
  const meal_logs: MealLog[] = [], water_logs: WaterLog[] = [], med_logs: MedLog[] = [], sleep_logs: SleepLog[] = [];
  const checkins: Checkin[] = [], sessions: WorkoutSession[] = [], sets: WorkoutSet[] = [], measurements: Measurement[] = [];

  days.forEach((date, di) => {
    const isToday = date === end;
    if (!isToday) {
      const comply = 0.72 + r() * 0.28;
      for (const meal of MEAL_ORDER) {
        const tg = MEAL_TARGETS[meal];
        for (const g of Object.keys(tg) as FoodGroup[]) {
          const t = tg[g] ?? 0;
          if (!t || r() > 0.96) continue;
          const s = Math.max(0, Math.round(t * (comply + (r() - 0.5) * 0.3) * 2) / 2);
          if (!s) continue;
          const m = calcMacros(g, meal, s);
          meal_logs.push({ id: id(), date, meal, group: g, servings: s, kcal: m.kcal, protein_g: m.protein_g, carbs_g: m.carbs_g, fat_g: m.fat_g, note: "" });
        }
      }
      const cups = Math.max(3, Math.round(8 * (0.6 + r() * 0.5)));
      for (let i = 0; i < cups; i++) water_logs.push({ id: id(), date, amount_ml: 250, logged_at: `${date}T${minToTime(480 + i * 100)}:00` });
      for (const m of db.medications) for (const s of m.slots) if (r() < 0.9) med_logs.push({ id: id(), date, medication_id: m.id, slot_id: s.id, status: "taken", taken_at: `${date}T${s.time}:00` });
      const bed = minToTime(22 * 60 + 30 + Math.round(r() * 120));
      const wake = minToTime(6 * 60 + 30 + Math.round(r() * 60));
      const dur = sleepMinutes(bed, wake) / 60;
      sleep_logs.push({ id: id(), date, bedtime: bed, wake_time: wake, duration_h: Math.round(dur * 10) / 10, quality: 3 + Math.round(r() * 2), notes: "" });
      checkins.push({ id: id(), date, screen_minutes: 90 + Math.round(r() * 90), energy: 3 + Math.round(r() * 2), notes: "" });
    }
    const slot = CYCLE[di % 7];
    if (!isToday && slot !== "rest") {
      const sid = id();
      sessions.push({ id: sid, date, kind: slot, status: "completed", started_at: `${date}T17:00:00`, duration_min: 60 + Math.round(r() * 15), notes: "" });
      const week = Math.floor(di / 7);
      db.exercises.filter((e) => e.split === slot).forEach((ex) => {
        const base = BASE[ex.name] ?? 30;
        for (let k = 0; k < ex.work_sets; k++) {
          const w = Math.round((base * (1 + week * 0.025)) / 2.5) * 2.5;
          const reps = Math.min(ex.rep_max, ex.rep_min + Math.round(r() * (ex.rep_max - ex.rep_min)));
          sets.push({ id: id(), session_id: sid, date, exercise_id: ex.id, exercise_name: ex.name, muscle: ex.muscle, set_no: k + 1, weight_kg: w, reps, rir: 1 + Math.round(r() * 2), rpe: 7 + Math.round(r() * 3 * 2) / 2 / 1.5, is_warmup: false, notes: "" });
        }
      });
    }
    if (!isToday && di % 7 !== 2 && di % 7 !== 5 && r() < 0.8) {
      sessions.push({ id: id(), date, kind: "cardio", status: "completed", started_at: `${date}T19:00:00`, duration_min: 30, notes: "مشي 2 ميل" });
    }
    if (di % 7 === 0) {
      const t = di / 27;
      measurements.push({ id: id(), date, source: "manual", weight_kg: Math.round((77.4 - t * 0.9 + (r() - 0.5) * 0.3) * 10) / 10, waist_cm: Math.round((84 - t * 1.5) * 10) / 10, chest_cm: 101 + Math.round(t * 10) / 10, arm_cm: Math.round((35 + t * 0.6) * 10) / 10, thigh_cm: 58, body_fat_pct: null, muscle_mass_kg: null, fat_mass_kg: null, bmi: null, bmr: null, visceral_fat: null, body_water_l: null, inbody_score: null, notes: "قياس تجريبي" });
    }
  });
  return { meal_logs, water_logs, med_logs, sleep_logs, checkins, sessions, sets, measurements };
}
export { timeToMin, addDays };
