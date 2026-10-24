"use client";
import * as React from "react";
import { Bar, CartesianGrid, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BedDouble, Clock, Monitor, Moon, Save, Star, Trash2, Waves } from "lucide-react";
import { useData } from "@/components/providers/data-provider";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { ChartCard, ChartTip } from "@/components/shared/chart-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Field } from "@/components/shared/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { avg, clamp, round, sleepCorrelations, sleepMinutes, sleepScore } from "@/lib/analytics";
import { DIET_RULES } from "@/lib/constants";
import { addDays, fmt, minToTime, rangeDays, time12, timeToMin, today, uid } from "@/lib/dates";
import { cn } from "@/lib/utils";

const adjBed = (t: string) => { const m = timeToMin(t); return m < 720 ? m + 1440 : m; };
const scoreColor = (s: number) => (s >= 80 ? "hsl(var(--success))" : s >= 60 ? "hsl(var(--warning))" : "hsl(var(--danger))");

function Stars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="جودة النوم" dir="ltr">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={`${i} من 5`} onClick={() => onChange(i)} className="rounded p-0.5 transition active:scale-90">
          <Star className={cn("size-7 transition-colors", i <= value ? "fill-warning text-warning" : "text-muted-foreground/40")} />
        </button>
      ))}
    </div>
  );
}

function interpret(label: string, r: number | null, n: number): { text: string; tone: "muted" | "success" | "warning" | "default" } {
  if (r == null || n < 4) return { text: "بيانات غير كافية — تحتاج 4 أسابيع على الأقل بها 3 ليالٍ مسجّلة أسبوعيًا.", tone: "muted" };
  const a = Math.abs(r);
  const strength = a < 0.2 ? "لا يوجد ارتباط واضح" : a < 0.5 ? "ارتباط ضعيف" : a < 0.7 ? "ارتباط متوسط" : "ارتباط قوي";
  if (a < 0.2) return { text: `${strength} بين المتغيرين حتى الآن.`, tone: "muted" };
  const dir = r > 0 ? "يرتفعان معًا" : "أحدهما يرتفع عندما ينخفض الآخر";
  const good = label.includes("RPE") ? r < 0 : r > 0;
  return { text: `${strength}: ${dir}. ${label.includes("RPE") ? (r < 0 ? "النوم الأطول يرافقه إجهاد أقل." : "النوم الأطول لا يرافقه إجهاد أقل.") : ""} (الارتباط لا يعني السببية)`, tone: good ? "success" : "warning" };
}

