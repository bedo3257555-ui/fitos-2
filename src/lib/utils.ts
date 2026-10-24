import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export const fmtNum = (v: number | null | undefined, d = 0) =>
  v == null || Number.isNaN(v) ? "—" : v.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: 0 });
