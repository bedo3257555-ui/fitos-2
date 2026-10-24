"use client";
import * as React from "react";
import { useData } from "@/components/providers/data-provider";
import { checkReminders } from "@/lib/reminders";

export function useReminders() {
  const { db, ready } = useData();
  const ref = React.useRef(db);
  ref.current = db;
  React.useEffect(() => {
    if (!ready) return;
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const id = window.setInterval(() => checkReminders(ref.current), 30_000);
    checkReminders(ref.current);
    return () => window.clearInterval(id);
  }, [ready]);
}
