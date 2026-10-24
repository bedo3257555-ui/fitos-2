"use client";
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Droplets, Flame, Plus, TrendingUp, Trash2, Undo2 } from "lucide-react";
import { useData } from "@/components/providers/data-provider";
import { PageHeader } from "@/components/shared/page-header";
import { DateNav } from "@/components/shared/date-nav";
import { Ring } from "@/components/shared/ring";
import { KpiCard } from "@/components/shared/kpi-card";
import { ChartCard, ChartTip } from "@/components/shared/chart-card";
import { Heatmap } from "@/components/shared/heatmap";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { avg, waterOn, waterStreak } from "@/lib/analytics";
import { fmt, rangeDays, today, uid } from "@/lib/dates";
import { cn } from "@/lib/utils";

const DOSE = 250;

export default function WaterPage() {
  const { db, profile, save, remove } = useData();
  const goal = profile.goals.water_ml;
  const [date, setDate] = React.useState(today());
  const [custom, setCustom] = React.useState("");

  const logs = React.useMemo(
    () => db.water_logs.filter((w) => w.date === date).sort((a, b) => a.logged_at.localeCompare(b.logged_at)),
    [db.water_logs, date]
  );
  const total = logs.reduce((s, w) => s + w.amount_ml, 0);
  const ratio = goal ? total / goal : 0;
  const doses = Math.round(goal / DOSE); // 8
  const filledDoses = Math.min(doses, Math.floor(total / DOSE));

  const stamp = () => {
    const now = new Date();
    return date === today() ? now.toISOString() : `${date}T12:00:00`;
  };
  const add = (ml: number) => save("water_logs", { id: uid(), date, amount_ml: ml, logged_at: stamp() });
  const undo = () => { const last = logs[logs.length - 1]; if (last) remove("water_logs", last.id); };
  const toggleDose = (i: number) => {
    if (i < filledDoses) undo();
    else add(DOSE);
  };

  const streak = waterStreak(db, goal, today());
  const days7 = rangeDays(today(), 7);
  const hasLog = (d: string) => db.water_logs.some((w) => w.date === d);
  const logged7 = days7.filter(hasLog);
  const weekAvg = avg(logged7.map((d) => waterOn(db, d)));
  const prevAvg = avg(rangeDays(days7[0], 8).slice(0, 7).filter(hasLog).map((d) => waterOn(db, d)));

  const chart = rangeDays(today(), 14).map((d) => ({ date: d, label: fmt(d, "d/M"), ml: waterOn(db, d) }));
  const heat = React.useMemo(() => {
    const out: Record<string, number | null> = {};
    const first = db.water_logs.map((w) => w.date).sort()[0];
    rangeDays(today(), 84).forEach((d) => { out[d] = hasLog(d) ? Math.min(1, waterOn(db, d) / goal) : first && d > first ? 0 : null; });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db.water_logs, goal]);

  const hourly = React.useMemo(() => {
    const h = Array.from({ length: 24 }, (_, i) => ({ hour: i, label: `${i}`, ml: 0 }));
    db.water_logs.filter((w) => w.date >= rangeDays(today(), 14)[0]).forEach((w) => { const hr = new Date(w.logged_at).getHours(); if (!Number.isNaN(hr)) h[hr].ml += w.amount_ml; });
    return h.slice(6, 24);
  }, [db.water_logs]);

  const submitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const v = Number(custom);
    if (v > 0 && v <= 3000) { add(Math.round(v)); setCustom(""); }
  };

  return (
    <div>
      <PageHeader title="متابعة الماء" subtitle={`الهدف اليومي ${goal / 1000} لتر موزعة على ${doses} مرات`} actions={<DateNav date={date} onChange={setDate} />} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="hero-glow lg:col-span-2">
          <CardContent className="flex flex-col items-center gap-6 p-6 pt-6 sm:flex-row sm:items-center sm:justify-around">
            <Ring value={ratio} size={200} stroke={16} color={ratio >= 1 ? "hsl(var(--success))" : "hsl(var(--primary))"}>
              <Droplets className="mb-1 size-6 text-primary" />
              <span className="num text-4xl font-bold">{total}</span>
              <span className="text-xs text-muted-foreground">من <span className="num">{goal}</span> مل</span>
              <span className="num mt-1 text-sm font-semibold text-primary">{Math.round(ratio * 100)}%</span>
            </Ring>

            <div className="w-full max-w-sm space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>الجرعات ({DOSE} مل)</span><span className="num">{filledDoses}/{doses}</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: doses }, (_, i) => {
                    const on = i < filledDoses;
                    return (
                      <motion.button key={i} whileTap={{ scale: 0.88 }} onClick={() => toggleDose(i)} aria-pressed={on} aria-label={`جرعة ${i + 1}`}
                        className={cn("flex h-14 flex-col items-center justify-center rounded-lg border text-xs font-semibold transition-colors",
                          on ? "border-primary bg-primary text-primary-foreground shadow-[0_6px_18px_-8px_hsl(var(--primary))]" : "bg-muted/50 text-muted-foreground hover:border-primary/50")}>
                        <Droplets className="size-4" /><span className="num">{i + 1}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
              <form onSubmit={submitCustom} className="flex gap-2">
                <Input type="number" inputMode="numeric" min={50} max={3000} step={50} placeholder="كمية مخصصة (مل)" value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="كمية مخصصة بالمل" />
                <Button type="submit" variant="secondary" disabled={!custom}><Plus />إضافة</Button>
              </form>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => add(DOSE)}><Plus />+{DOSE} مل</Button>
                <Button variant="outline" onClick={() => add(500)}>+500</Button>
                <Button variant="ghost" onClick={undo} disabled={!logs.length} aria-label="تراجع"><Undo2 />تراجع</Button>
              </div>
              {ratio >= 1 && <p className="rounded-md bg-success/15 p-2 text-center text-xs font-semibold text-success">🎉 حققت هدف اليوم</p>}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
          <KpiCard label="سلسلة الأيام" value={String(streak)} unit="يوم" icon={<Flame className="size-4" />} color="hsl(var(--warning))" hint="أيام متتالية حققت فيها الهدف" />
          <KpiCard label="متوسط آخر 7 أيام" value={weekAvg != null ? String(Math.round(weekAvg)) : "—"} unit="مل" icon={<TrendingUp className="size-4" />}
            delta={weekAvg != null && prevAvg != null ? Math.round(weekAvg - prevAvg) : null} deltaGood="up" deltaDigits={0} deltaSuffix=" مل"
            hint={weekAvg != null ? `${Math.round((weekAvg / goal) * 100)}% من الهدف` : "لا توجد بيانات"} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="آخر 14 يومًا" description="الخط المتقطع هو هدفك اليومي">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} interval={1} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "hsl(var(--muted) / .5)" }} content={<ChartTip unit=" مل" digits={0} labels={{ ml: "الماء" }} />} />
              <ReferenceLine y={goal} stroke="hsl(var(--success))" strokeDasharray="5 4" />
              <Bar dataKey="ml" radius={[6, 6, 0, 0]}>
                {chart.map((c) => <Cell key={c.date} fill={c.ml >= goal ? "hsl(var(--success))" : "hsl(var(--primary))"} fillOpacity={c.ml ? 1 : 0.2} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="توزيع الشرب خلال اليوم" description="إجمالي آخر 14 يومًا لكل ساعة">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourly} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "hsl(var(--muted) / .5)" }} content={<ChartTip unit=" مل" digits={0} labels={{ ml: "الماء" }} />} />
              <Bar dataKey="ml" fill="hsl(var(--violet))" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><div><CardTitle>خريطة الالتزام — 12 أسبوعًا</CardTitle><CardDescription>الأغمق = أقرب لتحقيق الهدف</CardDescription></div></CardHeader>
          <CardContent><Heatmap weeks={12} values={heat} color="var(--primary)" onSelect={setDate} selected={date} /></CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>سجل اليوم</CardTitle><CardDescription>{fmt(date, "EEEE d MMMM")}</CardDescription></div></CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <EmptyState icon={<Droplets className="size-5" />} title="لم تسجّل ماءً بعد" hint="اضغط على إحدى الجرعات أعلاه لتبدأ." />
            ) : (
              <ul className="max-h-72 space-y-1.5 overflow-y-auto">
                <AnimatePresence initial={false}>
                  {[...logs].reverse().map((w) => (
                    <motion.li key={w.id} layout initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0 }}
                      className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
                      <span className="flex items-center gap-2"><Droplets className="size-4 text-primary" /><span className="num font-semibold">{w.amount_ml}</span> مل</span>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="num">{new Date(w.logged_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                        <button onClick={() => remove("water_logs", w.id)} aria-label="حذف" className="rounded p-1 hover:bg-danger/15 hover:text-danger"><Trash2 className="size-3.5" /></button>
                      </span>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
