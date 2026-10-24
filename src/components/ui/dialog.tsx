"use client";
import * as React from "react";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({ className, children, title, description, ...p }: React.ComponentPropsWithoutRef<typeof D.Content> & { title: string; description?: string }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <D.Content
        className={cn(
          "fixed z-50 grid gap-4 border bg-card p-6 shadow-2xl outline-none duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-2xl data-[state=open]:slide-in-from-bottom-10",
          "sm:inset-auto sm:start-1/2 sm:top-1/2 sm:w-full sm:max-w-lg sm:-translate-y-1/2 sm:rtl:translate-x-1/2 sm:ltr:-translate-x-1/2 sm:rounded-2xl sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:zoom-in-95",
          className
        )}
        {...p}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <D.Title className="text-lg font-semibold">{title}</D.Title>
            {description ? <D.Description className="mt-1 text-sm text-muted-foreground">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
          </div>
          <D.Close className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="إغلاق"><X className="size-4" /></D.Close>
        </div>
        {children}
      </D.Content>
    </D.Portal>
  );
}
