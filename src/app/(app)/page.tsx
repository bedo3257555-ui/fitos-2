"use client";
import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Area, Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  ArrowLeft, Brain, CheckCircle2, Clock, Dumbbell, Droplets, Flame, HeartPulse, Moon, Pill, Scale, Sparkles, Target, Utensils, Zap,
} from "lucide-react";
import { useData } from "@/components/providers/data-provider";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { ChartCard, ChartTip } from "@/components/shared/chart-card";
import { Heatmap } from "@/components/shared/heatmap";
import { Ring } from "@/components/shared/ring";
import { Segmented } from "@/components/shared/segmented";
import { InsightCard } from "@/components/shared/insight-card";
import { TrendBadge } from "@/components/shared/trend-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  avg, dayNutrition, dayScores, generateInsights, latestValue, medAdherence, medDay, nextSplit, scoreSeries, slotsOn,
  sleepScore, waterOn, weeklyWorkoutSeries, sortedMeasurements, type ScoreKey,
} from "@/lib/analytics";
import { SPLITS } from "@/lib/constants";
import { coachPlan, extraInsights, readiness, weightTrend } from "@/lib/intel";
import { CoachList } from "@/components/shared/coach-list";
import { EnergyCheckin } from "@/components/shared/energy-checkin";
import { ReadinessBody } from "@/components/shared/readiness-card";
import { ChallengeCard } from "@/components/shared/challenge-card";
import { DayReviewBody } from "@/components/shared/day-review";
import { fmt, fmtLong, rangeDays, time12, today, weekStart, addDays } from "@/lib/dates";
import { fmtNum } from "@/lib/utils";
import { useNow } from "@/hooks/use-today";

const HEAT: { value: ScoreKey; label: string; color: string }[] = [
  { value: "overall", label: "الإجمالي", color: "218 100% 62%" },
  { value: "nutrition", label: "التغذية", color: "152 60% 48%" },
  { value: "water", label: "الماء", color: "199 90% 55%" },
  { value: "meds", label: "الأدوية", color: "262 85% 72%" },
  { value: "workout", label: "التمارين", color: "38 95% 56%" },
  { value: "sleep", label: "النوم", color: "280 70% 65%" },
];

