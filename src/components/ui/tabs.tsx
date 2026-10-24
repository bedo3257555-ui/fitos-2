"use client";
import * as React from "react";
import * as T from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = T.Root;
export const TabsList = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof T.List>>(({ className, ...p }, ref) => (
  <T.List ref={ref} className={cn("inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-muted p-1", className)} {...p} />
));
TabsList.displayName = "TabsList";
export const TabsTrigger = React.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<typeof T.Trigger>>(({ className, ...p }, ref) => (
  <T.Trigger ref={ref} className={cn("shrink-0 rounded-full px-4 py-1.5 text-sm font-medium text-muted-foreground transition-all data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow", className)} {...p} />
));
TabsTrigger.displayName = "TabsTrigger";
export const TabsContent = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof T.Content>>(({ className, ...p }, ref) => (
  <T.Content ref={ref} className={cn("mt-5 outline-none data-[state=active]:animate-fade-up", className)} {...p} />
));
TabsContent.displayName = "TabsContent";
