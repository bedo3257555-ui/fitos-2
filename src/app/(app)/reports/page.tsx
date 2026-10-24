"use client";
import * as React from "react";
import { addMonths, endOfMonth, startOfMonth } from "date-fns";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { ChevronLeft, ChevronRight, Download, Printer } from "lucide-react";
import { useData } from "@/components/providers/data-provider";
import { PageHeader } from "@/components/shared/page-header";
import { ChartCard, ChartTip } from "@/components/shared/chart-card";
import { TrendBadge } from "@/components/shared/trend-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dayNutrition, medDay, periodReport, round, sleepScore, waterOn, type PeriodReport } from "@/lib/analytics";
import { FOOD_GROUPS, GROUP_ORDER } from "@/lib/constants";
import { addDays, daysBetween, diffDays, fmt, parse, today, toDateStr, weekStart } from "@/lib/dates";
import type { DateStr, FoodGroup } from "@/lib/types";

type Kind = "week" | "month";
interface Period { start: DateStr; end: DateStr; label: string }

function periodFor(kind: Kind, offset: number): Period {
  if (kind === "week") {
    const start = addDays(weekStart(today()), offset * 7);
    const end = addDays(start, 6);
    return { start, end, label: `${fmt(start, "d MMM")} – ${fmt(end, "d MMM yyyy")}` };
  }
  const base = addMonths(startOfMonth(parse(today())), offset);
  return { start: toDateStr(base), end: toDateStr(endOfMonth(base)), label: fmt(toDateStr(base), "MMMM yyyy") };
}
const cap = (d: DateStr) => (d > today() ? today() : d);

function Stat({ label, value, unit, delta, good = "up", digits = 1, suffix }: { label: string; value: string; unit?: string; delta?: number | null; good?: "up" | "down" | "neutral"; digits?: number; suffix?: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <div><span className="num text-xl font-bold">{value}</span>{unit && <span className="ms-1 text-[11px] text-muted-foreground">{unit}</span>}</div>
        {delta != null && <TrendBadge delta={delta} good={good} digits={digits} suffix={suffix} />}
      </div>
    </div>
  );
}
const n0 = (v: number | null) => (v == null ? "—" : String(Math.round(v)));
const n1 = (v: number | null) => (v == null ? "—" : String(round(v, 1)));
const p0 = (v: number | null) => (v == null ? "—" : String(Math.round(v * 100)));
const dl = (a: number | null, b: number | null) => (a == null || b == null ? null : a - b);
const dlp = (a: number | null, b: number | null) => (a == null || b == null ? null : (a - b) * 100);
const sgn = (v: number | null, d = 1) => (v == null ? "—" : `${v > 0 ? "+" : ""}${round(v, d)}`);

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <Card className="break-inside-avoid">
      <CardHeader><div><CardTitle>{title}</CardTitle>{desc && <CardDescription>{desc}</CardDescription>}</div></CardHeader>
      <CardContent><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{children}</div></CardContent>
    </Card>
  );
}

