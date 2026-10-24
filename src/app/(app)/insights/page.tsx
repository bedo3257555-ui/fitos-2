"use client";
import * as React from "react";
import { Apple, Droplets, Dumbbell, Moon, Pill, Sparkles } from "lucide-react";
import { useData } from "@/components/providers/data-provider";
import { PageHeader } from "@/components/shared/page-header";
import { InsightCard } from "@/components/shared/insight-card";
import { Heatmap } from "@/components/shared/heatmap";
import { Segmented } from "@/components/shared/segmented";
import { Ring } from "@/components/shared/ring";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { avg, dayScores, generateInsights, sleepCorrelations, type DayScores, type ScoreKey } from "@/lib/analytics";
import { fmtLong, rangeDays, today } from "@/lib/dates";
import { extraInsights } from "@/lib/intel";
import type { Insight, InsightKind } from "@/lib/types";

const SCORE_META: Record<Exclude<ScoreKey, "overall">, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  nutrition: { label: "التغذية", color: "#f59e0b", icon: Apple },
  water: { label: "الماء", color: "#38bdf8", icon: Droplets },
  meds: { label: "الأدوية", color: "#a78bfa", icon: Pill },
  workout: { label: "التمرين", color: "#22c55e", icon: Dumbbell },
  sleep: { label: "النوم", color: "#6366f1", icon: Moon },
};
const HEAT_OPTIONS: { value: ScoreKey; label: string }[] = [
  { value: "overall", label: "الإجمالي" }, { value: "nutrition", label: "التغذية" }, { value: "water", label: "الماء" },
  { value: "meds", label: "الأدوية" }, { value: "workout", label: "التمرين" }, { value: "sleep", label: "النوم" },
];
const pctText = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

