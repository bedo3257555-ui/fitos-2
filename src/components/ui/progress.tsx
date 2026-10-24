"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function Progress({ value, className, color, over }: { value: number; className?: string; color?: string; over?: boolean }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div
        className={cn("h-full rounded-full", !color && (over ? "bg-warning" : "bg-primary"))}
        style={color ? { background: color } : undefined}
        initial={{ width: 0 }} animate={{ width: `${v}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }}
      />
    </div>
  );
}
