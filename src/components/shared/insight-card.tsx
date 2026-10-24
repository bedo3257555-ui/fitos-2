"use client";
import { motion } from "framer-motion";
import { AlertTriangle, Lightbulb, Sparkles, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Insight } from "@/lib/types";

const KIND = {
  achievement: { icon: Trophy, label: "إنجاز", cls: "text-success bg-success/12 border-success/25" },
  warning: { icon: AlertTriangle, label: "تحذير", cls: "text-danger bg-danger/10 border-danger/25" },
  recommendation: { icon: Lightbulb, label: "توصية", cls: "text-warning bg-warning/10 border-warning/25" },
  insight: { icon: Sparkles, label: "ملاحظة", cls: "text-primary bg-primary/10 border-primary/25" },
} as const;

export function InsightCard({ insight, index = 0, compact }: { insight: Insight; index?: number; compact?: boolean }) {
  const k = KIND[insight.kind];
  const Icon = k.icon;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 8) * 0.04 }}
      className={cn("flex gap-3 rounded-lg border p-3.5", k.cls)}>
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-background/60"><Icon className="size-4" /></div>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{k.label}</div>
        <div className="text-sm font-semibold leading-snug text-foreground">{insight.title}</div>
        {!compact && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{insight.body}</p>}
      </div>
    </motion.div>
  );
}
