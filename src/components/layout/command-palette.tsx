"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "next-themes";
import { Bot, CornerDownLeft, Droplets, Moon, Scale, Search, Sparkles, Zap } from "lucide-react";
import { useData } from "@/components/providers/data-provider";
import { NAV } from "@/lib/constants";
import { today, uid } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { normalize, parseQuick } from "@/lib/quick-log";

interface Cmd { id: string; label: string; hint?: string; icon: React.ReactNode; run: () => void; keywords?: string }

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { save, db } = useData();
  const { resolvedTheme, setTheme } = useTheme();
  const [q, setQ] = React.useState("");
  const [sel, setSel] = React.useState(0);
  const [toast, setToast] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => { if (open) { setQ(""); setSel(0); setTimeout(() => inputRef.current?.focus(), 30); } }, [open]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 1800); };
  const addWater = (ml: number) => { save("water_logs", { id: uid(), date: today(), amount_ml: ml, logged_at: new Date().toISOString() }); flash(`💧 +${ml} مل`); };
  const setEnergy = (e: number) => {
    const d = today(); const chk = db.checkins.find((c) => c.date === d);
    save("checkins", { id: chk?.id ?? uid(), date: d, screen_minutes: chk?.screen_minutes ?? null, energy: e, notes: chk?.notes ?? "" }); flash(`⚡ طاقة ${e}/5`);
  };
  const addWeight = (kg: number) => {
    const d = today(); const ex = db.measurements.find((m) => m.date === d && m.source === "manual");
    save("measurements", ex ? { ...ex, weight_kg: kg } : { id: uid(), date: d, source: "manual", weight_kg: kg, waist_cm: null, chest_cm: null, arm_cm: null, thigh_cm: null, body_fat_pct: null, muscle_mass_kg: null, fat_mass_kg: null, bmi: null, bmr: null, visceral_fat: null, body_water_l: null, inbody_score: null, notes: "" });
    flash(`⚖️ ${kg} كجم`);
  };

  const cmds = React.useMemo<Cmd[]>(() => {
    const quick = parseQuick(q);
    const list: Cmd[] = [];
    if (quick?.kind === "water") list.push({ id: "q-water", label: `سجّل ${quick.ml} مل ماء`, hint: "أمر سريع", icon: <Droplets className="size-4 text-primary" />, run: () => addWater(quick.ml) });
    if (quick?.kind === "weight") list.push({ id: "q-weight", label: `سجّل وزن اليوم ${quick.kg} كجم`, hint: "أمر سريع", icon: <Scale className="size-4 text-primary" />, run: () => addWeight(quick.kg) });
    if (quick?.kind === "energy") list.push({ id: "q-energy", label: `سجّل طاقتك ${quick.level}/5`, hint: "أمر سريع", icon: <Zap className="size-4 text-warning" />, run: () => setEnergy(quick.level) });
    const looksLikeQuestion = !quick && normalize(q).length >= 3;
    if (looksLikeQuestion) list.push({ id: "q-ask", label: `اسأل المدرب: «${q.trim()}»`, hint: "ذكاء", icon: <Bot className="size-4 text-violet" />, run: () => { router.push(`/coach?ask=${encodeURIComponent(q.trim())}`); onClose(); } });
    list.push(
      { id: "a-ask", label: "اسأل المدرب الذكي", icon: <Bot className="size-4 text-violet" />, run: () => { router.push("/coach"); onClose(); }, keywords: "مدرب شات سؤال coach chat" },
      { id: "a-w250", label: "+250 مل ماء", icon: <Droplets className="size-4 text-primary" />, run: () => addWater(250), keywords: "ماء مياه كوب water" },
      { id: "a-w500", label: "+500 مل ماء", icon: <Droplets className="size-4 text-primary" />, run: () => addWater(500), keywords: "ماء مياه زجاجة water" },
      ...[1, 2, 3, 4, 5].map((n) => ({ id: `a-e${n}`, label: `طاقتي اليوم ${n}/5`, icon: <Zap className="size-4 text-warning" />, run: () => setEnergy(n), keywords: "طاقة energy" })),
      { id: "a-theme", label: resolvedTheme === "dark" ? "الوضع الفاتح" : "الوضع الداكن", icon: <Moon className="size-4" />, run: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"), keywords: "theme مظهر" },
    );
    NAV.forEach((n) => list.push({ id: `n-${n.href}`, label: n.label, hint: "انتقال", icon: <Sparkles className="size-4 text-muted-foreground" />, run: () => { router.push(n.href); onClose(); }, keywords: n.href }));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, resolvedTheme, db.checkins, db.measurements]);

  const filtered = React.useMemo(() => {
    const s = normalize(q).toLowerCase();
    const out = !s ? cmds.filter((c) => !c.id.startsWith("a-e") && c.id !== "q-ask") : cmds.filter((c) => c.id.startsWith("q-") || `${c.label} ${c.keywords ?? ""}`.toLowerCase().includes(s));
    return [...out.filter((c) => c.id !== "q-ask"), ...out.filter((c) => c.id === "q-ask")];
  }, [cmds, q]);
  React.useEffect(() => setSel(0), [q]);

  const exec = (c?: Cmd) => { if (!c) return; c.run(); if (c.id.startsWith("q-") || c.id.startsWith("a-")) { setQ(""); } };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((i) => Math.min(filtered.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); exec(filtered[sel]); }
    else if (e.key === "Escape") onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="no-print fixed inset-0 z-[60] flex items-start justify-center bg-black/60 p-4 pt-[12vh] backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div role="dialog" aria-label="بحث وأوامر سريعة" className="card-surface w-full max-w-lg overflow-hidden shadow-2xl" initial={{ scale: 0.96, y: -8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b px-4">
              <Search className="size-4 text-muted-foreground" />
              <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="اكتب أمرًا… مثال: شربت 500 · وزني 77.2 · طاقتي 4"
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
              <kbd className="num rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">Esc</kbd>
            </div>
            <ul className="max-h-[52vh] overflow-y-auto p-2">
              {filtered.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">لا نتائج</li>}
              {filtered.map((c, i) => (
                <li key={c.id}>
                  <button type="button" onMouseEnter={() => setSel(i)} onClick={() => exec(c)}
                    className={cn("flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-start text-sm", i === sel ? "bg-primary/12 text-foreground" : "text-muted-foreground")}>
                    {c.icon}<span className="flex-1">{c.label}</span>
                    {c.hint && <span className="text-[10px] opacity-70">{c.hint}</span>}
                    {i === sel && <CornerDownLeft className="size-3.5 opacity-60" />}
                  </button>
                </li>
              ))}
            </ul>
            {toast && <div className="border-t bg-success/10 px-4 py-2 text-center text-xs text-success">{toast}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
