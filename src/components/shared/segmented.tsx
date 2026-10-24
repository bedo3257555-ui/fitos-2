"use client";
import { cn } from "@/lib/utils";

export function Segmented<T extends string | number>({ value, onChange, options, className }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-full bg-muted p-1", className)} role="tablist">
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="tab" aria-selected={o.value === value} onClick={() => onChange(o.value)}
          className={cn("rounded-full px-3 py-1 text-xs font-medium transition-all", o.value === value ? "bg-card text-foreground shadow" : "text-muted-foreground hover:text-foreground")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