export default function InsightsPage() {
  const { db } = useData();
  const [metric, setMetric] = React.useState<ScoreKey>("overall");
  const [selected, setSelected] = React.useState<string>(today());

  const insights = React.useMemo<Insight[]>(() => {
    const ORDER = { warning: 0, recommendation: 1, achievement: 2, insight: 3 } as const;
    const local = [...generateInsights(db), ...extraInsights(db)].sort((x, y) => ORDER[x.kind] - ORDER[y.kind] || y.severity - x.severity);
    const seen = new Set(local.map((i) => i.title));
    const server: Insight[] = db.insights.filter((s) => !seen.has(s.title)).map((s) => ({ id: `srv-${s.id}`, kind: s.kind, area: "general", title: s.title, body: s.body, severity: s.severity, date: s.date }));
    return [...local, ...server];
  }, [db]);

  const counts = React.useMemo(() => {
    const c: Record<InsightKind | "all", number> = { all: insights.length, warning: 0, recommendation: 0, achievement: 0, insight: 0 };
    insights.forEach((i) => c[i.kind]++);
    return c;
  }, [insights]);

  const scores = React.useMemo(() => rangeDays(today(), 7).map((d) => dayScores(db, d)), [db]);
  const avgOf = (k: Exclude<ScoreKey, "overall">) => avg(scores.map((s) => s[k]).filter((v): v is number => v != null));
  const overall = avg(scores.map((s) => s.overall).filter((v): v is number => v != null));

  const heat = React.useMemo(() => {
    const out: Record<string, number | null> = {};
    rangeDays(today(), 7 * 12).forEach((d) => { out[d] = dayScores(db, d)[metric]; });
    return out;
  }, [db, metric]);
  const day: DayScores = React.useMemo(() => dayScores(db, selected), [db, selected]);
  const corr = React.useMemo(() => sleepCorrelations(db), [db]);

  const tabs: { v: InsightKind | "all"; label: string }[] = [
    { v: "all", label: "الكل" }, { v: "warning", label: "تحذيرات" }, { v: "recommendation", label: "توصيات" }, { v: "achievement", label: "إنجازات" }, { v: "insight", label: "ملاحظات" },
  ];
  const heatColor = "var(--primary)";

  return (
    <>
      <PageHeader title="التحليلات الذكية" subtitle="قراءة تلقائية لوزنك وعضلاتك وتغذيتك وأدويتك وتمارينك ونومك" />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Card className="col-span-2 flex items-center gap-4 p-4 md:col-span-1">
          <Ring value={overall ?? 0} size={76} stroke={8}><span className="num text-lg font-bold">{overall == null ? "—" : Math.round(overall * 100)}</span></Ring>
          <div><div className="text-sm font-semibold">النتيجة الأسبوعية</div><div className="text-[11px] text-muted-foreground">متوسط آخر 7 أيام</div></div>
        </Card>
        {(Object.keys(SCORE_META) as (keyof typeof SCORE_META)[]).map((k) => {
          const m = SCORE_META[k], v = avgOf(k);
          return (
            <Card key={k} className="p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><span className="flex size-7 items-center justify-center rounded-lg" style={{ background: `${m.color}26`, color: m.color }}><m.icon className="size-4" /></span>{m.label}</div>
              <div className="num mt-2 text-2xl font-bold">{pctText(v)}</div>
              <Progress value={(v ?? 0) * 100} color={m.color} className="mt-2 h-1.5" />
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Tabs defaultValue="all">
            <TabsList>{tabs.map((t) => <TabsTrigger key={t.v} value={t.v}>{t.label} <span className="num ms-1 text-[11px] opacity-70">{counts[t.v]}</span></TabsTrigger>)}</TabsList>
            {tabs.map((t) => (
              <TabsContent key={t.v} value={t.v} className="space-y-2.5">
                {(t.v === "all" ? insights : insights.filter((i) => i.kind === t.v)).map((i, idx) => <InsightCard key={i.id} insight={i} index={idx} />)}
                {(t.v === "all" ? insights : insights.filter((i) => i.kind === t.v)).length === 0 && (
                  <EmptyState icon={<Sparkles />} title="لا شيء هنا الآن" hint="سجّل وجباتك وماءك وأدويتك وتمارينك يوميًا لتظهر تحليلات أدق." />
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader><div><CardTitle>خريطة الالتزام (12 أسبوعًا)</CardTitle><CardDescription>اضغط على أي يوم لعرض تفاصيله</CardDescription></div></CardHeader>
            <CardContent className="space-y-4">
              <Segmented value={metric} onChange={setMetric} options={HEAT_OPTIONS} className="max-w-full overflow-x-auto" />
              <Heatmap weeks={12} values={heat} color={heatColor} onSelect={setSelected} selected={selected} />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground"><span>أقل</span><div className="flex gap-1">{[0.15, 0.4, 0.65, 0.9, 1].map((o) => <span key={o} className="size-3 rounded-sm" style={{ background: `hsl(var(--primary) / ${o})` }} />)}</div><span>أكثر</span></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><div><CardTitle>تفاصيل اليوم</CardTitle><CardDescription>{fmtLong(selected)}</CardDescription></div></CardHeader>
            <CardContent className="space-y-3">
              {day.overall == null ? <p className="text-sm text-muted-foreground">لا بيانات مسجّلة في هذا اليوم.</p> : (
                <>
                  <div className="flex items-center justify-between rounded-lg bg-primary/10 p-3"><span className="text-sm font-semibold">النتيجة الإجمالية</span><span className="num text-xl font-bold text-primary">{pctText(day.overall)}</span></div>
                  {(Object.keys(SCORE_META) as (keyof typeof SCORE_META)[]).map((k) => (
                    <div key={k}>
                      <div className="mb-1 flex justify-between text-xs"><span className="text-muted-foreground">{SCORE_META[k].label}</span><span className="num font-semibold">{pctText(day[k])}</span></div>
                      <Progress value={(day[k] ?? 0) * 100} color={SCORE_META[k].color} className="h-1.5" />
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><div><CardTitle>النوم ↔ التقدّم</CardTitle><CardDescription>ارتباط بيرسون الأسبوعي (آخر 12 أسبوعًا)</CardDescription></div></CardHeader>
            <CardContent className="space-y-3">
              {corr.map((c) => (
                <div key={c.label}>
                  <div className="flex items-center justify-between text-xs"><span>{c.label}</span>
                    <span className="num font-semibold" dir="ltr">{c.r == null ? "بيانات غير كافية" : `r = ${c.r.toFixed(2)}`}</span></div>
                  <div className="relative mt-1.5 h-1.5 rounded-full bg-muted" dir="ltr">
                    <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
                    {c.r != null && <div className="absolute inset-y-0 rounded-full" style={{ background: c.r >= 0 ? "hsl(var(--success))" : "hsl(var(--danger))", left: c.r >= 0 ? "50%" : `${50 + c.r * 50}%`, width: `${Math.abs(c.r) * 50}%` }} />}
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">{c.n} أسابيع · {c.note}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
