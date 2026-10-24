/**
 * «اسأل المدرب» — محرّك أسئلة وأجوبة محلي (بدون إنترنت وبدون مفاتيح API).
 * يفهم أسئلة قصيرة بالعامية/الفصحى ويجيب من بياناتك الفعلية عبر دوال intel.ts.
 * قراءة فقط: لا يغيّر خطتك الغذائية ولا برنامج تمرينك، ولا يقترح تعديل جرعات.
 */
import { MEALS, SPLITS } from "./constants";
import { fmt, nowMinutes, today as todayStr } from "./dates";
import { dayNutrition, dayScores, latestValue, medAdherence, nextSplit, prEvents } from "./analytics";
import {
  coachPlan, dayReview, energyBalance, focusArea, mealStates, medPatterns, progression, proteinPace, readiness, strengthOutlook,
  waterPace, weekdayPattern, weeklyChallenge, weeklyStory, weightTrend,
} from "./intel";
import { addDays } from "./dates";
import type { DB, DateStr } from "./types";

export interface ChatAnswer { text: string; chips: string[]; href?: string; hrefLabel?: string }

export const STARTERS = ["أعمل إيه دلوقتي؟", "جاهز أتمرن النهارده؟", "هوصل لهدفي إمتى؟", "التزامي بالأدوية عامل إزاي؟", "إيه أضعف حاجة عندي؟", "ملخص الأسبوع اللي فات"];

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export function norm(s: string): string {
  return s.replace(/[\u064B-\u065F\u0670\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).replace(/[؟?!.،,]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}
const has = (n: string, ...words: string[]) => words.some((w) => n.includes(w));
const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

interface Intent { id: string; keys: string[]; run: (db: DB, d: DateStr, now: number) => ChatAnswer }

const INTENTS: Intent[] = [
  {
    id: "hi", keys: ["ازيك", "اهلا", "مرحبا", "سلام", "صباح", "مساء", "هاي"],
    run: (db, d, now) => {
      const p = coachPlan(db, d, now);
      return { text: `أهلًا 👋 ${p.actions.length ? `عندك ${p.actions.length} خطوات مقترحة دلوقتي.` : "يومك ماشي تمام."} اسألني أي حاجة عن بياناتك.`, chips: STARTERS.slice(0, 4) };
    },
  },
  {
    id: "now", keys: ["دلوقتي", "الان", "اعمل ايه", "اعمل اي", "ايه الجديد", "ناقص", "خطه اليوم", "اولويه", "اول حاجه", "ابدا"],
    run: (db, d, now) => {
      const p = coachPlan(db, d, now);
      if (!p.actions.length) return { text: "مفيش حاجة معلّقة دلوقتي 👌 كل المطلوب في وقته. كمّل يومك بهدوء.", chips: ["جاهز أتمرن النهارده؟", "ملخص الأسبوع اللي فات"] };
      const top = p.actions.slice(0, 3).map((a, i) => `${i + 1}. ${a.title} — ${a.detail}`).join("\n");
      return { text: `أهم ${Math.min(3, p.actions.length)} حاجات دلوقتي:\n${top}`, chips: ["جاهز أتمرن النهارده؟", "إيه أضعف حاجة عندي؟"], href: p.actions[0].href, hrefLabel: "افتح أول خطوة" };
    },
  },
  {
    id: "ready", keys: ["جاهز", "اتمرن", "تمرين", "تمرينه", "جيم", "استشفاء", "تعبان", "مرهق", "جلسه", "نشاط"],
    run: (db, d) => {
      const r = readiness(db, d);
      const ns = nextSplit(db, d);
      const done = db.sessions.some((s) => s.date === d && s.kind !== "cardio" && s.status === "completed");
      const plan = done ? "خلّصت جلسة النهارده 💪" : ns.split === "rest" ? "النهارده يوم راحة في دورتك." : `جلسة النهارده في دورتك: ${SPLITS[ns.split].en}.`;
      if (r.score == null) return { text: `${plan}\nمحتاج تسجّل نومك وطاقتك عشان أحسب جاهزيتك.`, chips: ["أعمل إيه دلوقتي؟"], href: "/coach", hrefLabel: "سجّل طاقتك" };
      const dr = r.drivers.map((x) => `${x.label}: ${x.note}`).join(" · ");
      return { text: `${plan}\nجاهزيتك ${r.score}/100 (${r.label}).\n${r.advice}\n${dr}`, chips: ["أعمل إيه دلوقتي؟", "القوة عندي ماشية إزاي؟"] };
    },
  },
  {
    id: "weight", keys: ["هوصل", "وصل", "هدفي", "الهدف", "امتي", "متي", "وزني", "الوزن", "ثبات", "بخس", "نزول", "انزل", "كيلو"],
    run: (db, d) => {
      const t = weightTrend(db, d);
      const body = t.current != null ? `وزنك ${t.current} كجم والهدف ${t.target} (باقي ${Math.max(0, t.remaining ?? 0)} كجم).` : "";
      const eb = energyBalance(db, d);
      return { text: `${t.headline}\n${body}\n${t.detail}${eb ? `\nتقدير ميزان الطاقة: ${eb.balance > 0 ? "+" : ""}${eb.balance} kcal/يوم (تقدير فقط).` : ""}`, chips: ["ليه الوزن ثابت؟", "التزامي بالأدوية عامل إزاي؟"], href: "/coach", hrefLabel: "شوف الرسم والمحاكاة" };
    },
  },
  {
    id: "meds", keys: ["دوا", "ادويه", "جرعه", "جرعات", "مكمل", "مكملات", "حبايه", "فاتني", "نسيت", "التزامي"],
    run: (db, d) => {
      const w = medAdherence(db, addDays(d, -6), d);
      const mp = medPatterns(db, d, 28);
      const worst = mp.worstBucket ? `أكتر وقت بتفوّت فيه: ${mp.worstBucket.label} (${Math.round((mp.worstBucket.rate as number) * 100)}%).` : "";
      const slot = mp.bySlot[0] && mp.bySlot[0].rate < 0.85 ? `أضعف جرعة: ${mp.bySlot[0].name} (${mp.bySlot[0].label}) ${Math.round(mp.bySlot[0].rate * 100)}%.` : "";
      return { text: `التزامك الدوائي آخر 7 أيام ${pct(w.pct)} (فاتك ${w.missed} من ${w.due}).\nسلسلة الأيام الكاملة: ${mp.perfectStreak}.\n${worst} ${slot}\nأي قرار بخصوص الجرعات يخص د. أحمد وحده.`.replace(/\n\s+\n/g, "\n"), chips: ["أعمل إيه دلوقتي؟", "إيه أضعف حاجة عندي؟"], href: "/medications", hrefLabel: "افتح الأدوية" };
    },
  },
  {
    id: "water", keys: ["ماء", "مياه", "مايه", "ميه", "شرب", "اشرب", "عطشان", "ترطيب"],
    run: (db, d, now) => {
      const w = waterPace(db, d, now);
      return { text: `شربت ${w.drunk} مل من ${w.goal}. المفروض لحد دلوقتي ${w.expected} مل.\n${w.text}`, chips: ["أعمل إيه دلوقتي؟", "إيه أضعف حاجة عندي؟"], href: "/water", hrefLabel: "سجّل ماء" };
    },
  },
  {
    id: "food", keys: ["بروتين", "اكل", "اكلت", "وجبه", "وجبات", "سعرات", "كالوري", "فطار", "غدا", "عشا", "حصص", "تغذيه"],
    run: (db, d, now) => {
      const n = dayNutrition(db.meal_logs, d); const pp = proteinPace(db, d); const ms = mealStates(db, d, now);
      const late = ms.filter((m) => m.state === "overdue").map((m) => MEALS[m.meal].label);
      const g = db.profile!.goals;
      return { text: `النهارده: ${Math.round(n.kcal)} من ${g.calories} kcal · بروتين ${pp.logged} من ${pp.goal} جم${pp.left > 0 ? ` (باقي ${pp.left})` : ""}.\n${late.length ? `لسه ما سجّلتش: ${late.join("، ")}.` : "كل وجباتك اللي حان وقتها مسجّلة."}\nالحصص والخطة زي ما هي — بس بسجّل وأحلّل.`, chips: ["أعمل إيه دلوقتي؟", "ملخص الأسبوع اللي فات"], href: "/nutrition", hrefLabel: "افتح التغذية" };
    },
  },
  {
    id: "sleep", keys: ["نوم", "نمت", "سهر", "اسهر", "ارق", "صحيت"],
    run: (db, d) => {
      const g = db.profile!.goals;
      const last = db.sleep_logs.filter((s) => s.date <= d).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
      if (!last.length) return { text: "ما عنديش سجلات نوم لسه. سجّل نومك الأول.", chips: ["أعمل إيه دلوقتي؟"], href: "/sleep", hrefLabel: "سجّل النوم" };
      const avgH = last.reduce((s, x) => s + x.duration_h, 0) / last.length;
      return { text: `متوسط نومك آخر ${last.length} ليالٍ: ${avgH.toFixed(1)} ساعة (الهدف ${g.sleep_hours}).\n${avgH < g.sleep_hours - 0.5 ? "محتاج تقدّم ميعاد النوم؛ الشاشات بعد العشاء بتأخّرك." : "ممتاز، كمّل على كده."}\nالنوم أكبر عامل في جاهزيتك للتمرين.`, chips: ["جاهز أتمرن النهارده؟", "إيه اللي بيرفع طاقتي؟"], href: "/sleep", hrefLabel: "افتح النوم" };
    },
  },
  {
    id: "week", keys: ["اسبوع", "ملخص", "الاسبوع", "تقرير", "حصاد"],
    run: (db, d) => {
      const s = weeklyStory(db, d);
      if (!s) return { text: "لسه مفيش بيانات كفاية.", chips: ["أعمل إيه دلوقتي؟"] };
      return { text: `الأسبوع اللي فات: درجة ${pct(s.score)}${s.prevScore != null ? ` (قبله ${pct(s.prevScore)})` : ""}.\n${s.wins.slice(0, 3).map((x) => `✓ ${x}`).join("\n")}\n${s.gaps.slice(0, 3).map((x) => `• ${x}`).join("\n")}`.trim(), chips: ["إيه أضعف حاجة عندي؟", "أعمل إيه دلوقتي؟"], href: "/reports", hrefLabel: "التقارير" };
    },
  },
  {
    id: "focus", keys: ["اضعف", "ضعيف", "اركز", "تركيز", "مشكله", "اتحسن", "اتطور", "غلط", "تحدي"],
    run: (db, d) => {
      const f = focusArea(db, d); const c = weeklyChallenge(db, d); const wd = weekdayPattern(db, d);
      const parts: string[] = [];
      parts.push(f ? `أضعف مجال آخر أسبوعين: ${f.label} (${Math.round(f.avg * 100)}%).\n${f.action}` : "كل مجالاتك فوق 90% أو البيانات لسه قليلة 👏");
      if (wd.worst) parts.push(`أضعف أيامك: ${wd.worst.label}.`);
      if (c) parts.push(`تحدي الأسبوع: ${c.title} — ${c.progress}/${c.target} ${c.unit}.`);
      return { text: parts.join("\n"), chips: ["أعمل إيه دلوقتي؟", "ملخص الأسبوع اللي فات"], href: "/coach", hrefLabel: "المدرب الذكي" };
    },
  },
  {
    id: "strength", keys: ["قوه", "اوزان", "ارقام", "قياسيه", "pr", "بقيت اقوي", "ثابت", "اتحسنت", "تقدم", "اسبوع كام", "برنامج"],
    run: (db, d) => {
      const so = strengthOutlook(db, d); const prs = prEvents(db).length;
      if (!so.lifts.length) return { text: `أنت في الأسبوع ${so.programWeek ?? 0} من 12. محتاج 3 جلسات على الأقل لكل تمرين عشان أحلّل القوة.`, chips: ["جاهز أتمرن النهارده؟"] };
      return { text: `أنت في الأسبوع ${so.programWeek} من 12.\nصاعد: ${so.rising.slice(0, 3).map((l) => `${l.exercise} (+${l.changePct}%)`).join("، ") || "—"}.\nثابت/متراجع: ${so.stalled.length} تمارين. أرقام قياسية: ${prs}.\n${so.deloadSignal ? "فيه إشارات إجهاد — راجع النوم والبروتين وناقش مع مختصّك." : "الثبات الطبيعي في الأسابيع الأولى عادي، والبرنامج بيفضل زي ما هو."}`, chips: ["جاهز أتمرن النهارده؟", "إيه أضعف حاجة عندي؟"], href: "/workouts", hrefLabel: "افتح التمارين" };
    },
  },
  {
    id: "body", keys: ["دهون", "عضلات", "inbody", "انبودي", "قياسات", "خصر", "جسم", "شكلي", "تركيب"],
    run: (db) => {
      const f = latestValue(db, "body_fat_pct"), m = latestValue(db, "muscle_mass_kg"), w = latestValue(db, "weight_kg");
      if (!f && !m && !w) return { text: "ما عنديش قياسات لسه.", chips: ["أعمل إيه دلوقتي؟"], href: "/measurements", hrefLabel: "سجّل قياس" };
      return { text: `آخر قياساتك:\n${w ? `الوزن ${w.value} كجم (${fmt(w.date, "d MMM")})\n` : ""}${f ? `الدهون ${f.value}% (${fmt(f.date, "d MMM")})\n` : ""}${m ? `العضلات ${m.value} كجم (${fmt(m.date, "d MMM")})` : ""}`.trim(), chips: ["هوصل لهدفي إمتى؟"], href: "/measurements", hrefLabel: "القياسات" };
    },
  },
  {
    id: "level", keys: ["مستوي", "مستوا", "نقاط", "وسام", "اوسمه", "xp", "سلسله", "لفل", "انجاز"],
    run: (db, d) => {
      const p = progression(db, d); const earned = p.badges.filter((b) => b.earned).length; const next = p.badges.filter((b) => !b.earned).sort((a, b) => b.progress - a.progress)[0];
      return { text: `مستواك ${p.level} (${p.title}) — ${p.xp} نقطة.\nسلسلتك الحالية ${p.streak} يوم، وأفضل سلسلة ${p.bestStreak}.\nأوسمة: ${earned}/${p.badges.length}.${next ? `\nأقرب وسام: ${next.icon} ${next.title} (${next.detail}).` : ""}`, chips: ["إيه أضعف حاجة عندي؟"], href: "/coach", hrefLabel: "أوسمتي" };
    },
  },
  {
    id: "energy", keys: ["طاقه", "طاقتي", "كسل", "خمول", "تركيز عالي"],
    run: (db, d) => {
      const e = db.checkins.filter((c) => c.energy != null && c.date <= d).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
      if (!e.length) return { text: "سجّل طاقتك كل يوم (5 ثواني) وهقولك إيه اللي بيرفعها عندك.", chips: ["أعمل إيه دلوقتي؟"], href: "/coach", hrefLabel: "سجّل طاقتك" };
      const avgE = e.reduce((s, x) => s + (x.energy as number), 0) / e.length;
      return { text: `متوسط طاقتك آخر ${e.length} أيام: ${avgE.toFixed(1)}/5. افتح المدرب الذكي لتشوف أكتر عامل مرتبط بطاقتك (نوم/ماء/تغذية/شاشات).`, chips: ["جاهز أتمرن النهارده؟"], href: "/coach", hrefLabel: "المدرب الذكي" };
    },
  },
  {
    id: "day", keys: ["يومي", "النهارده", "اداءي", "درجتي", "كان يومي", "امبارح", "غدا", "بكره", "بكرا"],
    run: (db, d) => {
      const r = dayReview(db, d); const s = dayScores(db, d);
      if (!r) return { text: "لسه مفيش بيانات.", chips: ["أعمل إيه دلوقتي؟"] };
      return { text: `درجة يومك لحد دلوقتي: ${pct(s.overall)}.\n${r.wins.map((x) => `✓ ${x}`).join("\n")}\n${r.misses.map((x) => `• ${x}`).join("\n")}\nبكرة: ${r.tomorrow.workout}${r.tomorrow.firstDose ? ` · أول جرعة: ${r.tomorrow.firstDose}` : ""}`.replace(/\n{2,}/g, "\n"), chips: ["أعمل إيه دلوقتي؟", "ملخص الأسبوع اللي فات"] };
    },
  },
];

const DOSE_CHANGE = /(ازود|ازيد|اضاعف|ضاعف|اوقف|اقلل|اغير|ابدل|بدل|اوقفه|وقف).*(جرعه|دوا|دواء|علاج|مكمل)|(جرعه|دوا).*(ازود|اضاعف|اوقف|اقلل)/;
const PLAN_CHANGE = /(اغير|غير|عدل|بدل|اشيل|احذف|ازود).*(نظام|تمرين|برنامج|حصص|الاكل|الخطه|المجاميع|تمارين)/;

export function answer(db: DB, question: string, date: DateStr = todayStr(), nowMin: number = nowMinutes()): ChatAnswer {
  const n = norm(question);
  if (!db.profile) return { text: "لسه بيانات الملف الشخصي مش جاهزة.", chips: [] };
  if (!n) return { text: "اسألني عن يومك، جاهزيتك، وزنك، أدويتك…", chips: STARTERS.slice(0, 4) };
  if (DOSE_CHANGE.test(n)) return { text: "ما أقدرش أنصح بتغيير أو مضاعفة أو إيقاف أي جرعة — ده قرار د. أحمد وحده. اللي أقدر أعمله إني أوريك التزامك وفاتك إيه عشان تعرضه عليه.", chips: ["التزامي بالأدوية عامل إزاي؟"], href: "/doctor", hrefLabel: "تقرير الطبيب" };
  if (PLAN_CHANGE.test(n)) return { text: "ما بغيّرش في نظامك الغذائي ولا برنامج التمرين — دول خطة معتمدة. أقدر أحلّل تقدّمك وأقولك إيه اللي يستاهل نقاشه مع الدكتور أو المدرب.", chips: ["القوة عندي ماشية إزاي؟", "أعمل إيه دلوقتي؟"] };
  if (has(n, "ليه") && has(n, "وزن", "ثابت", "ثبات")) {
    const t = weightTrend(db, date); const f = focusArea(db, date);
    const pre = t.status === "on_track" || t.status === "slow" ? "الوزن مش ثابت — ماشي في الاتجاه الصحيح:\n" : "";
    return { text: `${pre}${t.headline}\n${t.detail}\nمن الأسباب الشائعة: نوم قليل، قياس في ظروف مختلفة، أو احتباس ماء. ${f ? `وأضعف مجال عندك حاليًا: ${f.label}.` : ""}\nالقياس الأدق: InBody بنفس الظروف كل 2–4 أسابيع.`, chips: ["هوصل لهدفي إمتى؟", "إيه أضعف حاجة عندي؟"] };
  }
  let best: { i: Intent; score: number } | null = null;
  for (const i of INTENTS) {
    const score = i.keys.reduce((s, k) => s + (n.includes(norm(k)) ? (k.length > 3 ? 2 : 1) : 0), 0);
    if (score > 0 && (!best || score > best.score)) best = { i, score };
  }
  if (best) return best.i.run(db, date, nowMin);
  return { text: "ما فهمتش سؤالك تمام 🤔 جرّب تسألني عن: يومك، جاهزيتك للتمرين، وزنك وهدفك، أدويتك، الماء، الأكل المسجّل، النوم، أو ملخص الأسبوع.", chips: STARTERS };
}

