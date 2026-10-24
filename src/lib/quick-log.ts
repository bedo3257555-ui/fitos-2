/** محلّل أوامر التسجيل السريع بالعربية (يُستخدم في لوحة الأوامر Ctrl+K). */
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export const normalize = (s: string) => s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).replace(/٫/g, ".").trim();

/** يفهم أوامر قصيرة مثل: «شربت 500» · «كوبين ماء» · «وزني 77.2» · «طاقتي 4». */
export function parseQuick(raw: string): { kind: "water"; ml: number } | { kind: "weight"; kg: number } | { kind: "energy"; level: number } | null {
  const s = normalize(raw);
  const num = s.match(/(\d+(?:\.\d+)?)/)?.[1];
  if (/(وزني|وزن)/.test(s) && num) { const kg = Number(num); return kg >= 30 && kg <= 250 ? { kind: "weight", kg } : null; }
  if (/(طاقتي|طاقة)/.test(s) && num) { const l = Math.round(Number(num)); return l >= 1 && l <= 5 ? { kind: "energy", level: l } : null; }
  if (/(شربت|ماء|مية|مياه|كوب|كوباية|لتر|ml|مل)/.test(s)) {
    if (/كوبين|كوبايتين/.test(s)) return { kind: "water", ml: 500 };
    if (num) {
      const n = Number(num);
      if (/لتر/.test(s)) return { kind: "water", ml: Math.round(n * 1000) };
      if (/(كوب|كوباية|أكواب)/.test(s)) return { kind: "water", ml: Math.round(n * 250) };
      return n >= 50 && n <= 3000 ? { kind: "water", ml: Math.round(n) } : null;
    }
    if (/(كوب|كوباية)/.test(s)) return { kind: "water", ml: 250 };
  }
  return null;
}