function ReportView({ kind }: { kind: Kind }) {
  const { db, profile } = useData();
  const g = profile.goals;
  const [offset, setOffset] = React.useState(0);
  const per = periodFor(kind, offset);
  const end = cap(per.end);
  const len = diffDays(per.end, per.start) + 1;
  const prevStart = kind === "week" ? addDays(per.start, -7) : toDateStr(addMonths(parse(per.start), -1));
  const prevEnd = kind === "week" ? addDays(per.start, -1) : addDays(per.start, -1);
  const prevLen = diffDays(prevEnd, prevStart) + 1;
  void prevLen; void len;

  const r = React.useMemo(() => (per.start > today() ? null : periodReport(db, per.start, end)), [db, per.start, end]);
  const p: PeriodReport | null = React.useMemo(() => periodReport(db, prevStart, prevEnd), [db, prevStart, prevEnd]);

  const days = React.useMemo(() => (per.start > today() ? [] : daysBetween(per.start, end)), [per.start, end]);
  const daily = React.useMemo(() => days.map((d) => {
    const n = dayNutrition(db.meal_logs, d);
    const sl = db.sleep_logs.find((s) => s.date === d);
    return {
      date: d, label: kind === "week" ? fmt(d, "EEE") : fmt(d, "d"), kcal: n.logged ? Math.round(n.kcal) : null, protein: n.logged ? Math.round(n.protein) : null,
      carbs: n.logged ? Math.round(n.carbs) : null, fat: n.logged ? Math.round(n.fat) : null,
      water: db.water_logs.some((w) => w.date === d) ? waterOn(db, d) : null, med: medDay(db, d).pct, workout: db.sessions.some((s) => s.date === d && s.status === "completed" && s.kind !== "cardio") ? 1 : 0,
      sleep: sl?.duration_h ?? null, sleepScore: sl ? sleepScore(sl, g) : null, servings: n.servings, logged: n.logged,
    };
  }), [days, db, g, kind]);

  const loggedDays = daily.filter((d) => d.logged);
  const macro = React.useMemo(() => {
    const k = loggedDays.length || 1;
    const pr = loggedDays.reduce((s, d) => s + (d.protein ?? 0), 0) / k, ca = loggedDays.reduce((s, d) => s + (d.carbs ?? 0), 0) / k, fa = loggedDays.reduce((s, d) => s + (d.fat ?? 0), 0) / k;
    return [
      { name: "بروتين", value: Math.round(pr), kcal: Math.round(pr * 4), color: "#ef4444" },
      { name: "كربوهيدرات", value: Math.round(ca), kcal: Math.round(ca * 4), color: "#f59e0b" },
      { name: "دهون", value: Math.round(fa), kcal: Math.round(fa * 9), color: "#a78bfa" },
    ];
  }, [loggedDays]);
  const servingsAdh = React.useMemo(() => GROUP_ORDER.filter((gr) => g.servings[gr] > 0).map((gr: FoodGroup) => {
    const k = loggedDays.length || 1;
    return { name: FOOD_GROUPS[gr].label, actual: round(loggedDays.reduce((s, d) => s + d.servings[gr], 0) / k, 1), target: g.servings[gr], color: FOOD_GROUPS[gr].color };
  }), [loggedDays, g]);

  const weeks = React.useMemo(() => {
    if (kind !== "month" || per.start > today()) return [];
    const out: { label: string; r: PeriodReport }[] = [];
    for (let s = weekStart(per.start); s <= end; s = addDays(s, 7)) {
      const a = s < per.start ? per.start : s, b = cap(addDays(s, 6) > per.end ? per.end : addDays(s, 6));
      out.push({ label: `${fmt(a, "d MMM")} – ${fmt(b, "d MMM")}`, r: periodReport(db, a, b) });
    }
    return out;
  }, [db, kind, per.start, per.end, end]);

  const exportCsv = () => {
    const head = ["date", "kcal", "protein_g", "water_ml", "meds_pct", "strength_workout", "sleep_h"];
    const rows = daily.map((d) => [d.date, d.kcal ?? "", d.protein ?? "", d.water ?? "", d.med == null ? "" : Math.round(d.med * 100), d.workout, d.sleep ?? ""].join(","));
    const blob = new Blob(["﻿" + [head.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `fitos-${kind}-${per.start}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="icon-sm" onClick={() => setOffset((o) => o - 1)} aria-label="السابق"><ChevronRight /></Button>
          <button onClick={() => setOffset(0)} className="min-w-52 rounded-md px-3 py-1 text-center text-sm font-semibold hover:bg-muted">{per.label}</button>
          <Button variant="secondary" size="icon-sm" onClick={() => setOffset((o) => o + 1)} disabled={offset >= 0} aria-label="التالي"><ChevronLeft /></Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!days.length}><Download />تصدير CSV</Button>
          <Button size="sm" onClick={() => window.print()}><Printer />طباعة / حفظ PDF</Button>
        </div>
      </div>
      <div className="hidden print:block"><h2 className="text-xl font-bold">تقرير {kind === "week" ? "أسبوعي" : "شهري"} — {profile.full_name}</h2><p className="text-sm">{per.label}</p></div>

      {!r || days.length === 0 ? <Card className="p-8 text-center text-sm text-muted-foreground">هذه الفترة لم تبدأ بعد.</Card> : (
        <>
          <Section title="الجسم" desc="التغيّر خلال الفترة (من آخر قياس قبلها)">
            <Stat label="تغيّر الوزن" value={sgn(r.weightChange)} unit="كجم" good="neutral" />
            <Stat label="تغيّر نسبة الدهون" value={sgn(r.fatChange)} unit="نقطة" good="down" />
            <Stat label="تغيّر العضلات" value={sgn(r.muscleChange)} unit="كجم" good="up" />
            <Stat label="النتيجة اليومية" value={p0(r.avgScore)} unit="%" delta={dlp(r.avgScore, p?.avgScore ?? null)} digits={0} suffix="%" />
          </Section>
          <Section title="التغذية" desc={`${r.loggedDays} من ${days.length} يوم مسجّل`}>
            <Stat label="متوسط السعرات" value={n0(r.avgKcal)} unit={`/ ${g.calories}`} delta={dl(r.avgKcal, p?.avgKcal ?? null)} good="neutral" digits={0} />
            <Stat label="متوسط البروتين" value={n0(r.avgProtein)} unit={`جم / ${g.protein_g}`} delta={dl(r.avgProtein, p?.avgProtein ?? null)} digits={0} />
            <Stat label="الالتزام بالنظام" value={p0(r.foodCompliance)} unit="%" delta={dlp(r.foodCompliance, p?.foodCompliance ?? null)} digits={0} suffix="%" />
            <Stat label="أيام مسجّلة" value={String(r.loggedDays)} delta={dl(r.loggedDays, p?.loggedDays ?? null)} digits={0} />
          </Section>
          <Section title="الماء">
            <Stat label="متوسط الشرب" value={n0(r.avgWater)} unit={`مل / ${g.water_ml}`} delta={dl(r.avgWater, p?.avgWater ?? null)} digits={0} />
            <Stat label="أيام تحقيق الهدف" value={String(r.waterGoalDays)} unit={`/ ${days.length}`} delta={dl(r.waterGoalDays, p?.waterGoalDays ?? null)} digits={0} />
          </Section>
          <Section title="الأدوية والمكملات">
            <Stat label="الالتزام" value={p0(r.medAdherence)} unit="%" delta={dlp(r.medAdherence, p?.medAdherence ?? null)} digits={0} suffix="%" />
            <Stat label="جرعات فائتة" value={String(r.missed)} delta={dl(r.missed, p?.missed ?? null)} good="down" digits={0} />
          </Section>
          <Section title="التمارين">
            <Stat label="جلسات المقاومة" value={String(r.sessions)} unit={kind === "week" ? `/ ${g.workouts_per_week}` : undefined} delta={dl(r.sessions, p?.sessions ?? null)} digits={0} />
            <Stat label="كارديو / مشي" value={String(r.cardio)} delta={dl(r.cardio, p?.cardio ?? null)} digits={0} />
            <Stat label="حجم التمرين" value={r.volume.toLocaleString("en-US")} unit="كجم" delta={dl(r.volume, p?.volume ?? null)} digits={0} />
            <Stat label="أرقام قياسية جديدة" value={String(r.prs)} delta={dl(r.prs, p?.prs ?? null)} digits={0} />
          </Section>
          <Section title="النوم">
            <Stat label="متوسط ساعات النوم" value={n1(r.avgSleep)} unit="ساعة" delta={dl(r.avgSleep, p?.avgSleep ?? null)} />
            <Stat label="متوسط Sleep Score" value={n0(r.avgSleepScore)} unit="/100" delta={dl(r.avgSleepScore, p?.avgSleepScore ?? null)} digits={0} />
          </Section>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="السعرات اليومية مقابل الهدف" className="break-inside-avoid">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={daily} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} interval={kind === "month" ? 2 : 0} />
                  <YAxis tickLine={false} axisLine={false} width={44} />
                  <Tooltip content={<ChartTip unit=" kcal" labels={{ kcal: "السعرات" }} digits={0} />} cursor={{ fill: "hsl(var(--muted))" }} />
                  <ReferenceLine y={g.calories} stroke="hsl(var(--success))" strokeDasharray="5 4" label={{ value: String(g.calories), fill: "hsl(var(--success))", fontSize: 10, position: "insideTopRight" }} />
                  <Bar dataKey="kcal" radius={[6, 6, 0, 0]} fill="hsl(var(--primary))" isAnimationActive />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="توزيع الماكروز (متوسط يومي)" description="حصة كل عنصر من السعرات" className="break-inside-avoid">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={macro} dataKey="kcal" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={3} stroke="none">
                    {macro.map((m) => <Cell key={m.name} fill={m.color} />)}
                  </Pie>
                  <Tooltip content={<ChartTip unit=" kcal" labels={{ kcal: "سعرات" }} digits={0} />} />
                  <Legend formatter={(v, e) => `${v} · ${(e.payload as unknown as { value: number }).value} جم`} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="الحصص الفعلية مقابل المطلوب" description="متوسط الأيام المسجّلة" className="break-inside-avoid">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={servingsAdh} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} />
                  <YAxis tickLine={false} axisLine={false} width={36} />
                  <Tooltip content={<ChartTip labels={{ actual: "الفعلي", target: "المطلوب" }} />} cursor={{ fill: "hsl(var(--muted))" }} />
                  <Bar dataKey="target" fill="hsl(var(--muted-foreground) / 0.35)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="actual" radius={[4, 4, 0, 0]}>{servingsAdh.map((s) => <Cell key={s.name} fill={s.color} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="الماء والنوم" description="مل ماء يوميًا" className="break-inside-avoid">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={daily} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} interval={kind === "month" ? 2 : 0} />
                  <YAxis tickLine={false} axisLine={false} width={44} />
                  <Tooltip content={<ChartTip unit=" مل" labels={{ water: "الماء" }} digits={0} />} cursor={{ fill: "hsl(var(--muted))" }} />
                  <ReferenceLine y={g.water_ml} stroke="hsl(var(--success))" strokeDasharray="5 4" />
                  <Bar dataKey="water" radius={[6, 6, 0, 0]} fill="#38bdf8" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {kind === "month" && weeks.length > 0 && (
            <Card className="break-inside-avoid">
              <CardHeader><div><CardTitle>التفصيل الأسبوعي</CardTitle><CardDescription>مقارنة أسابيع الشهر</CardDescription></div></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead><tr className="border-b text-xs text-muted-foreground">{["الأسبوع", "سعرات", "بروتين", "التزام غذائي", "ماء", "أدوية", "جلسات", "نوم", "نتيجة"].map((h) => <th key={h} className="px-2 py-2 text-start font-medium">{h}</th>)}</tr></thead>
                    <tbody>
                      {weeks.map((w) => (
                        <tr key={w.label} className="border-b last:border-0">
                          <td className="px-2 py-2.5 font-medium">{w.label}</td>
                          <td className="num px-2">{n0(w.r.avgKcal)}</td><td className="num px-2">{n0(w.r.avgProtein)}</td>
                          <td className="num px-2">{p0(w.r.foodCompliance)}%</td><td className="num px-2">{n0(w.r.avgWater)}</td>
                          <td className="num px-2">{p0(w.r.medAdherence)}%</td><td className="num px-2">{w.r.sessions}</td>
                          <td className="num px-2">{n1(w.r.avgSleep)}</td><td className="num px-2 font-semibold">{p0(w.r.avgScore)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <>
      <style>{`@media print{aside,header,nav{display:none!important} .md\\:ps-64{padding-inline-start:0!important} body{background:#fff!important;color:#000!important} .card-surface{box-shadow:none!important;break-inside:avoid}}`}</style>
      <PageHeader title="التقارير" subtitle="ملخص أسبوعي وشهري مقارنةً بالفترة السابقة" />
      <Tabs defaultValue="week">
        <TabsList className="print:hidden"><TabsTrigger value="week">أسبوعي</TabsTrigger><TabsTrigger value="month">شهري</TabsTrigger></TabsList>
        <TabsContent value="week"><ReportView kind="week" /></TabsContent>
        <TabsContent value="month"><ReportView kind="month" /></TabsContent>
      </Tabs>
    </>
  );
}
