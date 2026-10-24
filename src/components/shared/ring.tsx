"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function Ring({ value, size = 120, stroke = 10, color = "hsl(var(--primary))", children, className, track = "hsl(var(--muted))" }: {
  value: number; size?: number; stroke?: number; color?: string; children?: React.ReactNode; className?: string; track?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - v) }}
          transition={{ type: "spring", stiffness: 70, damping: 18 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
