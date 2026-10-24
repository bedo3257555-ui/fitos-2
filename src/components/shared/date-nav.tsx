"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addDays, fmtLong, today } from "@/lib/dates";

export function DateNav({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  const isToday = date === today();
  return (
    <div className="flex items-center gap-1">
      <Button variant="secondary" size="icon-sm" onClick={() => onChange(addDays(date, -1))} aria-label="اليوم السابق"><ChevronRight className="size-4" /></Button>
      <button onClick={() => onChange(today())} className="min-w-44 rounded-md px-3 py-1 text-center text-sm font-medium hover:bg-muted">
        {isToday ? "اليوم — " : ""}{fmtLong(date)}
      </button>
      <Button variant="secondary" size="icon-sm" onClick={() => onChange(addDays(date, 1))} disabled={date >= today()} aria-label="اليوم التالي"><ChevronLeft className="size-4" /></Button>
    </div>
  );
}
