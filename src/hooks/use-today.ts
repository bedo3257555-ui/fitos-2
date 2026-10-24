"use client";
import * as React from "react";
import { today } from "@/lib/dates";

/** Re-evaluates the current date/minute so "now"-dependent UI stays fresh. */
export function useNow(intervalMs = 60_000) {
  const [, setT] = React.useState(0);
  React.useEffect(() => {
    const id = window.setInterval(() => setT((x) => x + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return today();
}
