"use client";
import * as React from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Bot, Brain, CalendarRange, Moon, Flame, Gauge, Target, TrendingDown, Trophy, Zap } from "lucide-react";
import { useData } from "@/components/providers/data-provider";
import { PageHeader } from "@/components/shared/page-header";
import { CoachList } from "@/components/shared/coach-list";
import { EnergyCheckin } from "@/components/shared/energy-checkin";
import { ReadinessBody } from "@/components/shared/readiness-card";
import { ChartCard, ChartTip } from "@/components/shared/chart-card";
import { Ring } from "@/components/shared/ring";
import { CoachChat } from "@/components/shared/coach-chat";
import { ChallengeCard } from "@/components/shared/challenge-card";
import { DayReviewBody } from "@/components/shared/day-review";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { dayScores, scoreSeries } from "@/lib/analytics";
import {
  coachPlan, energyBalance, energyCorrelations, focusArea, mealStates, medPatterns, progression, proteinPace, readiness, strengthOutlook,
  scenarioEta, waterPace, weekdayPattern, weeklyStory, weightProjection,
} from "@/lib/intel";
import { fmt, fmtLong, nowMinutes, time12, today } from "@/lib/dates";
import { useNow } from "@/hooks/use-today";
import { cn } from "@/lib/utils";

const STATUS_BADGE = { reached: ["success", "وصلت"], on_track: ["success", "على المسار"], slow: ["warning", "بطيء"], stalled: ["warning", "ثبات"], wrong_way: ["danger", "عكس الاتجاه"], insufficient: ["muted", "بيانات قليلة"] } as const;
const pctTxt = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

