import { Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function Field({ label, children, className, hint }: { label: string; children: React.ReactNode; className?: string; hint?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <Label>{label}</Label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
