import * as React from "react";
import { cn } from "@/lib/utils";

const base =
  "flex w-full rounded-md border border-input bg-background/60 px-3 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, type, ...p }, ref) => (
  <input ref={ref} type={type} className={cn(base, "h-10", (type === "number" || type === "time" || type === "date") && "text-left [direction:ltr]", className)} {...p} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn(base, "min-h-[80px] py-2", className)} {...p} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...p }, ref) => (
  <select ref={ref} className={cn(base, "h-10 appearance-none bg-[length:16px] bg-[position:left_.75rem_center] bg-no-repeat pe-3 ps-9", className)}
    style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238b8b96' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...p}>
    {children}
  </select>
));
Select.displayName = "Select";

export const Label = ({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={cn("mb-1.5 block text-xs font-medium text-muted-foreground", className)} {...p} />
);
