"use client";
import { Zap } from "lucide-react";
import { useData } from "@/components/providers/data-provider";
import { today, uid } from "@/lib/dates";
import { cn } from "@/lib/utils";

const FACES = [
  { v: 1, e: "😫", l: "مرهق" },
  { v: 2, e: "😕", l: "ضعيف" },
  { v: 3, e: "😐", l: "عادي" },
  { v: 4, e: "🙂", l: "نشيط" },
  { v: 5, e: "🔥", l: "ممتاز" },
];

/** تسجيل مستوى الطاقة اليومي بضغطة واحدة — يغذّي الجاهزية وتحليلات الارتباط. */
export function EnergyCheckin({ compact }: { compact?: boolean }) {
  const { db, save } = useData();
  const d = today();
  const chk = db.checkins.find((c) => c.date === d);
  const set = (energy: number) => save("checkins", { id: chk?.id ?? uid(), date: d, screen_minutes: chk?.screen_minutes ?? null, energy, notes: chk?.notes ?? "" });
  return (
    <div className="flex flex-wrap items-center gap-3" id="energy">
      {!compact && <div className="flex items-center gap-1.5 text-sm font-medium"><Zap className="size-4 text-warning" /> طاقتك الآن؟</div>}
      <div className="flex gap-1.5" role="radiogroup" aria-label="مستوى الطاقة">
        {FACES.map((f) => (
          <button key={f.v} type="button" role="radio" aria-checked={chk?.energy === f.v} title={f.l} onClick={() => set(f.v)}
            className={cn("flex size-10 items-center justify-center rounded-full border text-xl transition-all active:scale-90",
              chk?.energy === f.v ? "border-primary bg-primary/15 scale-110" : "bg-muted/50 opacity-70 hover:opacity-100")}>
            {f.e}
          </button>
        ))}
      </div>
      {chk?.energy != null && <span className="text-xs text-muted-foreground">سُجّل: {FACES[chk.energy - 1].l}</span>}
    </div>
  );
}