export default function CoachPage() {
  const { db } = useData();
  useNow();
  const t = today();
  const nowMin = nowMinutes();
  const g = db.profile!.goals;

  const plan = React.useMemo(() => coachPlan(db, t, nowMin), [db, t, nowMin]);
  const ready = React.useMemo(() => readiness(db, t), [db, t]);
  const wp = waterPace(db, t, nowMin);
  const pp = proteinPace(db, t);
  const meals = mealStates(db, t, nowMin);
  const series = React.useMemo(() => scoreSeries(db, t, 120), [db, t]);
  const focus = React.useMemo(() => focusArea(db, t, series), [db, t, series]);
  const story = React.useMemo(() => weeklyStory(db, t), [db, t]);
  const [scn, setScn] = React.useState<number | null>(null);
  const baseAdh = React.useMemo(() => scenarioEta(db, t, 0.8, series).baseAdherence, [db, t, series]);
  const adh = scn ?? Math.round(baseAdh * 100) / 100;
  const sc = React.useMemo(() => scenarioEta(db, t, adh, series), [db, t, adh, series]);
  const proj = React.useMemo(() => weightProjection(db, t, 12, scn == null ? undefined : sc.scenarioRate), [db, t, scn, sc.scenarioRate]);
  const eb = React.useMemo(() => energyBalance(db, t), [db, t]);
  const mp = React.useMemo(() => medPatterns(db, t, 28), [db, t]);
  const wd = React.useMemo(() => weekdayPattern(db, t), [db, t]);
  const ec = React.useMemo(() => energyCorrelations(db, t), [db, t]);
  const so = React.useMemo(() => strengthOutlook(db, t), [db, t]);
  const prog = React.useMemo(() => progression(db, t, series), [db, t, series]);
  const score = dayScores(db, t);
  const tr = proj.trend;
  const [badgeVariant, badgeLabel] = STATUS_BADGE[tr.status];

  const chartRows = proj.rows.map((r) => ({ label: fmt(r.date, "d MMM"), actual: r.actual, projected: r.projected }));
  const wvals = chartRows.flatMap((r) => [r.actual, r.projected]).filter((v): v is number => v != null);
  const lo = Math.floor(Math.min(...wvals, g.target_weight_kg) - 1), hi = Math.ceil(Math.max(...wvals, g.target_weight_kg) + 1);

  return (
    <div className="space-y-5">
      <PageHeader title="المدرب الذكي" subtitle={`${fmtLong(t)} — توصيات مبنية على بياناتك فقط، بدون أي تعديل على خطتك الغذائية أو برنامج تمرينك`}
        actions={<Badge variant="violet"><Brain className="size-3" /> استرشادي</Badge>} />

      <Card className="hero-glow"><CardContent className="pt-5"><EnergyCheckin /></CardContent></Card>

      <Card id="chat">
        <CardHeader><div><CardTitle className="flex items-center gap-1.5"><Bot className="size-4 text-violet" /> اسأل المدرب</CardTitle><CardDescription>أجوبة فورية من بياناتك — بدون إنترنت</CardDescription></div></CardHeader>
        <CardContent><CoachChat /></CardContent>
      </Card>

      <ChallengeCard />

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader><div><CardTitle>ماذا أفعل الآن؟</CardTitle><CardDescription>مرتّبة حسب الأولوية والوقت</CardDescription></div>
            <Ring value={score.overall ?? 0} size={52} stroke={5}><span className="num text-xs font-bold">{score.overall == null ? "—" : Math.round(score.overall * 100)}</span></Ring></CardHeader>
          <CardContent><CoachList actions={plan.actions} done={plan.done} /></CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><div><CardTitle className="flex items-center gap-1.5"><Gauge className="size-4 text-primary" /> الجاهزية للتمرين</CardTitle><CardDescription>من النوم والطاقة والاستشفاء والتغذية</CardDescription></div></CardHeader>
          <CardContent><ReadinessBody r={ready} /></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><div><CardTitle>إيقاع الماء</CardTitle><CardDescription>المتوقع حتى هذه الساعة مقابل ما شربته</CardDescription></div></CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Progress value={(wp.drunk / wp.goal) * 100} color="#38bdf8" className="h-3" />
              <span className="absolute top-[-3px] h-[18px] w-0.5 bg-foreground/70" style={{ insetInlineStart: `${Math.min(100, (wp.expected / wp.goal) * 100)}%` }} title="المتوقع الآن" />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground"><span className="num">{wp.drunk} مل</span><span>المتوقع <span className="num">{wp.expected}</span></span><span className="num">{wp.goal}</span></div>
            <p className="text-sm">{wp.text}</p>
            <div className="border-t pt-3">
              <div className="mb-1 flex justify-between text-xs"><span>البروتين</span><span className="num text-muted-foreground">{pp.logged} / {pp.goal} جم</span></div>
              <Progress value={pp.goal ? (pp.logged / pp.goal) * 100 : 0} color="#10b981" className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><div><CardTitle>وجبات اليوم</CardTitle><CardDescription>مواعيدك من الإعدادات — بدون تغيير في الحصص</CardDescription></div></CardHeader>
          <CardContent className="space-y-2">
            {meals.map((m) => (
              <Link key={m.meal} href="/nutrition" className="flex items-center gap-3 rounded-lg bg-muted/50 p-2.5 text-sm">
                <span className="text-lg">{m.icon}</span><span className="flex-1">{m.label}</span>
                <span className="num text-xs text-muted-foreground">{time12(m.time)}</span>
                <Badge variant={m.state === "done" ? "success" : m.state === "overdue" ? "danger" : m.state === "soon" ? "warning" : "muted"}>
                  {m.state === "done" ? "مسجّلة" : m.state === "overdue" ? "لم تُسجَّل" : m.state === "soon" ? "قريبًا" : "لاحقًا"}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><div><CardTitle className="flex items-center gap-1.5"><Target className="size-4 text-warning" /> تركيز الأسبوع</CardTitle><CardDescription>أضعف مجال آخر 14 يومًا</CardDescription></div></CardHeader>
          <CardContent className="space-y-3">
            {focus ? (<>
              <div className="flex items-center justify-between"><span className="text-lg font-bold">{focus.label}</span><Badge variant="warning" className="num">{Math.round(focus.avg * 100)}%</Badge></div>
              <p className="text-sm leading-relaxed text-muted-foreground">{focus.action}</p>
            </>) : <p className="text-sm text-muted-foreground">كل المجالات فوق 90% أو البيانات لسه قليلة — استمر 👏</p>}
            {story && (
              <div className="border-t pt-3 text-xs">
                <div className="mb-1 flex items-center gap-1.5 font-semibold"><CalendarRange className="size-3.5" /> الأسبوع الماضي ({fmt(story.start)} – {fmt(story.end)})</div>
                <div className="flex items-center gap-2"><span className="num text-xl font-bold">{pctTxt(story.score)}</span>
                  {story.score != null && story.prevScore != null && <span className={cn("num", story.score >= story.prevScore ? "text-success" : "text-danger")}>{story.score >= story.prevScore ? "▲" : "▼"} {Math.abs(Math.round((story.score - story.prevScore) * 100))} نقطة</span>}</div>
                {story.wins.slice(0, 3).map((w) => <div key={w} className="text-success">✓ {w}</div>)}
                {story.gaps.slice(0, 3).map((w) => <div key={w} className="text-warning">• {w}</div>)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard className="lg:col-span-2" title="توقّع الوصول للوزن المستهدف" height={250}
          description={`الهدف ${g.target_weight_kg} كجم — مبني على ${tr.points} قياسات (ثقة ${tr.confidence === "high" ? "عالية" : tr.confidence === "medium" ? "متوسطة" : "منخفضة"})`}
          right={<Badge variant={badgeVariant}>{badgeLabel}</Badge>}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartRows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis domain={[lo, hi]} tickLine={false} axisLine={false} width={40} />
              <Tooltip content={<ChartTip labels={{ actual: "الوزن (كجم)", projected: "التوقّع (كجم)" }} />} />
              <ReferenceLine y={g.target_weight_kg} stroke="#22c55e" strokeDasharray="4 4" label={{ value: "الهدف", fill: "#22c55e", fontSize: 11, position: "insideTopRight" }} />
              <Line type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
              <Line type="monotone" dataKey="projected" stroke="#a78bfa" strokeWidth={2} strokeDasharray="6 5" dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
        <Card>
          <CardHeader><div><CardTitle className="flex items-center gap-1.5"><TrendingDown className="size-4 text-primary" /> قراءة الاتجاه</CardTitle></div></CardHeader>
          <CardContent className="space-y-3">
            <div className="text-base font-bold leading-snug">{tr.headline}</div>
            <p className="text-sm leading-relaxed text-muted-foreground">{tr.detail}</p>
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <Stat label="الوزن الحالي" value={tr.current != null ? `${tr.current}` : "—"} />
              <Stat label="باقي" value={tr.remaining != null ? `${Math.max(0, tr.remaining)} كجم` : "—"} />
              <Stat label="المعدل/أسبوع" value={tr.ratePerWeek != null ? `${tr.ratePerWeek > 0 ? "+" : ""}${tr.ratePerWeek}` : "—"} />
              <Stat label="دهون/أسبوع" value={tr.fatRatePerWeek != null ? `${tr.fatRatePerWeek > 0 ? "+" : ""}${tr.fatRatePerWeek}` : "—"} />
            </div>
            <div className="rounded-lg border p-3 text-xs">
              <div className="mb-2 flex items-center justify-between font-semibold"><span>🧪 لو التزامي كان…</span><span className="num text-primary">{Math.round(adh * 100)}%</span></div>
              <input type="range" min={50} max={100} step={5} value={Math.round(adh * 100)} onChange={(e) => setScn(Number(e.target.value) / 100)} className="w-full accent-[hsl(var(--primary))]" aria-label="محاكاة نسبة الالتزام" />
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>50%</span><span>التزامك الحالي ≈ {Math.round(baseAdh * 100)}%</span><span>100%</span></div>
              <p className="mt-2 leading-relaxed">{sc.etaDate ? `بمعدل ${sc.scenarioRate} كجم/أسبوع تصل ≈ ${fmt(sc.etaDate, "d MMMM yyyy")}` : sc.scenarioRate == null ? "وصلت الهدف أو البيانات غير كافية." : "بهذا الالتزام التقدّم بطيء جدًا."} <span className="text-muted-foreground">(تقدير تقريبي)</span></p>
              {scn != null && <button type="button" className="mt-1 text-[11px] text-primary hover:underline" onClick={() => setScn(null)}>إعادة للوضع الحالي</button>}
            </div>
            {eb && (
              <div className="rounded-lg bg-muted/50 p-3 text-xs leading-relaxed">
                <div className="mb-1 flex items-center gap-1.5 font-semibold"><Flame className="size-3.5 text-danger" /> ميزان الطاقة (تقدير)</div>
                أكلت ≈ <span className="num font-semibold">{eb.intake}</span> وصرفت ≈ <span className="num font-semibold">{eb.tdee}</span> kcal/يوم → <span className="num font-semibold">{eb.balance > 0 ? "+" : ""}{eb.balance}</span>. تقدير للمتابعة فقط، وهدفك الرسمي {g.calories} kcal.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="التزام الأدوية حسب وقت اليوم" description="آخر 28 يومًا" height={200}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mp.byBucket.map((b) => ({ label: b.label, rate: b.rate == null ? null : Math.round(b.rate * 100) }))} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} /><YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTip labels={{ rate: "الالتزام %" }} digits={0} />} />
              <Bar dataKey="rate" radius={[6, 6, 0, 0]}>{mp.byBucket.map((b) => <Cell key={b.key} fill={(b.rate ?? 1) < 0.8 ? "#ef4444" : "#a78bfa"} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="درجتك حسب يوم الأسبوع" description="متوسط آخر 8 أسابيع" height={200}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={wd.byDay.map((d) => ({ label: d.label, avg: d.avg == null ? null : Math.round(d.avg * 100) }))} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 9 }} /><YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTip labels={{ avg: "الدرجة %" }} digits={0} />} />
              <Bar dataKey="avg" radius={[6, 6, 0, 0]}>{wd.byDay.map((d) => <Cell key={d.day} fill={wd.worst?.day === d.day ? "#f59e0b" : "#3b82f6"} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <Card>
          <CardHeader><div><CardTitle className="flex items-center gap-1.5"><Zap className="size-4 text-warning" /> ما الذي يرفع طاقتك؟</CardTitle><CardDescription>{ec.checkins} تسجيل طاقة</CardDescription></div></CardHeader>
          <CardContent className="space-y-2.5">
            {ec.items.map((c) => (
              <div key={c.label} className="text-xs">
                <div className="flex justify-between"><span>{c.label}</span><span className="num font-semibold">{c.r == null || c.n < 6 ? "—" : c.r.toFixed(2)}</span></div>
                <Progress value={c.r == null || c.n < 6 ? 0 : Math.abs(c.r) * 100} color={c.r != null && c.r < 0 ? "#ef4444" : "#22c55e"} className="h-1.5" />
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">يحتاج 6 أيام مسجّلة على الأقل لكل مقارنة. الارتباط لا يعني السببية.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><div><CardTitle>تقدّم برنامج التمرين</CardTitle><CardDescription>قراءة فقط — النظام لا يغيّر تمارينك أو مجاميعك، وقواعد برنامجك تمنع التعديل قبل 12 أسبوعًا</CardDescription></div>
          <Button asChild variant="ghost" size="sm"><Link href="/workouts">البرنامج</Link></Button></CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-3">
          <div className="flex items-center gap-4">
            <Ring value={Math.min(1, (so.programWeek ?? 0) / 12)} size={96} stroke={9} color="hsl(var(--violet))">
              <span className="num text-xl font-bold">{so.programWeek ?? 0}</span><span className="text-[10px] text-muted-foreground">من 12 أسبوعًا</span>
            </Ring>
            <div className="text-xs leading-relaxed text-muted-foreground">
              {so.programWeek == null ? "ابدأ أول جلسة لتبدأ العدّ." : so.programWeek >= 12 ? "أكملت 12 أسبوعًا — وقت المراجعة." : `متبقي ${12 - so.programWeek} أسابيع على أول مراجعة.`}
              {so.avgRecentRpe != null && <div className="mt-1">متوسط RPE آخر 3 جلسات: <span className="num font-semibold text-foreground">{so.avgRecentRpe}</span></div>}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-xs font-semibold text-success">قوة في صعود ({so.rising.length})</div>
            {so.rising.length ? so.rising.slice(0, 5).map((l) => <Lift key={l.exercise} name={l.exercise} v={`+${l.changePct}%`} cls="text-success" />) : <p className="text-xs text-muted-foreground">لا بيانات كافية (يحتاج 3 جلسات لكل تمرين).</p>}
          </div>
          <div>
            <div className="mb-1.5 text-xs font-semibold text-warning">ثبات / تراجع ({so.stalled.length})</div>
            {so.stalled.length ? so.stalled.slice(0, 5).map((l) => <Lift key={l.exercise} name={l.exercise} v={`${l.changePct > 0 ? "+" : ""}${l.changePct}%`} cls="text-warning" />) : <p className="text-xs text-muted-foreground">لا يوجد 👌</p>}
            {so.deloadSignal && <p className="mt-2 rounded-lg bg-warning/10 p-2 text-[11px] leading-relaxed text-warning">إشارات إجهاد: راجع النوم والبروتين أولًا وناقش أسبوع تخفيف مع مختصّك.</p>}
          </div>
        </CardContent>
      </Card>

      <Card id="review">
        <CardHeader><div><CardTitle className="flex items-center gap-1.5"><Moon className="size-4 text-violet" /> مراجعة اليوم ومعاينة بكرة</CardTitle><CardDescription>اختم يومك في دقيقة</CardDescription></div></CardHeader>
        <CardContent><DayReviewBody /></CardContent>
      </Card>

      <Card>
        <CardHeader><div><CardTitle className="flex items-center gap-1.5"><Trophy className="size-4 text-warning" /> مستواك وأوسمتك</CardTitle><CardDescription>نقاط من درجتك اليومية + الأرقام القياسية + الأسابيع المكتملة</CardDescription></div></CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center gap-5">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/15 text-2xl font-extrabold text-primary num">{prog.level}</div>
            <div className="min-w-[200px] flex-1">
              <div className="flex justify-between text-sm"><span className="font-bold">{prog.title}</span><span className="num text-xs text-muted-foreground">{prog.xp - prog.levelStart} / {prog.levelEnd - prog.levelStart} XP</span></div>
              <Progress value={prog.pct * 100} className="mt-2 h-2.5" />
            </div>
            <div className="flex gap-4 text-center text-xs">
              <div><div className="num text-xl font-bold">{prog.streak}</div><div className="text-muted-foreground">سلسلة حالية 🔥</div></div>
              <div><div className="num text-xl font-bold">{prog.bestStreak}</div><div className="text-muted-foreground">أفضل سلسلة</div></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-5">
            {prog.badges.map((b) => (
              <div key={b.id} className={cn("rounded-lg border p-3 text-center", b.earned ? "border-warning/40 bg-warning/10" : "bg-muted/40")}>
                <div className={cn("text-2xl", !b.earned && "opacity-40 grayscale")}>{b.icon}</div>
                <div className="mt-1 text-xs font-semibold">{b.title}</div>
                <div className="mt-0.5 min-h-[28px] text-[10px] leading-snug text-muted-foreground">{b.desc}</div>
                <Progress value={b.progress * 100} color={b.earned ? "hsl(var(--warning))" : undefined} className="mt-1.5 h-1" />
                <div className="num mt-1 text-[10px] text-muted-foreground">{b.earned ? "تم ✓" : b.detail}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-muted/50 p-2"><div className="num text-sm font-bold">{value}</div><div className="text-[10px] text-muted-foreground">{label}</div></div>;
}
function Lift({ name, v, cls }: { name: string; v: string; cls: string }) {
  return <div className="flex justify-between py-0.5 text-xs"><span className="truncate">{name}</span><span className={cn("num font-semibold", cls)}>{v}</span></div>;
}
