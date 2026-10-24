"use client";
import * as React from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Ban, CheckCheck, ChevronDown, Flame, Info, Plus, Trash2, Wheat } from "lucide-react";
import { useData } from "@/components/providers/data-provider";
import { PageHeader } from "@/components/shared/page-header";
import { DateNav } from "@/components/shared/date-nav";
import { Ring } from "@/components/shared/ring";
import { Stepper } from "@/components/shared/stepper";
import { ChartCard, ChartTip } from "@/components/shared/chart-card";
import { Heatmap } from "@/components/shared/heatmap";
import { Segmented } from "@/components/shared/segmented";
import { Field } from "@/components/shared/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { avg, calcMacros, dayNutrition, foodCompliance, mealCompliance } from "@/lib/analytics";
import {
  DIET_RULES, FOOD_GROUPS, FORBIDDEN_FOODS, GROUP_ORDER, MEALS, MEAL_GUIDE, MEAL_ORDER, MEAL_TARGETS,
} from "@/lib/constants";
import { addDays, daysBetween, fmt, parse, rangeDays, time12, today, uid, weekStart } from "@/lib/dates";
import type { FoodGroup, MealKey, MealLog } from "@/lib/types";
import { cn, fmtNum } from "@/lib/utils";

export default function NutritionPage() {
  const { db, profile } = useData();
  const [date, setDate] = React.useState(today());
  return (
    <div>
      <PageHeader title="التغذية" subtitle={`نظام ${profile.goals.calories} kcal — بدأ ${fmt(profile.goals.plan_start, "d MMMM yyyy")}`} />
      <Tabs defaultValue="today">
        <TabsList>
          <TabsTrigger value="today">اليوم</TabsTrigger>
          <TabsTrigger value="week">الأسبوع</TabsTrigger>
          <TabsTrigger value="month">الشهر</TabsTrigger>
          <TabsTrigger value="guide">دليل النظام</TabsTrigger>
        </TabsList>
        <TabsContent value="today"><TodayTab date={date} setDate={setDate} /></TabsContent>
        <TabsContent value="week"><WeekTab /></TabsContent>
        <TabsContent value="month"><MonthTab /></TabsContent>
        <TabsContent value="guide"><GuideTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ----------------------------------------------------------------------- TODAY ---- */
function TodayTab({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const { db, profile, save, remove } = useData();
  const g = profile.goals;
  const nut = dayNutrition(db.meal_logs, date);
  const comp = foodCompliance(db.meal_logs, date, g);
  const [extraOpen, setExtraOpen] = React.useState(false);
  const [open, setOpen] = React.useState<Record<string, boolean>>({});

  const rows = (meal: MealKey, group: FoodGroup) => db.meal_logs.find((l) => l.date === date && l.meal === meal && l.group === group);

  const setServings = (meal: MealKey, group: FoodGroup, servings: number) => {
    const ex = rows(meal, group);
    if (servings <= 0) { if (ex) remove("meal_logs", ex.id); return; }
    save("meal_logs", { id: ex?.id ?? uid(), date, meal, group, servings, ...calcMacros(group, meal, servings), note: ex?.note ?? "" });
  };
  const eatAsPlanned = (meal: MealKey) => {
    (Object.keys(MEAL_TARGETS[meal]) as FoodGroup[]).forEach((gr) => setServings(meal, gr, MEAL_TARGETS[meal][gr]!));
  };
  const clearMeal = (meal: MealKey) => db.meal_logs.filter((l) => l.date === date && l.meal === meal).forEach((l) => remove("meal_logs", l.id));

  const extras = db.meal_logs.filter((l) => l.date === date && l.group === "extra");
  const kcalPct = nut.kcal / g.calories;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><DateNav date={date} onChange={setDate} /></div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="hero-glow lg:col-span-1">
          <CardContent className="flex flex-col items-center gap-4 pt-6">
            <Ring value={Math.min(1, kcalPct)} size={150} stroke={12} color={kcalPct > 1.1 ? "hsl(var(--warning))" : "#ef4444"}>
              <Flame className="size-5 text-danger" />
              <span className="num text-3xl font-bold">{fmtNum(nut.kcal)}</span>
              <span className="text-[11px] text-muted-foreground">من {g.calories} kcal</span>
            </Ring>
            <div className="grid w-full grid-cols-3 gap-2 text-center">
              <Macro label="بروتين" v={nut.protein} t={g.protein_g} color="#10b981" />
              <Macro label="كربوهيدرات" v={nut.carbs} color="#f59e0b" />
              <Macro label="دهون" v={nut.fat} color="#a78bfa" />
            </div>
            <div className="flex w-full items-center justify-between rounded-lg bg-muted/60 p-3 text-sm">
              <span className="text-muted-foreground">التزام الغذاء</span>
              <span className="num text-lg font-bold">{comp == null ? "—" : `${Math.round(comp * 100)}٪`}</span>
            </div>
            <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
              السعرات والماكروز تقديرية من نظام الحصص (Exchange). الهدف الرسمي {g.calories} kcal حسب الدكتور.
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><div><CardTitle>حصص اليوم</CardTitle><CardDescription>المتناول / المقرر لكل مجموعة غذائية</CardDescription></div></CardHeader>
          <CardContent className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {GROUP_ORDER.filter((gr) => (g.servings[gr] ?? 0) > 0).map((gr) => {
              const t = g.servings[gr]; const v = nut.servings[gr];
              return (
                <div key={gr}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: FOOD_GROUPS[gr].color }} />{FOOD_GROUPS[gr].label}</span>
                    <span className="num text-xs"><b className={cn(v > t && "text-warning")}>{fmtNum(v, 1)}</b> / {t}</span>
                  </div>
                  <Progress value={(v / t) * 100} color={v > t ? "hsl(var(--warning))" : FOOD_GROUPS[gr].color} />
                </div>
              );
            })}
            {extras.length > 0 && (
              <div className="col-span-full rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
                خارج الخطة اليوم: {fmtNum(nut.extraKcal)} kcal — تُخصم من درجة الالتزام.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {MEAL_ORDER.map((meal) => {
          const targets = MEAL_TARGETS[meal];
          const mc = mealCompliance(db.meal_logs, date, meal, targets as Record<FoodGroup, number>);
          const mealRows = db.meal_logs.filter((l) => l.date === date && l.meal === meal && l.group !== "extra");
          const kcal = mealRows.reduce((s, r) => s + r.kcal, 0);
          return (
            <Card key={meal}>
              <CardHeader>
                <div>
                  <CardTitle className="flex items-center gap-2 text-base"><span>{MEALS[meal].icon}</span>{MEALS[meal].label}
                    <span className="num text-xs font-normal text-muted-foreground">{time12(g.meal_times[meal])}</span></CardTitle>
                  <CardDescription><span className="num">{fmtNum(kcal)}</span> kcal{mc != null && <> · التزام <span className="num">{Math.round(mc * 100)}</span>٪</>}</CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="success" onClick={() => eatAsPlanned(meal)}><CheckCheck /> حسب الخطة</Button>
                  {mealRows.length > 0 && <Button size="icon-sm" variant="ghost" onClick={() => clearMeal(meal)} aria-label="مسح الوجبة"><Trash2 /></Button>}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {(Object.keys(targets) as FoodGroup[]).map((gr) => {
                  const cur = rows(meal, gr)?.servings ?? 0;
                  const key = meal + gr;
                  return (
                    <div key={gr} className="rounded-lg bg-muted/40 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <button type="button" className="flex min-w-0 items-center gap-2 text-sm" onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))}>
                          <span className="size-2.5 shrink-0 rounded-full" style={{ background: FOOD_GROUPS[gr].color }} />
                          <span className="truncate font-medium">{FOOD_GROUPS[gr].label}</span>
                          <span className="num text-xs text-muted-foreground">({targets[gr]})</span>
                          <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", open[key] && "rotate-180")} />
                        </button>
                        <Stepper size="sm" value={cur} step={0.5} max={12} onChange={(v) => setServings(meal, gr, v)} format={(v) => String(v)} />
                      </div>
                      {open[key] && MEAL_GUIDE[meal][gr] && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{MEAL_GUIDE[meal][gr]}</p>}
                    </div>
                  );
                })}
                {meal === "snack" && <p className="text-[11px] text-muted-foreground">الوجبات البينية موزعة على مدار اليوم (لبن خالي اللاكتوز + حصة فاكهة).</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <div><CardTitle>أكل خارج الخطة</CardTitle><CardDescription>سجّله بصراحة — يظهر في السعرات ويؤثر على الالتزام</CardDescription></div>
          <Button size="sm" variant="secondary" onClick={() => setExtraOpen(true)}><Plus /> إضافة</Button>
        </CardHeader>
        {extras.length > 0 && (
          <CardContent className="space-y-2">
            {extras.map((e) => (
              <div key={e.id} className="flex items-center gap-3 rounded-lg bg-muted/50 p-2.5 text-sm">
                <span className="flex-1 truncate">{e.note || "غير مسمى"} <span className="text-xs text-muted-foreground">· {MEALS[e.meal].label}</span></span>
                <span className="num text-xs">{fmtNum(e.kcal)} kcal · {fmtNum(e.protein_g)}g</span>
                <Button size="icon-sm" variant="ghost" onClick={() => remove("meal_logs", e.id)} aria-label="حذف"><Trash2 /></Button>
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      <ExtraDialog open={extraOpen} onOpenChange={setExtraOpen} date={date} />
    </div>
  );
}

function Macro({ label, v, t, color }: { label: string; v: number; t?: number; color: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2">
      <div className="num text-lg font-bold" style={{ color }}>{fmtNum(v)}<span className="text-[10px] text-muted-foreground">{t ? ` /${t}` : ""} جم</span></div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function ExtraDialog({ open, onOpenChange, date }: { open: boolean; onOpenChange: (o: boolean) => void; date: string }) {
  const { save } = useData();
  const [name, setName] = React.useState(""); const [kcal, setKcal] = React.useState(""); const [p, setP] = React.useState("");
  const [meal, setMeal] = React.useState<MealKey>("snack");
  const submit = () => {
    const k = Number(kcal);
    if (!k || k <= 0) return;
    const row: MealLog = { id: uid(), date, meal, group: "extra", servings: 0, kcal: k, protein_g: Number(p) || 0, carbs_g: 0, fat_g: 0, note: name.trim() };
    save("meal_logs", row);
    setName(""); setKcal(""); setP(""); onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="أكل خارج الخطة" description="سجّل ما تناولته خارج الحصص المقررة">
        <div className="space-y-3">
          <Field label="الوصف"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: شاورما / بيتزا" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="السعرات (kcal)"><Input type="number" inputMode="decimal" value={kcal} onChange={(e) => setKcal(e.target.value)} /></Field>
            <Field label="بروتين (جم) — اختياري"><Input type="number" inputMode="decimal" value={p} onChange={(e) => setP(e.target.value)} /></Field>
          </div>
          <Segmented value={meal} onChange={setMeal} options={MEAL_ORDER.map((m) => ({ value: m, label: MEALS[m].label }))} className="max-w-full overflow-x-auto" />
          <Button className="w-full" onClick={submit} disabled={!Number(kcal)}>حفظ</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------------ WEEK ---- */
function WeekTab() {
  const { db, profile } = useData();
  const g = profile.goals;
  const [offset, setOffset] = React.useState(0);
  const start = addDays(weekStart(today()), offset * 7);
  const days = daysBetween(start, addDays(start, 6));
  const data = days.map((d) => {
    const n = dayNutrition(db.meal_logs, d);
    const c = foodCompliance(db.meal_logs, d, g);
    return { date: d, label: fmt(d, "EEE"), kcal: n.logged ? Math.round(n.kcal) : null, protein: n.logged ? Math.round(n.protein) : null, comp: c == null ? null : Math.round(c * 100), n };
  });
  const logged = data.filter((d) => d.kcal != null);
  const avgK = avg(logged.map((d) => d.kcal as number));
  const avgP = avg(logged.map((d) => d.protein as number));
  const avgC = avg(logged.filter((d) => d.comp != null).map((d) => d.comp as number));
  const avgServ = (gr: FoodGroup) => avg(logged.map((d) => d.n.servings[gr]));
  const insight = avgK == null ? null : avgK > g.calories * 1.1 ? "متوسط السعرات أعلى من الهدف بأكثر من 10٪." : avgK < g.calories * 0.85 ? "متوسط السعرات أقل من الهدف بشكل ملحوظ — تأكد من إكمال الحصص." : "متوسط السعرات ضمن النطاق المستهدف 👌";
  const proIns = avgP != null && avgP < g.protein_g * 0.9 ? "البروتين أقل من 90٪ من المقرر — راجع حصص اللحوم والألبان." : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Segmented value={offset} onChange={setOffset} options={[{ value: -2, label: "قبل أسبوعين" }, { value: -1, label: "الأسبوع الماضي" }, { value: 0, label: "هذا الأسبوع" }]} />
        <span className="text-xs text-muted-foreground">{fmt(start)} — {fmt(addDays(start, 6))}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="متوسط السعرات" value={fmtNum(avgK)} unit="kcal" />
        <Stat label="متوسط البروتين" value={fmtNum(avgP)} unit="جم" />
        <Stat label="التزام الغذاء" value={avgC == null ? "—" : fmtNum(avgC)} unit="٪" />
        <Stat label="أيام مسجّلة" value={`${logged.length}`} unit="/ 7" />
      </div>
      <ChartCard title="السعرات والالتزام اليومي" description={[insight, proIns].filter(Boolean).join(" ")} height={260}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis yAxisId="k" tickLine={false} axisLine={false} domain={[0, (m: number) => Math.max(m, g.calories + 200)]} />
            <YAxis yAxisId="c" orientation="right" tickLine={false} axisLine={false} domain={[0, 100]} />
            <Tooltip content={<ChartTip labels={{ kcal: "سعرات", comp: "التزام ٪", protein: "بروتين" }} digits={0} />} />
            <ReferenceLine yAxisId="k" y={g.calories} stroke="#ef4444" strokeDasharray="4 4" />
            <Bar yAxisId="k" dataKey="kcal" fill="#ef4444" fillOpacity={0.75} radius={[6, 6, 0, 0]} />
            <Line yAxisId="c" dataKey="comp" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>
      <Card>
        <CardHeader><div><CardTitle>متوسط الحصص مقابل المقرر</CardTitle><CardDescription>على الأيام المسجّلة فقط</CardDescription></div></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GROUP_ORDER.filter((gr) => g.servings[gr] > 0).map((gr) => {
            const v = avgServ(gr);
            return (
              <div key={gr}>
                <div className="mb-1 flex justify-between text-sm"><span>{FOOD_GROUPS[gr].label}</span><span className="num text-xs">{v == null ? "—" : fmtNum(v, 1)} / {g.servings[gr]}</span></div>
                <Progress value={v == null ? 0 : (v / g.servings[gr]) * 100} color={FOOD_GROUPS[gr].color} />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="card-surface p-4"><div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-1"><span className="num text-2xl font-bold">{value}</span>{unit && <span className="text-xs text-muted-foreground">{unit}</span>}</div></div>
  );
}

/* ----------------------------------------------------------------------- MONTH ---- */
function MonthTab() {
  const { db, profile } = useData();
  const g = profile.goals;
  const [back, setBack] = React.useState(0);
  const ref = new Date(); ref.setMonth(ref.getMonth() - back, 1);
  const y = ref.getFullYear(), mo = ref.getMonth();
  const first = `${y}-${String(mo + 1).padStart(2, "0")}-01`;
  const last = new Date(y, mo + 1, 0).getDate();
  const end = `${y}-${String(mo + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  const days = daysBetween(first, end).filter((d) => d <= today());
  const vals: Record<string, number | null> = {};
  const nuts = days.map((d) => ({ d, n: dayNutrition(db.meal_logs, d), c: foodCompliance(db.meal_logs, d, g) }));
  nuts.forEach((x) => (vals[x.d] = x.c));
  const logged = nuts.filter((x) => x.n.logged);
  const good = nuts.filter((x) => x.c != null && x.c >= 0.85).length;
  const weeks: { label: string; kcal: number | null; comp: number | null }[] = [];
  for (let s = weekStart(first); s <= end; s = addDays(s, 7)) {
    const part = nuts.filter((x) => x.d >= s && x.d <= addDays(s, 6) && x.n.logged);
    weeks.push({ label: fmt(s, "d/M"), kcal: avg(part.map((x) => x.n.kcal)), comp: avg(part.filter((x) => x.c != null).map((x) => (x.c as number) * 100)) });
  }
  const monthName = new Intl.DateTimeFormat("ar-EG", { month: "long", year: "numeric" }).format(ref);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Segmented value={back} onChange={setBack} options={[{ value: 2, label: "قبل شهرين" }, { value: 1, label: "الشهر الماضي" }, { value: 0, label: "هذا الشهر" }]} />
        <span className="text-xs text-muted-foreground">{monthName}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="أيام مسجّلة" value={`${logged.length}`} unit={`/ ${days.length}`} />
        <Stat label="متوسط السعرات" value={fmtNum(avg(logged.map((x) => x.n.kcal)))} unit="kcal" />
        <Stat label="متوسط البروتين" value={fmtNum(avg(logged.map((x) => x.n.protein)))} unit="جم" />
        <Stat label="أيام التزام ≥ 85٪" value={`${good}`} />
      </div>
      <ChartCard title="الاتجاه الأسبوعي" description="متوسط السعرات والالتزام لكل أسبوع" height={240}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={weeks} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis yAxisId="k" tickLine={false} axisLine={false} />
            <YAxis yAxisId="c" orientation="right" domain={[0, 100]} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTip labels={{ kcal: "متوسط السعرات", comp: "التزام ٪" }} digits={0} />} />
            <ReferenceLine yAxisId="k" y={g.calories} stroke="#ef4444" strokeDasharray="4 4" />
            <Bar yAxisId="k" dataKey="kcal" fill="#ef4444" fillOpacity={0.7} radius={[6, 6, 0, 0]} />
            <Line yAxisId="c" dataKey="comp" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>
      <Card>
        <CardHeader><div><CardTitle>تقويم الالتزام</CardTitle><CardDescription>كلما كان اللون أقوى كان الالتزام أعلى</CardDescription></div></CardHeader>
        <CardContent><Heatmap weeks={12} values={vals} color="152 60% 48%" /></CardContent>
      </Card>
    </div>
  );
}

/* ----------------------------------------------------------------------- GUIDE ---- */
function GuideTab() {
  const { profile } = useData();
  const g = profile.goals;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><div><CardTitle>الحصص اليومية</CardTitle><CardDescription>{profile.doctor}</CardDescription></div><Wheat className="size-5 text-warning" /></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Box label="السعرات" value={`${g.calories}`} /><Box label="البروتين" value={`${g.protein_g} جم`} />
            {GROUP_ORDER.map((gr) => <Box key={gr} label={FOOD_GROUPS[gr].label} value={String(g.servings[gr])} />)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><div><CardTitle className="text-success">المسموح</CardTitle></div><Info className="size-5 text-success" /></CardHeader>
        <CardContent><ul className="space-y-2 text-sm">{DIET_RULES.map((r) => <li key={r} className="flex gap-2"><CheckCheck className="mt-0.5 size-4 shrink-0 text-success" />{r}</li>)}</ul></CardContent>
      </Card>
      <Card className="lg:col-span-2 border-danger/30">
        <CardHeader><div><CardTitle className="text-danger">الممنوع</CardTitle></div><Ban className="size-5 text-danger" /></CardHeader>
        <CardContent><p className="text-sm leading-relaxed">{FORBIDDEN_FOODS}</p></CardContent>
      </Card>
      {MEAL_ORDER.map((m) => (
        <Card key={m}>
          <CardHeader><div><CardTitle>{MEALS[m].icon} {MEALS[m].label}</CardTitle><CardDescription>بدائل الحصص من الروشتة الغذائية</CardDescription></div></CardHeader>
          <CardContent className="space-y-2.5">
            {(Object.keys(MEAL_GUIDE[m]) as FoodGroup[]).map((gr) => (
              <div key={gr} className="text-sm"><Badge variant="muted" className="mb-1">{FOOD_GROUPS[gr].label} × {MEAL_TARGETS[m][gr]}</Badge><p className="text-xs leading-relaxed text-muted-foreground">{MEAL_GUIDE[m][gr]}</p></div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
const Box = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg bg-muted/50 p-3 text-center"><div className="num text-xl font-bold">{value}</div><div className="text-[11px] text-muted-foreground">{label}</div></div>
);
