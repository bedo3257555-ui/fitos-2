import * as React from "react";
import { cn } from "@/lib/utils";

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...p }, ref) => (
  <div ref={ref} className={cn("card-surface", className)} {...p} />
));
Card.displayName = "Card";
export const CardHeader = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex items-start justify-between gap-3 p-5 pb-2", className)} {...p} />
);
export const CardTitle = ({ className, ...p }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn("text-sm font-semibold tracking-tight", className)} {...p} />
);
export const CardDescription = ({ className, ...p }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("text-xs text-muted-foreground mt-0.5", className)} {...p} />
);
export const CardContent = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("p-5 pt-2", className)} {...p} />;
