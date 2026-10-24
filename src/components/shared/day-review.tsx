"use client";
import * as React from "react";
import { CalendarClock, Check, Moon } from "lucide-react";
import { useData } from "@/components/providers/data-provider";
import { Button } from "@/components/ui/button";
import { Ring } from "@/components/shared/ring";
import { dayReview } from "@/lib/intel";
import { today, uid } from "@/lib/dates";

/** مراجعة نهاية اليوم + معاينة الغد + ملاحظة يومية (تُحفظ في حقل notes الموجود). */
export function DayReviewBody() {
  const { db, save } = useData();
  const d = today();
  const r = React.useMemo(() => dayReview(db, d), [db, d]);
  const chk = db.checkins.find((c) => c.date === d);
  const [note, setNote] = React.useState(chk?.notes ?? "");
  const [saved, setSaved] = React.useState(false);
  React.useEffect(() => { setNote(chk?.notes ?? ""); }, [chk?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!r) return null;
  const submit = () => {
    save("checkins", { id: chk?.id ?? uid(), date: d, screen_minutes: chk?.screen_minutes ?? null, energy: chk?.energy ?? null, notes: note.trim() });
    setSaved(true); setTimeout(() => setSaved(false), 1800);
  };
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Ring value={r.score ?? 0} size={64} stroke={6}><span className="num text-sm font-bold">{r.score == null ? "—" : Math.round(r.score * 100)}</span></Ring>
          <div className="text-xs text-muted-foreground">درجة يومك</div>
        </div>
        {r.wins.map((w) => <div key={w} className="text-xs text-success">✓ {w}</div>)}
        {r.misses.map((w) => <div key={w} className="text-xs text-warning">• {w}</div>)}
        <div className="rounded-lg bg-muted/50 p-3 text-xs leading-relaxed">
          <div className="mb-1 flex items-center gap-1.5 font-semibold"><CalendarClock className="size-3.5" /> بكرة</div>
          <div>🏋️ {r.tomorrow.workout}</div>
          {r.tomorrow.firstDose && <div>💊 أول جرعة: {r.tomorrow.firstDose}</div>}
          <div className="mt-1 text-muted-foreground">💡 {r.tomorrow.tip}</div>
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="day-note" className="flex items-center gap-1.5 text-xs font-semibold"><Moon className="size-3.5" /> كلمة عن يومك (اختياري)</label>
        <textarea id="day-note" value={note} onChange={(e) => setNote(e.target.value)} rows={5} placeholder="إيه اللي ساعدك؟ إيه اللي عطّلك؟ أي إحساس تحب تفتكره…"
          className="w-full resize-none rounded-lg border bg-background p-3 text-sm outline-none focus:border-primary" />
        <Button size="sm" onClick={submit} disabled={note.trim() === (chk?.notes ?? "")}>{saved ? <><Check /> تم الحفظ</> : "حفظ الملاحظة"}</Button>
      </div>
    </div>
  );
}
