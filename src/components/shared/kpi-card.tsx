"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkline } from "./sparkline";
import { TrendBadge } from "./trend-badge";
import { Ring } from "./ring";
import { cn } from "@/lib/utils";

export interface KpiProps {
  label: string;
  value: string;
  unit?: string;
  icon?: React.ReactNode;
  color?: string;
  delta?: number | null;
  deltaGood?: "up" | "down" | "neutral";
  deltaSuffix?: string;
  deltaDigits?: number;
  spark?: (number | null)[];
  ring?: number; // 0..1
  hint?: string;
  href?: string;
  index?: number;
}

export function KpiCard({ label, value, unit, icon, color = "hsl(var(--primary))", delta, deltaGood, deltaSuffix, deltaDigits, spark, ring, hint, href, index = 0 }: KpiProps) {
  const body = (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04, duration: 0.35 }}
      whileHover={{ y: -2 }}
      className={cn("card-surface group relative h-full overflow-hidden p-4 transition-colors", href && "hover:border-primary/40")}
    >
      <div className="pointer-events-none absolute -top-10 -end-10 size-28 rounded-full opacity-[0.12] blur-2xl" style={{ background: color }} />
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          {icon && <span className="flex size-7 items-center justify-center rounded-lg" style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}>{icon}</span>}
          {label}
        </div>
        {delta !== undefined && <TrendBadge delta={delta} good={deltaGood} suffix={deltaSuffix} digits={deltaDigits} />}
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <div className="flex items-baseline gap-1">
            <span className="num text-3xl font-bold tracking-tight">{value}</span>
            {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
          </div>
          {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
        </div>
        {ring != null ? (
          <Ring value={ring} size={44} stroke={5} color={color}><span className="num text-[10px] font-semibold">{Math.round(ring * 100)}</span></Ring>
        ) : spark ? <Sparkline data={spark} color={color} /> : null}
      </div>
    </motion.div>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}
