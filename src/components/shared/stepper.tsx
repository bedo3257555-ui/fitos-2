"use client";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stepper({ value, onChange, step = 1, min = 0, max = 99, format, className, size = "md" }: {
  value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; format?: (v: number) => string; className?: string; size?: "sm" | "md";
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v * 100) / 100)));
  const b = size === "sm" ? "size-7" : "size-9";
  return (
    <div className={cn("inline-flex items-center gap-1 rounded-full bg-muted p-1", className)}>
      <button type="button" onClick={() => set(value - step)} disabled={value <= min} aria-label="إنقاص" className={cn(b, "flex items-center justify-center rounded-full bg-card shadow-sm transition active:scale-90 disabled:opacity-40")}><Minus className="size-4" /></button>
      <span className="num min-w-10 text-center text-sm font-semibold">{format ? format(value) : value}</span>
      <button type="button" onClick={() => set(value + step)} disabled={value >= max} aria-label="زيادة" className={cn(b, "flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition active:scale-90 disabled:opacity-40")}><Plus className="size-4" /></button>
    </div>
  );
}
