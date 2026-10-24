import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ChartCard({ title, description, right, children, className, height = 240 }: {
  title: string; description?: string; right?: React.ReactNode; children: React.ReactNode; className?: string; height?: number;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <div><CardTitle>{title}</CardTitle>{description && <CardDescription>{description}</CardDescription>}</div>
        {right}
      </CardHeader>
      <CardContent><div style={{ height }} dir="ltr" className={cn("w-full")}>{children}</div></CardContent>
    </Card>
  );
}

interface TipProps { active?: boolean; payload?: { name?: string; value?: number | string; color?: string; dataKey?: string; payload?: Record<string, unknown> }[]; label?: string | number; unit?: string; labels?: Record<string, string>; digits?: number }
export function ChartTip({ active, payload, label, unit = "", labels = {}, digits = 1 }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl px-3 py-2 text-xs shadow-xl" dir="rtl">
      <div className="mb-1 font-semibold">{label}</div>
      {payload.filter((p) => p.value != null).map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{labels[String(p.dataKey)] ?? p.name}</span>
          <span className="num ms-auto font-semibold">{typeof p.value === "number" ? Number(p.value.toFixed(digits)) : p.value}{unit}</span>
        </div>
      ))}
    </div>
  );
}