export default function DashboardPage() {
  const { db, profile } = useData();
  useNow();
  const g = profile.goals;
  const t = today();
  const [heatKey, setHeatKey] = React.useState<ScoreKey>("overall");
  const [heatSel, setHeatSel] = React.useState<string | undefined>();

  const nut = dayNutrition(db.meal_logs, t);
  const water = waterOn(db, t);
  const md = medDay(db, t);
  const weekMeds = medAdherence(db, addDays(t, -6), t);
  const wk = weeklyWorkoutSeries(db, 1)[0];
  const lastSleep = [...db.sleep_logs].sort((a, b) => b.date.localeCompare(a.date))[0];
  const sleepSc = lastSleep ? Math.round(sleepScore(lastSleep, g)) : null;
  const w = latestValue(db, "weight_kg");
  const f = latestValue(db, "body_fat_pct");
  const m = latestValue(db, "muscle_mass_kg");
  const next = nextSplit(db, t);
  const score = dayScores(db, t);
  const insights = React.useMemo(() => [...generateInsights(db, t), ...extraInsights(db, t)], [db, t]);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const plan = React.useMemo(() => coachPlan(db, t, nowMin), [db, t, nowMin]);
  const ready = React.useMemo(() => readiness(db, t), [db, t]);
  const trend = React.useMemo(() => weightTrend(db, t), [db, t]);
  const topInsights = [...insights].sort((a, b) => b.severity - a.severity).slice(0, 4);

  const series = React.useMemo(() => scoreSeries(db, t, 84), [db, t]);
  const heat = React.useMemo(() => Object.fromEntries(series.map((s) => [s.date, s[heatKey]])), [series, heatKey]);
  const heatDay = series.find((s) => s.date === (heatSel ?? t));

  const last14 = rangeDays(t, 14);
  const calChart = last14.map((d) => {
    const n = dayNutrition(db.meal_logs, d);
    return { label: fmt(d, "d/M"), kcal: n.logged ? Math.round(n.kcal) : null, protein: n.logged ? Math.round(n.protein) : null };
  });
  const wl = db.sessions.length || db.sets.length ? weeklyWorkoutSeries(db, 8) : [];
  const body = sortedMeasurements(db).filter((x) => x.weight_kg != null || x.body_fat_pct != null).map((x) => ({
    label: fmt(x.date, "d MMM"), weight: x.weight_kg, fat: x.body_fat_pct, smm: x.muscle_mass_kg,
  }));

  const sparkW = sortedMeasurements(db).map((x) => x.weight_kg);
  const sparkF = sortedMeasurements(db).map((x) => x.body_fat_pct);
  const sparkM = sortedMeasurements(db).map((x) => x.muscle_mass_kg);
  const sparkCal = last14.map((d) => { const n = dayNutrition(db.meal_logs, d); return n.logged ? n.kcal : null; });
  const sparkPro = last14.map((d) => { const n = dayNutrition(db.meal_logs, d); return n.logged ? n.protein : null; });
  const sparkWater = last14.map((d) => waterOn(db, d) || null);
  const sparkSleep = rangeDays(t, 14).map((d) => { const s = db.sleep_logs.find((x) => x.date === d); return s ? sleepScore(s, g) : null; });

  const agenda = slotsOn(db, t).filter((s) => s.state === "due" || s.state === "missed" || s.state === "upcoming").sort((a, b) => a.time.localeCompare(b.time));
  const dueNow = agenda.filter((s) => s.state === "due" || s.state === "missed");
  const upcoming = agenda.filter((s) => s.state === "upcoming").slice(0, 4);

  const hr = new Date().getHours();
  const greet = hr < 12 ? "صباح الخير" : hr < 18 ? "مساء الخير" : "مساء النور";
  const parts = profile.full_name.split(" ");
  const firstName = parts[0] === "عبد" && parts[1] ? `${parts[0]} ${parts[1]}` : parts[0];
  const overall = score.overall ?? 0;

  const sinceFirst = (k: "body_fat_pct" | "muscle_mass_kg" | "weight_kg") => {
    const ms = sortedMeasurements(db).filter((x) => x[k] != null);
    return ms.length >= 2 ? (ms[ms.length - 1][k] as number) - (ms[0][k] as number) : null;
  };
  const toTarget = w ? w.value - g.target_weight_kg : null;

  return (
    <div>
      <PageHeader title={`${greet}، ${firstName} 👋`} subtitle={fmtLong(t)} actions={
        <Button asChild variant="secondary" size="sm"><Link href="/insights"><Sparkles /> التحليلات الذكية</Link></Button>
      } />

      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card-surface hero-glow relative mb-5 overflow-hidden p-5 sm:p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <Ring value={overall} size={104} stroke={9}>
              <span className="num text-2xl font-bold">{score.overall == null ? "—" : Math.round(overall * 100)}</span>
              <span className="text-[10px] text-muted-foreground">درجة اليوم</span>
            </Ring>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">الجلسة القادمة في الدورة</div>
              <div className="text-xl font-bold">{next.split === "rest" ? "يوم راحة 🛌" : SPLITS[next.split].en}</div>
              <div className="text-xs text-muted-foreground">{next.reason}</div>
              {next.split !== "rest" && <Button asChild size="sm" className="mt-2"><Link href={`/workouts?split=${next.split}`}><Dumbbell /> ابدأ التمرين</Link></Button>}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Growth label="الدهون %" value={sinceFirst("body_fat_pct")} good="down" suffix="٪" />
            <Growth label="العضلات" value={sinceFirst("muscle_mass_kg")} good="up" suffix=" كجم" />
            <Growth label="الوزن" value={sinceFirst("weight_kg")} good="neutral" suffix=" كجم" />
            <div className="col-span-3 text-center text-[11px] text-muted-foreground">النمو منذ أول قياس InBody</div>
          </div>
        </div>
      </motion.div>

      {/* Smart coach strip */}
      <div className="mb-5 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader><div><CardTitle className="flex items-center gap-1.5"><Brain className="size-4 text-violet" /> التالي لك الآن</CardTitle><CardDescription>أهم 3 خطوات حسب الوقت وسجلّاتك</CardDescription></div>
            <Button asChild variant="ghost" size="sm"><Link href="/coach">المدرب الذكي <ArrowLeft /></Link></Button></CardHeader>
          <CardContent className="space-y-3"><CoachList actions={plan.actions} limit={3} /><EnergyCheckin compact /></CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><div><CardTitle>الجاهزية والتوقّع</CardTitle><CardDescription>{trend.headline}</CardDescription></div></CardHeader>
          <CardContent><ReadinessBody r={ready} size={92} /></CardContent>
        </Card>
      </div>

      <ChallengeCard className="mb-5" />
      {nowMin >= 19 * 60 && (
        <Card className="mb-5"><CardHeader><div><CardTitle>🌙 مراجعة اليوم</CardTitle><CardDescription>اختم يومك وشوف بكرة فيه إيه</CardDescription></div></CardHeader><CardContent><DayReviewBody /></CardContent></Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard index={0} label="الوزن الحالي" icon={<Scale className="size-4" />} color="#3b82f6" value={fmtNum(w?.value, 1)} unit="كجم"
          delta={w && w.prev != null ? w.value - w.prev : null} deltaGood="neutral" spark={sparkW}
          hint={toTarget != null ? (Math.abs(toTarget) < 0.05 ? "وصلت للهدف 🎯" : `${toTarget > 0 ? "باقي" : "تجاوزت الهدف بـ"} ${Math.abs(toTarget).toFixed(1)} كجم للهدف ${g.target_weight_kg}`) : undefined} href="/measurements" />
        <KpiCard index={1} label="نسبة الدهون" icon={<HeartPulse className="size-4" />} color="#f97316" value={fmtNum(f?.value, 1)} unit="٪"
          delta={f && f.prev != null ? f.value - f.prev : null} deltaGood="down" spark={sparkF} href="/measurements" />
        <KpiCard index={2} label="الكتلة العضلية (SMM)" icon={<Dumbbell className="size-4" />} color="#8b5cf6" value={fmtNum(m?.value, 1)} unit="كجم"
          delta={m && m.prev != null ? m.value - m.prev : null} deltaGood="up" spark={sparkM} href="/measurements" />
        <KpiCard index={3} label="السعرات اليوم" icon={<Flame className="size-4" />} color="#ef4444" value={nut.logged ? fmtNum(nut.kcal) : "—"} unit={`/ ${g.calories}`}
          spark={sparkCal} ring={nut.logged ? Math.min(1, nut.kcal / g.calories) : undefined} href="/nutrition"
          hint={nut.logged ? `متبقي ${Math.max(0, Math.round(g.calories - nut.kcal))} kcal` : "لم تُسجَّل وجبات بعد"} />
        <KpiCard index={4} label="البروتين اليوم" icon={<Utensils className="size-4" />} color="#10b981" value={nut.logged ? fmtNum(nut.protein) : "—"} unit={`/ ${g.protein_g} جم`}
          spark={sparkPro} ring={nut.logged ? Math.min(1, nut.protein / g.protein_g) : undefined} href="/nutrition" />
        <KpiCard index={5} label="شرب الماء" icon={<Droplets className="size-4" />} color="#38bdf8" value={fmtNum(water / 1000, 2)} unit={`/ ${g.water_ml / 1000} لتر`}
          ring={Math.min(1, water / g.water_ml)} spark={sparkWater} href="/water" />
        <KpiCard index={6} label="إنجاز التمارين (الأسبوع)" icon={<Zap className="size-4" />} color="#f59e0b" value={`${wk?.sessions ?? 0}`} unit={`/ ${g.workouts_per_week} جلسات`}
          ring={Math.min(1, (wk?.sessions ?? 0) / g.workouts_per_week)} href="/workouts" hint={`كارديو ${wk?.cardio ?? 0}/${g.cardio_days_per_week}`} />
        <KpiCard index={7} label="الالتزام الدوائي" icon={<Pill className="size-4" />} color="#a78bfa" value={md.pct == null ? "—" : `${Math.round(md.pct * 100)}`} unit="٪ اليوم"
          ring={md.pct ?? 0} href="/medications" hint={weekMeds.pct != null ? `الأسبوع ${Math.round(weekMeds.pct * 100)}٪ · فائتة ${weekMeds.missed}` : undefined} />
        <KpiCard index={8} label="درجة النوم" icon={<Moon className="size-4" />} color="#c084fc" value={sleepSc == null ? "—" : `${sleepSc}`} unit="/ 100" spark={sparkSleep}
          href="/sleep" hint={lastSleep ? `${lastSleep.duration_h.toFixed(1)} ساعة — ${fmt(lastSleep.date)}` : "سجّل نومك"} />
        <KpiCard index={9} label="التزام الغذاء" icon={<Target className="size-4" />} color="#22c55e" value={score.nutrition == null ? "—" : `${Math.round(score.nutrition * 100)}`} unit="٪"
          ring={score.nutrition ?? 0} href="/nutrition" hint="مقارنة بحصص الدكتور" />
      </div>

      {/* Agenda + insights */}
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><div><CardTitle>جدول اليوم</CardTitle><CardDescription>جرعات مستحقة ومواعيد قادمة</CardDescription></div>
            <Button asChild variant="ghost" size="sm"><Link href="/medications">الكل <ArrowLeft /></Link></Button></CardHeader>
          <CardContent className="space-y-2">
            {dueNow.length === 0 && upcoming.length === 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm text-success"><CheckCircle2 className="size-4" /> أنهيت كل جرعات اليوم 🎉</div>
            )}
            {dueNow.map((s) => (
              <Link key={s.medication_id + s.slot_id} href="/medications" className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 p-2.5 text-sm">
                <span className="size-2.5 rounded-full" style={{ background: s.color }} />
                <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                <span className="text-xs text-muted-foreground">{s.label}</span>
                <Badge variant={s.state === "missed" ? "danger" : "warning"}>{s.state === "missed" ? "فائتة" : "الآن"}</Badge>
              </Link>
            ))}
            {upcoming.map((s) => (
              <div key={s.medication_id + s.slot_id} className="flex items-center gap-3 rounded-lg bg-muted/60 p-2.5 text-sm">
                <span className="size-2.5 rounded-full" style={{ background: s.color }} />
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                <span className="num flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-3" />{time12(s.time)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><div><CardTitle>تحليلات ذكية</CardTitle><CardDescription>أهم ما يخص حالتك الآن</CardDescription></div>
            <Button asChild variant="ghost" size="sm"><Link href="/insights">المزيد <ArrowLeft /></Link></Button></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {topInsights.map((i, k) => <InsightCard key={i.id} insight={i} index={k} />)}
            {topInsights.length === 0 && <p className="text-sm text-muted-foreground">سجّل بعض البيانات لتظهر التحليلات.</p>}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <ChartCard title="تكوين الجسم" description="الوزن · الكتلة العضلية · نسبة الدهون (InBody)" height={260}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={body} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
              <defs><linearGradient id="gw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3b82f6" stopOpacity=".3" /><stop offset="1" stopColor="#3b82f6" stopOpacity="0" /></linearGradient></defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis yAxisId="kg" domain={[(m: number) => Math.floor(m - 2), (m: number) => Math.ceil(m + 2)]} tickLine={false} axisLine={false} width={44} />
              <YAxis yAxisId="smm" hide domain={[(m: number) => Math.floor(m - 3), (m: number) => Math.ceil(m + 3)]} />
              <YAxis yAxisId="pct" orientation="right" domain={[(m: number) => Math.floor(m - 2), (m: number) => Math.ceil(m + 2)]} tickLine={false} axisLine={false} width={36} tickFormatter={(v: number) => `${Math.round(v)}`} />
              <Tooltip content={<ChartTip labels={{ weight: "الوزن (كجم)", smm: "العضلات (كجم)", fat: "الدهون (٪)" }} />} />
              <Area yAxisId="kg" type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={2.5} fill="url(#gw)" connectNulls />
              <Line yAxisId="smm" type="monotone" dataKey="smm" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
              <Line yAxisId="pct" type="monotone" dataKey="fat" stroke="#f97316" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="السعرات والبروتين — آخر 14 يوم" description={`الهدف ${g.calories} kcal · ${g.protein_g} جم بروتين`} height={260}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={calChart} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} interval={1} />
              <YAxis yAxisId="k" tickLine={false} axisLine={false} domain={[0, (max: number) => Math.max(max, g.calories + 200)]} />
              <YAxis yAxisId="p" orientation="right" tickLine={false} axisLine={false} domain={[0, (max: number) => Math.max(max, g.protein_g + 20)]} />
              <Tooltip content={<ChartTip labels={{ kcal: "سعرات", protein: "بروتين (جم)" }} digits={0} />} />
              <ReferenceLine yAxisId="k" y={g.calories} stroke="#ef4444" strokeDasharray="4 4" />
              <Bar yAxisId="k" dataKey="kcal" fill="#ef4444" fillOpacity={0.75} radius={[6, 6, 0, 0]} />
              <Line yAxisId="p" type="monotone" dataKey="protein" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="حجم التمرين الأسبوعي" description="Volume Load (كجم × عدات) وعدد الجلسات" height={240}>
          {wl.some((x) => x.volume > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={wl} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis yAxisId="v" tickLine={false} axisLine={false} />
                <YAxis yAxisId="s" orientation="right" allowDecimals={false} tickLine={false} axisLine={false} domain={[0, 7]} />
                <Tooltip content={<ChartTip labels={{ volume: "Volume Load", sessions: "جلسات" }} digits={0} />} />
                <Bar yAxisId="v" dataKey="volume" fill="#f59e0b" fillOpacity={0.8} radius={[6, 6, 0, 0]} />
                <Line yAxisId="s" type="monotone" dataKey="sessions" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : <Empty text="سجّل أول جلسة تمرين لتظهر الاتجاهات" href="/workouts" />}
        </ChartCard>

        <Card>
          <CardHeader>
            <div><CardTitle>خريطة الالتزام</CardTitle><CardDescription>آخر 12 أسبوعًا — اضغط على يوم لعرض تفاصيله</CardDescription></div>
            <Segmented value={heatKey} onChange={setHeatKey} options={HEAT.map((h) => ({ value: h.value, label: h.label }))} className="max-w-full overflow-x-auto" />
          </CardHeader>
          <CardContent>
            <Heatmap weeks={12} values={heat} color={HEAT.find((h) => h.value === heatKey)!.color} onSelect={setHeatSel} selected={heatSel} />
            {heatDay && (
              <div className="mt-4 grid grid-cols-5 gap-2 rounded-lg bg-muted/50 p-3 text-center text-xs">
                <div className="col-span-5 text-start font-semibold">{fmtLong(heatDay.date)}</div>
                {([["nutrition", "تغذية"], ["water", "ماء"], ["meds", "أدوية"], ["workout", "تمرين"], ["sleep", "نوم"]] as const).map(([k, l]) => (
                  <div key={k}><div className="num text-base font-bold">{heatDay[k] == null ? "—" : Math.round((heatDay[k] as number) * 100)}</div><div className="text-muted-foreground">{l}</div></div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Growth({ label, value, good, suffix }: { label: string; value: number | null; good: "up" | "down" | "neutral"; suffix: string }) {
  return (
    <div className="rounded-xl bg-background/50 p-3 text-center">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 flex justify-center"><TrendBadge delta={value} good={good} suffix={suffix} digits={1} className="text-xs" /></div>
      {value == null && <div className="num text-sm text-muted-foreground">—</div>}
    </div>
  );
}

function Empty({ text, href }: { text: string; href: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
      <Dumbbell className="size-6 opacity-50" />{text}
      <Button asChild size="sm" variant="secondary"><Link href={href}>ابدأ الآن</Link></Button>
    </div>
  );
}
