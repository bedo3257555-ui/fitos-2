"use client";
import * as React from "react";
import * as S from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export const Switch = React.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<typeof S.Root>>(({ className, ...p }, ref) => (
  <S.Root ref={ref} className={cn("peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-input transition-colors data-[state=checked]:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50", className)} {...p}>
    <S.Thumb className="pointer-events-none block size-5 rounded-full bg-white shadow transition-transform data-[state=checked]:-translate-x-[1.375rem] data-[state=unchecked]:-translate-x-0.5 rtl:data-[state=checked]:-translate-x-[1.375rem] rtl:data-[state=unchecked]:-translate-x-0.5 ltr:data-[state=checked]:translate-x-[1.375rem] ltr:data-[state=unchecked]:translate-x-0.5" />
  </S.Root>
));
Switch.displayName = "Switch";
