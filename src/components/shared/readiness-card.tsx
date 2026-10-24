"use client";
import { Ring } from "@/components/shared/ring";
import { Progress } from "@/components/ui/progress";
import type { Readiness } from "@/lib/intel";

const COLOR = { high: "hsl(var(--success))", medium: "hsl(var(--primary))", low: "hsl(var(--warning))", unknown: "hsl(var(--muted-foreground))" } as const;

export function ReadinessBody({ r, size = 112 }: { r: Readiness; size?: number }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <Ring value={(r.score ?? 0) / 100} size={size} stroke={10} color={COLOR[r.level]}>
        <span className="num text-2xl font-bold">{r.score ?? "—"}</span>
        <span className="text-[10px] text-muted-foreground">{r.label}</span>
      </Ring>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm leading-relaxed">{r.advice}</p>
        {r.drivers.map((d) => (
          <div key={d.key} className="space-y-1">
            <div className="flex justify-between text-[11px] text-muted-foreground"><span>{d.label}</span><span className="num">{d.note}</span></div>
            <Progress value={d.value * 100} color={d.value >= 0.75 ? "hsl(var(--success))" : d.value >= 0.55 ? "hsl(var(--primary))" : "hsl(var(--warning))"} className="h-1.5" />
          </div>
        ))}
      </div>
    </div>
  );
}
