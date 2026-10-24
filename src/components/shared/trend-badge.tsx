import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/** delta in raw units; good: which direction is "good" (green). */
export function TrendBadge({ delta, good = "up", suffix = "", digits = 1, className }: { delta: number | null; good?: "up" | "down" | "neutral"; suffix?: string; digits?: number; className?: string }) {
  if (delta == null || Number.isNaN(delta)) return null;
  const flat = Math.abs(delta) < 10 ** -digits / 2;
  const up = delta > 0;
  const positive = good === "neutral" ? null : good === "up" ? up : !up;
  const tone = flat || positive == null ? "text-muted-foreground bg-muted" : positive ? "text-success bg-success/15" : "text-danger bg-danger/15";
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold", tone, className)}>
      <Icon className="size-3" />
      <span className="num">{Math.abs(delta).toFixed(digits)}{suffix}</span>
    </span>
  );
}
