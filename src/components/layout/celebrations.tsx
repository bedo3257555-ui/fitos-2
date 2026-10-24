"use client";
import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useData } from "@/components/providers/data-provider";
import { MEAL_ORDER } from "@/lib/constants";
import { slotsOn, waterOn } from "@/lib/analytics";
import { progression } from "@/lib/intel";
import { today } from "@/lib/dates";

interface Toast { id: number; emoji: string; title: string; text: string }
const KEY = "fitos:cele:";
const read = (k: string) => { try { return localStorage.getItem(KEY + k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(KEY + k, v); } catch { /* storage unavailable */ } };

/** احتفالات صغيرة عند إنجاز هدف لأول مرة اليوم: ماء، جرعات، وجبات، تمرين، مستوى جديد، وسام جديد. */
export function Celebrations() {
  const { db, ready } = useData();
  const reduce = useReducedMotion();
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const idRef = React.useRef(1);
  const first = React.useRef(true);

  const push = React.useCallback((t: Omit<Toast, "id">) => {
    const id = idRef.current++;
    setToasts((x) => [...x.slice(-2), { ...t, id }]);
    window.setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 5000);
    try { navigator.vibrate?.(30); } catch { /* unsupported */ }
  }, []);

  React.useEffect(() => {
    if (!ready || !db.profile) return;
    const h = window.setTimeout(() => {
      const g = db.profile!.goals;
      const d = today();
      const slots = slotsOn(db, d);
      const goals: Record<string, { ok: boolean; emoji: string; title: string; text: string }> = {
        water: { ok: waterOn(db, d) >= g.water_ml, emoji: "💧", title: "هدف الماء اتحقق!", text: `${g.water_ml} مل — جسمك بيشكرك.` },
        meds: { ok: slots.length > 0 && slots.every((s) => s.state === "taken" || s.state === "skipped"), emoji: "🛡️", title: "كل جرعات اليوم تمام", text: "التزام كامل النهارده." },
        meals: { ok: MEAL_ORDER.every((m) => db.meal_logs.some((l) => l.date === d && l.meal === m)), emoji: "🍽️", title: "سجّلت كل وجباتك", text: "ده بيخلّي التحليل دقيق." },
        workout: { ok: db.sessions.some((s) => s.date === d && s.kind !== "cardio" && s.status === "completed"), emoji: "💪", title: "خلّصت جلسة اليوم!", text: "شغل ممتاز — ارتاح وغذّي جسمك." },
      };
      const p = progression(db, d);
      const lvlKey = "level", badgeKey = "badges";
      const prevLvl = read(lvlKey), prevBadges = read(badgeKey);
      const earned = p.badges.filter((b) => b.earned).map((b) => b.id);

      if (first.current) {
        // أول تحميل: سجّل الحالة الحالية بصمت حتى لا نحتفل بما تحقق سابقًا
        Object.entries(goals).forEach(([k, v]) => { if (v.ok) write(`${d}:${k}`, "1"); });
        write(lvlKey, String(p.level)); write(badgeKey, JSON.stringify(earned));
        first.current = false;
        return;
      }
      Object.entries(goals).forEach(([k, v]) => {
        if (v.ok && read(`${d}:${k}`) !== "1") { write(`${d}:${k}`, "1"); push({ emoji: v.emoji, title: v.title, text: v.text }); }
      });
      if (prevLvl && p.level > Number(prevLvl)) push({ emoji: "🚀", title: `مستوى جديد: ${p.level} — ${p.title}`, text: `${p.xp} نقطة. كمّل!` });
      write(lvlKey, String(p.level));
      let old: string[] = [];
      try { old = prevBadges ? (JSON.parse(prevBadges) as string[]) : []; } catch { old = []; }
      p.badges.filter((b) => b.earned && !old.includes(b.id)).forEach((b) => push({ emoji: b.icon, title: `وسام جديد: ${b.title}`, text: b.desc }));
      write(badgeKey, JSON.stringify(earned));
    }, 500);
    return () => window.clearTimeout(h);
  }, [db, ready, push]);

  return (
    <div className="no-print pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} layout initial={{ opacity: 0, y: 24, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }}
            className="card-surface pointer-events-auto relative flex w-full max-w-sm items-center gap-3 overflow-hidden px-4 py-3 shadow-xl">
            {!reduce && Array.from({ length: 14 }).map((_, i) => (
              <motion.span key={i} className="absolute top-1/2 size-1.5 rounded-full" style={{ insetInlineStart: "2.2rem", background: ["#f59e0b", "#22c55e", "#3b82f6", "#a78bfa", "#ef4444"][i % 5] }}
                initial={{ x: 0, y: 0, opacity: 1 }} animate={{ x: Math.cos((i / 14) * Math.PI * 2) * 54, y: Math.sin((i / 14) * Math.PI * 2) * 40, opacity: 0 }} transition={{ duration: 0.9, ease: "easeOut" }} />
            ))}
            <span className="text-3xl">{t.emoji}</span>
            <div className="min-w-0"><div className="text-sm font-bold">{t.title}</div><div className="text-xs text-muted-foreground">{t.text}</div></div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