export default function SleepPage() {
  const { db, profile, save, remove } = useData();
  const g = profile.goals;
  const [date, setDate] = React.useState(today());
  const existing = db.sleep_logs.find((s) => s.date === date);
  const chk = db.checkins.find((c) => c.date === date);

  const [bed, setBed] = React.useState("23:00");
  const [wake, setWake] = React.useState("07:00");
  const [quality, setQuality] = React.useState(4);
  const [notes, setNotes] = React.useState("");
  const [screen, setScreen] = React.useState("");
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    setBed(existing?.bedtime ?? "23:00");
    setWake(existing?.wake_time ?? "07:00");
    setQuality(existing?.quality ?? 4);
    setNotes(existing?.notes ?? "");
    setScreen(chk?.screen_minutes != null ? String(chk.screen_minutes) : "");
    setSaved(false);
  }, [date, existing?.id, chk?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const durMin = sleepMinutes(bed, wake);
  const dur = round(durMin / 60, 1);
  const score = sleepScore({ bedtime: bed, duration_h: dur, quality }, g);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    save("sleep_logs", { id: existing?.id ?? uid(), date, bedtime: bed, wake_time: wake, duration_h: dur, quality, notes: notes.trim() });
    if (screen !== "" || chk) {
      save("checkins", { id: chk?.id ?? uid(), date, screen_minutes: screen === "" ? null : Math.max(0, Math.round(Number(screen))), energy: chk?.energy ?? null, notes: chk?.notes ?? "" });
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const logs = React.useMemo(() => [...db.sleep_logs].sort((a, b) => b.date.localeCompare(a.date)), [db.sleep_logs]);
  const last = logs[0];
  const last7 = db.sleep_logs.filter((s) => s.date >= addDays(today(), -6));
  const prev7 = db.sleep_logs.filter((s) => s.date >= addDays(today(), -13) && s.date < addDays(today(), -6));
  const weekAvg = avg(last7.map((s) => s.duration_h));
  const prevAvg = avg(prev7.map((s) => s.duration_h));
  const bedAdj = last7.map((s) => adjBed(s.bedtime));
  const avgBed = avg(bedAdj);
  const sd = bedAdj.length >= 2 ? Math.sqrt(avg(bedAdj.map((b) => (b - avgBed!) ** 2))!) : null;
  const consistency = sd == null ? null : Math.round(clamp(1 - sd / 120) * 100);

  const chart = rangeDays(today(), 14).map((d) => {
    const l = db.sleep_logs.find((s) => s.date === d);
    return { label: fmt(d, "d/M"), hours: l?.duration_h ?? null, score: l ? sleepScore(l, g) : null, bed: l ? adjBed(l.bedtime) : null };
  });
  const corr = React.useMemo(() => sleepCorrelations(db), [db]);

  const todayShot = db.checkins.find((c) => c.date === today())?.screen_minutes ?? null;
  const screenAvg = avg(db.checkins.filter((c) => c.date >= addDays(today(), -6) && c.screen_minutes != null).map((c) => c.screen_minutes as number));
  const bedTarget = adjBed(g.bedtime_before);

  return (
    <div>
      <PageHeader title="النوم" subtitle="سجّل نومك لتحصل على درجة النوم وعلاقته بتقدّمك" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard index={0} label="درجة آخر نوم" value={last ? String(sleepScore(last, g)) : "—"} unit="/100" icon={<Moon className="size-4" />} color={last ? scoreColor(sleepScore(last, g)) : undefined}
          ring={last ? sleepScore(last, g) / 100 : undefined} hint={last ? fmt(last.date, "EEE d MMM") : "لا سجلات"} />
        <KpiCard index={1} label="متوسط آخر 7 أيام" value={weekAvg != null ? String(round(weekAvg, 1)) : "—"} unit="ساعة" icon={<BedDouble className="size-4" />} color="hsl(var(--violet))"
          delta={weekAvg != null && prevAvg != null ? round(weekAvg - prevAvg, 1) : null} deltaGood="up" deltaSuffix=" س" hint={`الهدف ${g.sleep_hours} ساعات`} spark={chart.map((c) => c.hours)} />
        <KpiCard index={2} label="متوسط وقت النوم" value={avgBed != null ? time12(minToTime(Math.round(avgBed))) : "—"} icon={<Clock className="size-4" />} color="hsl(var(--warning))" hint={`الهدف قبل ${time12(g.bedtime_before)}`} />
        <KpiCard index={3} label="الانتظام" value={consistency != null ? String(consistency) : "—"} unit="%" icon={<Waves className="size-4" />} color="hsl(var(--success))" ring={consistency != null ? consistency / 100 : undefined}
          hint={sd != null ? `انحراف ±${Math.round(sd)} دقيقة` : "تحتاج ليلتين"} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><div><CardTitle>تسجيل النوم</CardTitle><CardDescription>{existing ? "تعديل سجل هذا اليوم" : "سجل جديد"}</CardDescription></div></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-3">
              <Field label="يوم الاستيقاظ"><Input type="date" value={date} max={today()} onChange={(e) => e.target.value && setDate(e.target.value)} required /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="وقت النوم"><Input type="time" value={bed} onChange={(e) => setBed(e.target.value)} required /></Field>
                <Field label="وقت الاستيقاظ"><Input type="time" value={wake} onChange={(e) => setWake(e.target.value)} required /></Field>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                <div><div className="text-xs text-muted-foreground">المدة</div><div className="num text-xl font-bold">{Math.floor(durMin / 60)}<span className="text-xs font-normal text-muted-foreground">س</span> {durMin % 60}<span className="text-xs font-normal text-muted-foreground">د</span></div></div>
                <div className="text-end"><div className="text-xs text-muted-foreground">الدرجة</div><div className="num text-xl font-bold" style={{ color: scoreColor(score) }}>{score}</div></div>
              </div>
              <Field label="جودة النوم"><Stars value={quality} onChange={setQuality} /></Field>
              <Field label="وقت الشاشات (دقيقة)" hint={`الحد المسموح ${g.screen_max_min} دقيقة`}><Input type="number" inputMode="numeric" min={0} max={1440} value={screen} onChange={(e) => setScreen(e.target.value)} placeholder="اختياري" /></Field>
              <Field label="ملاحظات"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="استيقظت أثناء الليل؟ نمت بعد الأكل بساعتين؟" /></Field>
              <Button type="submit"><Save />{saved ? "تم الحفظ ✓" : existing ? "تحديث" : "حفظ"}</Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:col-span-2">
          <ChartCard title="ساعات النوم ودرجته — 14 يومًا" description="الأعمدة: الساعات · الخط: الدرجة" height={250}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart} margin={{ top: 8, right: 0, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval={1} />
                <YAxis yAxisId="h" domain={[0, 12]} tickLine={false} axisLine={false} />
                <YAxis yAxisId="s" orientation="right" domain={[0, 100]} hide />
                <Tooltip cursor={{ fill: "hsl(var(--muted) / .5)" }} content={<ChartTip labels={{ hours: "الساعات", score: "الدرجة" }} />} />
                <ReferenceLine yAxisId="h" y={g.sleep_hours} stroke="hsl(var(--success))" strokeDasharray="5 4" />
                <Bar yAxisId="h" dataKey="hours" fill="hsl(var(--violet))" fillOpacity={0.75} radius={[6, 6, 0, 0]} />
                <Line yAxisId="s" type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="وقت النوم مقابل الهدف" description={`الخط المتقطع = ${time12(g.bedtime_before)} · كلما انخفض الخط فالنوم أبكر`} height={200}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval={1} />
                <YAxis reversed domain={[1260, 1560]} ticks={[1260, 1320, 1380, 1440, 1500, 1560]} tickFormatter={(v: number) => minToTime(v)} tickLine={false} axisLine={false} width={48} />
                <Tooltip content={<ChartTip digits={0} labels={{ bed: "وقت النوم" }} />} formatter={(v: number) => minToTime(v)} />
                <ReferenceLine y={bedTarget} stroke="hsl(var(--success))" strokeDasharray="5 4" />
                <Line type="monotone" dataKey="bed" stroke="hsl(var(--warning))" strokeWidth={2.5} dot={{ r: 4 }} connectNulls isAnimationActive />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><div><CardTitle>النوم وعلاقته بالتقدّم</CardTitle><CardDescription>ارتباط بيرسون على المتوسطات الأسبوعية (آخر 12 أسبوعًا)</CardDescription></div></CardHeader>
          <CardContent className="space-y-3">
            {corr.map((c) => {
              const it = interpret(c.label, c.r, c.n);
              return (
                <div key={c.label} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{c.label}</span>
                    {c.r == null ? <Badge variant="muted">بيانات غير كافية</Badge> : <Badge variant={it.tone}><span className="num">r = {round(c.r, 2)}</span> · n={c.n}</Badge>}
                  </div>
                  {c.r != null && <div className="relative mt-2 h-1.5 rounded-full bg-muted" dir="ltr"><div className="absolute inset-y-0 left-1/2 w-px bg-foreground/30" /><div className="absolute inset-y-0 rounded-full" style={{ background: c.r >= 0 ? "hsl(var(--primary))" : "hsl(var(--danger))", left: c.r >= 0 ? "50%" : `${50 + c.r * 50}%`, width: `${Math.abs(c.r) * 50}%` }} /></div>}
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{it.text}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><div><CardTitle>قواعد النظام الخاصة بالنوم</CardTitle><CardDescription>من خطة د. أحمد عبد العزيز</CardDescription></div></CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-1.5 text-sm">
                {DIET_RULES.filter((r) => /النوم|الشاشات|ماء/.test(r) && !/ماء/.test(r)).map((r) => <li key={r} className="flex gap-2"><Moon className="mt-0.5 size-4 shrink-0 text-violet" />{r}</li>)}
              </ul>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="mb-1.5 flex items-center justify-between text-xs"><span className="flex items-center gap-1.5 text-muted-foreground"><Monitor className="size-3.5" />الشاشات اليوم</span>
                  <span className="num font-semibold">{todayShot ?? "—"} / {g.screen_max_min} د</span></div>
                <Progress value={todayShot != null ? (todayShot / g.screen_max_min) * 100 : 0} over={todayShot != null && todayShot > g.screen_max_min} color={todayShot != null && todayShot > g.screen_max_min ? "hsl(var(--danger))" : undefined} />
                {screenAvg != null && <div className="mt-1.5 text-[11px] text-muted-foreground">متوسط 7 أيام: <span className="num">{Math.round(screenAvg)}</span> دقيقة</div>}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><div><CardTitle>السجل</CardTitle><CardDescription>آخر الليالي المسجّلة</CardDescription></div></CardHeader>
            <CardContent>
              {logs.length === 0 ? <EmptyState icon={<Moon className="size-5" />} title="لا توجد سجلات نوم" hint="سجّل أول ليلة من النموذج." /> : (
                <ul className="max-h-72 space-y-1.5 overflow-y-auto">
                  {logs.slice(0, 30).map((l) => {
                    const s = sleepScore(l, g);
                    return (
                      <li key={l.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
                        <button className="min-w-0 flex-1 text-start" onClick={() => setDate(l.date)}>
                          <div className="font-medium">{fmt(l.date, "EEE d MMM")}</div>
                          <div className="num text-xs text-muted-foreground">{time12(l.bedtime)} → {time12(l.wake_time)} · {l.duration_h} س</div>
                        </button>
                        <span className="num font-bold" style={{ color: scoreColor(s) }}>{s}</span>
                        <button onClick={() => remove("sleep_logs", l.id)} aria-label="حذف" className="rounded p-1 text-muted-foreground hover:bg-danger/15 hover:text-danger"><Trash2 className="size-3.5" /></button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
