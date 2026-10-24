"use client";
import * as React from "react";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { useData } from "@/components/providers/data-provider";
import { weeklyChallenge } from "@/lib/intel";
import { today } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** تحدّي الأسبوع: يُولَّد من أضعف مجال لديك ويتحدّث لحظيًا من سجلّاتك. */
export function ChallengeCard({ className }: { className?: string }) {
  const { db } = useData();
  const c = React.useMemo(() => weeklyChallenge(db, today()), [db]);
  if (!c) return null;
  const pct = Math.min(100, (c.progress / c.target) * 100);
  const needed = c.target - c.progress;
  const hard = !c.done && needed > c.daysLeft + 1;
  return (
    <div className={cn("rounded-xl border p-4", c.done ? "border-success/40 bg-success/10" : "bg-muted/30", className)}>
      <div className="flex items-start gap-3">
        <motion.span className="text-3xl" animate={c.done ? { rotate: [0, -12, 12, 0] } : undefined} transition={{ duration: 0.8 }}>{c.done ? "🏅" : c.icon}</motion.span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-bold">تحدّي الأسبوع: {c.title}</div>
            <span className="num shrink-0 text-xs text-muted-foreground">{c.progress}/{c.target} {c.unit}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{c.desc}</p>
          <Progress value={pct} color={c.done ? "hsl(var(--success))" : undefined} className="mt-2 h-2" />
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {c.done ? "أنجزت التحدي! كمّل على نفس المستوى 🎉" : hard ? `الأسبوع قارب على الانتهاء — اعتبره تدريبًا للأسبوع الجاي (باقي ${c.daysLeft} أيام).` : `باقي ${needed} ${c.unit} وفاضل ${c.daysLeft + 1} أيام (تشمل اليوم).`}
          </p>
        </div>
      </div>
    </div>
  );
}
