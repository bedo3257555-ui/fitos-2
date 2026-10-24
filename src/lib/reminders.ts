import { MEALS, MEAL_ORDER } from "./constants";
import { nextSplit, slotsOn, waterOn } from "./analytics";
import { minToTime, nowMinutes, timeToMin, today } from "./dates";
import type { DB } from "./types";
import { SPLITS } from "./constants";
import { dayReview, proteinPace, readiness } from "./intel";

const FIRED = "fitos:reminders:";

function wasFired(key: string) {
  try { return localStorage.getItem(FIRED + key) === "1"; } catch { return false; }
}
function markFired(key: string) {
  try {
    localStorage.setItem(FIRED + key, "1");
    const d = today();
    Object.keys(localStorage).filter((k) => k.startsWith(FIRED) && !k.includes(d)).forEach((k) => localStorage.removeItem(k));
  } catch { /* storage unavailable */ }
}

export async function notify(title: string, body: string, tag: string, url = "/") {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, tag, icon: "/icon.svg", badge: "/icon.svg", dir: "rtl", lang: "ar", data: { url } });
    else new Notification(title, { body, tag, icon: "/icon.svg", dir: "rtl", lang: "ar" });
  } catch { /* ignore */ }
}

/** Runs every ~30s while the app is open. Each reminder fires once per day/slot. */
export function checkReminders(db: DB) {
  const g = db.profile?.goals;
  if (!g) return;
  const d = today();
  const now = nowMinutes();
  const r = g.reminders;

  if (r.meds) {
    for (const s of slotsOn(db, d, now, d)) {
      const t = timeToMin(s.time);
      const key = `${d}:med:${s.medication_id}:${s.slot_id}`;
      if (!s.logId && now >= t && now <= t + 20 && !wasFired(key)) {
        markFired(key);
        void notify(`💊 ${s.name}`, `${s.label} — ${s.dose}`, key, "/medications");
      }
    }
  }
  if (r.water && now >= 9 * 60 && now <= 21 * 60 && now % 60 < 2) {
    const key = `${d}:water:${Math.floor(now / 60)}`;
    const expected = (g.water_ml * (now / 60 - 8)) / 13;
    if (!wasFired(key) && waterOn(db, d) < expected - 400) {
      markFired(key);
      void notify("💧 وقت الماء", `شربت ${waterOn(db, d)} مل من ${g.water_ml} مل`, key, "/water");
    }
  }
  if (r.meals) {
    for (const m of MEAL_ORDER) {
      const t = timeToMin(g.meal_times[m] ?? MEALS[m].defaultTime) - 10;
      const key = `${d}:meal:${m}`;
      const logged = db.meal_logs.some((l) => l.date === d && l.meal === m);
      if (!wasFired(key) && !logged && now >= t && now <= t + 15) {
        markFired(key);
        void notify(`${MEALS[m].icon} موعد ${MEALS[m].label}`, "لا تنسَ تسجيل الوجبة بعد الأكل", key, "/nutrition");
      }
    }
  }
  if (r.sleep) {
    const t = timeToMin(g.bedtime_before) - 45;
    const key = `${d}:sleep`;
    if (!wasFired(key) && now >= t && now <= t + 15) {
      markFired(key);
      void notify("🌙 استعد للنوم", `الهدف النوم قبل ${g.bedtime_before} وبعد الأكل بساعتين. ${minToTime(t)} الآن.`, key, "/sleep");
    }
  }
  if (r.workout) {
    const key = `${d}:workout`;
    const done = db.sessions.some((s) => s.date === d);
    const ns = nextSplit(db, d);
    if (!wasFired(key) && !done && ns.split !== "rest" && now >= 16 * 60 + 30 && now <= 16 * 60 + 45) {
      markFired(key);
      void notify("🏋️ وقت التمرين", `جلسة اليوم: ${SPLITS[ns.split].en}`, key, "/workouts");
    }
  }
  checkSmartReminders(db, d, now);
}

/** تنبيهات تكيّفية تعتمد على سلوكك الفعلي اليوم (تحترم نفس مفاتيح التذكير في الإعدادات). */
function checkSmartReminders(db: DB, d: string, now: number) {
  const g = db.profile?.goals;
  if (!g) return;
  const r = g.reminders;

  // جرعة لم تُسجَّل بعد ساعة من موعدها
  if (r.meds) {
    for (const s of slotsOn(db, d, now, d)) {
      const t = timeToMin(s.time);
      const key = `${d}:medlate:${s.medication_id}:${s.slot_id}`;
      if (!s.logId && now >= t + 60 && now <= t + 80 && !wasFired(key)) {
        markFired(key);
        void notify(`⏰ ${s.name} لسه مش مسجّل`, `${s.label} — لو أخدتها سجّلها، ولو لأ علّمها «متخطّاة». لا تضاعف الجرعة.`, key, "/medications");
      }
    }
  }
  // بروتين متبقٍّ في المساء
  if (r.meals && now >= 19 * 60 && now <= 19 * 60 + 20) {
    const key = `${d}:protein-late`;
    const p = proteinPace(db, d);
    if (!wasFired(key) && p.hasLogs && p.left > g.protein_g * 0.3) {
      markFired(key);
      void notify("🥩 باقي بروتين", `باقي ${p.left} جم من ${p.goal} جم — راجع حصصك المتبقية.`, key, "/nutrition");
    }
  }
  // جاهزية منخفضة قبل التمرين
  if (r.workout && now >= 16 * 60 && now <= 16 * 60 + 15) {
    const key = `${d}:ready-low`;
    const done = db.sessions.some((s) => s.date === d && s.kind !== "cardio");
    const rd = readiness(db, d);
    if (!wasFired(key) && !done && rd.level === "low" && nextSplit(db, d).split !== "rest") {
      markFired(key);
      void notify(`🔋 جاهزيتك ${rd.score}/100`, rd.advice, key, "/coach");
    }
  }
  // ملخص نهاية اليوم
  if (r.sleep) {
    const t = timeToMin(g.bedtime_before) - 90;
    const key = `${d}:wrapup`;
    if (!wasFired(key) && now >= t && now <= t + 15) {
      markFired(key);
      const rv = dayReview(db, d);
      if (rv && rv.score != null) void notify(`🌙 يومك: ${Math.round(rv.score * 100)}%`, `${rv.wins[0] ? `✓ ${rv.wins[0]} · ` : ""}بكرة: ${rv.tomorrow.workout}`, key, "/coach");
    }
  }
}
