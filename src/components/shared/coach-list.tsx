"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Camera, CheckCircle2, Droplets, Dumbbell, Footprints, Moon, Pill, Scale, Utensils } from "lucide-react";
import { cn } from "@/lib/utils";
import { time12 } from "@/lib/dates";
import type { CoachAction, CoachIcon, CoachTone } from "@/lib/intel";

const ICON: Record<CoachIcon, React.ComponentType<{ className?: string }>> = {
  pill: Pill, utensils: Utensils, droplets: Droplets, dumbbell: Dumbbell, moon: Moon, scale: Scale, camera: Camera, footprints: Footprints,
};
const TONE: Record<CoachTone, { cls: string; label: string }> = {
  urgent: { cls: "border-danger/30 bg-danger/10", label: "عاجل" },
  now: { cls: "border-warning/30 bg-warning/10", label: "الآن" },
  next: { cls: "border-border bg-muted/50", label: "قريبًا" },
};

export function CoachList({ actions, done, limit }: { actions: CoachAction[]; done?: string[]; limit?: number }) {
  const list = limit ? actions.slice(0, limit) : actions;
  return (
    <div className="space-y-2">
      {list.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm text-success"><CheckCircle2 className="size-4" /> مفيش حاجة معلّقة دلوقتي — كمّل يومك بهدوء ✨</div>
      )}
      {list.map((a, i) => {
        const Icon = ICON[a.icon];
        return (
          <motion.div key={a.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
            <Link href={a.href} className={cn("flex items-start gap-3 rounded-lg border p-3 transition-colors hover:brightness-105", TONE[a.tone].cls)}>
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-background/60"><Icon className="size-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-snug">{a.title}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{a.detail}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1 text-[10px] text-muted-foreground">
                <span className="font-semibold">{TONE[a.tone].label}</span>
                {a.time && <span className="num">{time12(a.time)}</span>}
              </span>
            </Link>
          </motion.div>
        );
      })}
      {done && done.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {done.map((d) => <span key={d} className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2.5 py-1 text-[11px] text-success"><CheckCircle2 className="size-3" />{d}</span>)}
        </div>
      )}
    </div>
  );
}
