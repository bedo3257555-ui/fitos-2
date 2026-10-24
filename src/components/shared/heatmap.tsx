"use client";
import * as React from "react";
import { addDays, diffDays, fmt, today as todayStr, weekStart } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** GitHub-style heatmap. values: map of date -> 0..1 (or undefined for no data). Columns are weeks (Sat→Fri). */
export function Heatmap({ weeks = 12, values, color = "var(--primary)", onSelect, selected }: {
  weeks?: number; values: Record<string, number | null | undefined>; color?: string; onSelect?: (d: string) => void; selected?: string;
}) {
  const end = todayStr();
  const start = addDays(weekStart(end), -7 * (weeks - 1));
  const cols = Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
  const dayNames = ["س", "ح", "ن", "ث", "ر", "خ", "ج"];
  return (
    <div className="flex gap-2" dir="ltr">
      <div className="flex flex-col justify-between py-0.5 text-[10px] text-muted-foreground">
        {dayNames.map((n, i) => <span key={i} className="flex h-[14px] items-center sm:h-4">{i % 2 === 0 ? n : ""}</span>)}
      </div>
      <div className="flex flex-1 justify-between gap-[3px] overflow-x-auto">
        {cols.map((col, ci) => (
          <div key={ci} className="flex flex-1 flex-col gap-[3px]">
            {col.map((d) => {
              const future = diffDays(d, end) > 0;
              const v = values[d];
              const has = v != null && !future;
              return (
                <button
                  key={d} type="button" disabled={future} onClick={() => onSelect?.(d)} title={`${fmt(d, "EEE d MMM")}${has ? ` — ${Math.round((v as number) * 100)}%` : " — لا بيانات"}`}
                  className={cn("aspect-square w-full min-w-[12px] rounded-[4px] transition-transform hover:scale-125 sm:rounded-md", future && "opacity-0", selected === d && "ring-2 ring-foreground")}
                  style={{ background: has ? `hsl(${color} / ${0.15 + (v as number) * 0.85})` : "hsl(var(--muted))" }}
                  aria-label={d}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
