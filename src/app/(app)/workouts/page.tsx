"use client";
import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Activity, CheckCircle2, ChevronDown, Dumbbell, Flame, Footprints, History as HistoryIcon, Info, MessageSquare, Play, Plus,
  Timer, Trash2, Trophy, TrendingUp, X,
} from "lucide-react";
import { useData } from "@/components/providers/data-provider";
import { PageHeader } from "@/components/shared/page-header";
import { DateNav } from "@/components/shared/date-nav";
import { ChartCard, ChartTip } from "@/components/shared/chart-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Field } from "@/components/shared/field";
import { Segmented } from "@/components/shared/segmented";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  avg, currentBests, e1RM, exerciseHistory, nextSplit, overloadAdvice, prEvents, volumeLoad, weeklyMuscleSets,
  weeklyWorkoutSeries, workingSets,
} from "@/lib/analytics";
import {
  CYCLE, MUSCLES, SESSION_LABEL, SPECIFIC_WARMUP, SPLITS, SPLIT_ORDER, WARMUP_PROTOCOL, WORKOUT_RULES,
} from "@/lib/constants";
import { addDays, fmt, fmtLong, today, uid, weekStart } from "@/lib/dates";
import type { Exercise, MuscleGroup, SessionKind, SplitKey, WorkoutSession, WorkoutSet } from "@/lib/types";
import { cn, fmtNum } from "@/lib/utils";

const LOWER: MuscleGroup[] = ["quads", "hamstrings", "calves", "adductors"];

export default function WorkoutsPage() {
  return (
    <Suspense fallback={<div className="skeleton h-64" />}>
      <WorkoutsInner />
    </Suspense>
  );
}

function WorkoutsInner() {
  const { db, profile } = useData();
  const params = useSearchParams();
  const wk = weeklyWorkoutSeries(db, 1)[0];
  const g = profile.goals;
  const [tab, setTab] = React.useState(params.get("split") ? "log" : "log");
  return (
    <div>
      <PageHeader title="التمارين" subtitle="Belghamdi Splits — Anterior × Posterior" actions={
        <div className="flex items-center gap-3 rounded-full bg-muted px-4 py-2 text-xs">
          <span>الأسبوع: <b className="num">{wk.sessions}/{g.workouts_per_week}</b> مقاومة</span>
          <span className="h-4 w-px bg-border" />
          <span><b className="num">{wk.cardio}/{g.cardio_days_per_week}</b> كارديو</span>
        </div>
      } />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="log">تسجيل جلسة</TabsTrigger>
          <TabsTrigger value="history">السجل</TabsTrigger>
          <TabsTrigger value="progress">التقدم والأرقام القياسية</TabsTrigger>
          <TabsTrigger value="plan">البرنامج</TabsTrigger>
        </TabsList>
        <TabsContent value="log"><LogTab initialSplit={params.get("split")} /></TabsContent>
        <TabsContent value="history"><HistoryTab /></TabsContent>
        <TabsContent value="progress"><ProgressTab /></TabsContent>
        <TabsContent value="plan"><PlanTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------------------------------------------------- LOG ---- */
function LogTab({ initialSplit }: { initialSplit: string | null }) {
  const { db, save } = useData();
  const suggested = nextSplit(db);
  const startKind: SessionKind = (SPLIT_ORDER.includes(initialSplit as SplitKey) ? initialSplit : suggested.split === "rest" ? "anterior_a" : suggested.split) as SessionKind;
  const [date, setDate] = React.useState(today());
  const [kind, setKind] = React.useState<SessionKind>(startKind);
  const session = db.sessions.find((s) => s.date === date && s.kind === kind);

  const start = () => {
    save("sessions", { id: uid(), date, kind, status: "in_progress", started_at: new Date().toISOString(), duration_min: null, notes: "" });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateNav date={date} onChange={setDate} />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="size-3.5" />
          {suggested.split === "rest" ? "اليوم: راحة حسب الدورة" : `المقترح: ${SPLITS[suggested.split].en}`} — {suggested.reason}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {SPLIT_ORDER.map((s) => (
          <button key={s} onClick={() => setKind(s)}
            className={cn("shrink-0 rounded-xl border px-4 py-2.5 text-start transition-all", kind === s ? "border-primary bg-primary/10 shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]" : "hover:bg-muted")}>
            <div className="text-sm font-semibold">{SPLITS[s].en}</div>
            <div className="text-[11px] text-muted-foreground">{SPLITS[s].label}</div>
          </button>
        ))}
        <button onClick={() => setKind("cardio")}
          className={cn("shrink-0 rounded-xl border px-4 py-2.5 text-start transition-all", kind === "cardio" ? "border-primary bg-primary/10" : "hover:bg-muted")}>
          <div className="flex items-center gap-1.5 text-sm font-semibold"><Footprints className="size-4" /> كارديو</div>
          <div className="text-[11px] text-muted-foreground">مشي / Walk at home</div>
        </button>
      </div>

      {kind === "cardio" ? (
        <CardioLogger date={date} />
      ) : !session ? (
        <Card className="hero-glow">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary"><Dumbbell className="size-7" /></div>
            <div className="text-xl font-bold">{SPLITS[kind as SplitKey].en}</div>
            <p className="max-w-md text-sm text-muted-foreground">{SPLITS[kind as SplitKey].focus}</p>
            <Button size="lg" onClick={start}><Play /> ابدأ الجلسة</Button>
            <p className="max-w-md text-[11px] text-muted-foreground">سيُظهر التطبيق توصية الحمل التدريجي لكل تمرين بناءً على آخر جلسة.</p>
          </CardContent>
        </Card>
      ) : (
        <SessionLogger key={session.id} session={session} kind={kind as SplitKey} />
      )}
    </div>
  );
}

function CardioLogger({ date }: { date: string }) {
  const { db, save, remove } = useData();
  const [minutes, setMinutes] = React.useState("30");
  const [type, setType] = React.useState("مشي 2 ميل");
  const list = db.sessions.filter((s) => s.kind === "cardio" && s.date === date);
  const add = () => {
    const m = Number(minutes);
    if (!m) return;
    save("sessions", { id: uid(), date, kind: "cardio", status: "completed", started_at: new Date().toISOString(), duration_min: m, notes: type });
  };
  const weekStartD = weekStart(date);
  const weekCount = db.sessions.filter((s) => s.kind === "cardio" && s.date >= weekStartD && s.date <= addDays(weekStartD, 6)).length;
  return (
    <Card>
      <CardHeader><div><CardTitle>كارديو للحرق</CardTitle><CardDescription>Walk at home (YouTube) أو مشي 2 ميل (30 دقيقة) — 5 أيام أسبوعيًا · هذا الأسبوع {weekCount}</CardDescription></div></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="النوع"><Select value={type} onChange={(e) => setType(e.target.value)}>
            <option>مشي 2 ميل</option><option>Walk at home (YouTube)</option><option>أخرى</option></Select></Field>
          <Field label="المدة (دقيقة)"><Input type="number" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} /></Field>
          <div className="flex items-end"><Button className="w-full" onClick={add}><Plus /> تسجيل</Button></div>
        </div>
        {list.map((s) => (
          <div key={s.id} className="flex items-center gap-3 rounded-lg bg-muted/50 p-3 text-sm">
            <CheckCircle2 className="size-4 text-success" /><span className="flex-1">{s.notes} — <span className="num">{s.duration_min}</span> دقيقة</span>
            <Button size="icon-sm" variant="ghost" onClick={() => remove("sessions", s.id)} aria-label="حذف"><Trash2 /></Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SessionLogger({ session, kind }: { session: WorkoutSession; kind: SplitKey }) {
  const { db, save, remove, removeMany } = useData();
  const exercises = React.useMemo(() => db.exercises.filter((e) => e.split === kind).sort((a, b) => a.sort - b.sort), [db.exercises, kind]);
  const sets = db.sets.filter((s) => s.session_id === session.id);
  const done = session.status === "completed";
  const [warmOpen, setWarmOpen] = React.useState(false);
  const [notes, setNotes] = React.useState(session.notes);
  const [rest, setRest] = React.useState<{ end: number; total: number } | null>(null);

  const totalPlanned = exercises.reduce((s, e) => s + e.work_sets, 0);
  const workDone = workingSets(sets).length;
  const vol = volumeLoad(sets);

  const finish = () => {
    const mins = Math.max(1, Math.round((Date.now() - new Date(session.started_at).getTime()) / 60000));
    save("sessions", { ...session, status: "completed", duration_min: Math.min(mins, 240), notes });
  };
  const reopen = () => save("sessions", { ...session, status: "in_progress" });
  const discard = () => {
    if (!confirm("حذف هذه الجلسة وكل مجموعاتها؟")) return;
    removeMany("sets", sets.map((s) => s.id));
    remove("sessions", session.id);
  };

  return (
    <div className="space-y-4">
      <Card className={cn(done && "border-success/40")}>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-5">
          <div>
            <div className="flex items-center gap-2 text-lg font-bold">{SPLITS[kind].en}
              <Badge variant={done ? "success" : "default"}>{done ? "مكتملة" : "جارية"}</Badge></div>
            <div className="mt-1 text-xs text-muted-foreground">{fmtLong(session.date)}{session.duration_min ? ` · ${session.duration_min} دقيقة` : ""}</div>
          </div>
          <div className="flex items-center gap-5 text-center">
            <div><div className="num text-xl font-bold">{workDone}<span className="text-xs text-muted-foreground">/{totalPlanned}</span></div><div className="text-[11px] text-muted-foreground">مجموعات</div></div>
            <div><div className="num text-xl font-bold">{fmtNum(vol)}</div><div className="text-[11px] text-muted-foreground">Volume Load</div></div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setWarmOpen((o) => !o)}><Flame /> التسخين</Button>
            {done ? <Button variant="secondary" size="sm" onClick={reopen}>إعادة فتح</Button> : <Button size="sm" variant="success" onClick={finish}><CheckCircle2 /> إنهاء</Button>}
            <Button variant="ghost" size="icon-sm" onClick={discard} aria-label="حذف الجلسة"><Trash2 /></Button>
          </div>
          <Progress value={totalPlanned ? (workDone / totalPlanned) * 100 : 0} className="basis-full" />
        </CardContent>
      </Card>

      {warmOpen && (
        <Card>
          <CardHeader><CardTitle>بروتوكول التسخين (أقل من 10 دقائق)</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">{WARMUP_PROTOCOL.map((w) => <div key={w.name} className="flex justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm"><span>{w.name}</span><span className="text-muted-foreground">{w.reps}</span></div>)}</div>
            <div className="space-y-1.5">{SPECIFIC_WARMUP.map((w) => <div key={w.type} className="rounded-lg bg-muted/50 px-3 py-2 text-sm"><b>{w.type}</b><div className="text-xs text-muted-foreground">{w.sets}</div></div>)}</div>
            <ul className="space-y-1 text-xs text-muted-foreground md:col-span-2">{WORKOUT_RULES.map((r) => <li key={r}>• {r}</li>)}</ul>
          </CardContent>
        </Card>
      )}

      {exercises.map((ex) => (
        <ExerciseCard key={ex.id} ex={ex} session={session} sets={sets.filter((s) => s.exercise_id === ex.id)} locked={false} onSetSaved={(restMin) => restMin && setRest({ end: Date.now() + restMin * 60000, total: restMin * 60 })} />
      ))}

      <Card>
        <CardContent className="pt-5">
          <Field label="ملاحظات الجلسة"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== session.notes && save("sessions", { ...session, notes })} placeholder="الإحساس العام، الإصابات، التعديلات…" /></Field>
        </CardContent>
      </Card>

      {rest && <RestTimer end={rest.end} total={rest.total} onClose={() => setRest(null)} />}
    </div>
  );
}

function RestTimer({ end, total, onClose }: { end: number; total: number; onClose: () => void }) {
  const [left, setLeft] = React.useState(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
  React.useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000))), 500);
    return () => clearInterval(id);
  }, [end]);
  React.useEffect(() => { if (left === 0) { try { navigator.vibrate?.([200, 100, 200]); } catch { /* ignore */ } } }, [left]);
  const m = Math.floor(left / 60), s = left % 60;
  return (
    <div className="glass fixed bottom-24 start-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full px-4 py-2.5 shadow-2xl rtl:translate-x-1/2 md:bottom-6">
      <Timer className={cn("size-4", left === 0 ? "text-success" : "text-primary animate-pulse")} />
      <span className="num w-12 text-center text-lg font-bold">{m}:{String(s).padStart(2, "0")}</span>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${(1 - left / total) * 100}%` }} /></div>
      <span className="text-xs text-muted-foreground">{left === 0 ? "جاهز للمجموعة التالية" : "راحة"}</span>
      <button onClick={onClose} aria-label="إغلاق" className="rounded-full p-1 hover:bg-muted"><X className="size-4" /></button>
    </div>
  );
}

function ExerciseCard({ ex, session, sets, locked, onSetSaved }: {
  ex: Exercise; session: WorkoutSession; sets: WorkoutSet[]; locked: boolean; onSetSaved: (restMin: number | null) => void;
}) {
  const { db, save, remove } = useData();
  const [showNotes, setShowNotes] = React.useState(false);
  const lower = LOWER.includes(ex.muscle);
  const advice = React.useMemo(() => overloadAdvice(db, ex.name, ex.rep_min, ex.rep_max, ex.work_sets, lower), [db, ex, lower]);
  const hist = React.useMemo(() => exerciseHistory(db, ex.name).filter((h) => h.session_id !== session.id), [db, ex.name, session.id]);
  const last = hist[hist.length - 1];
  const sorted = [...sets].sort((a, b) => a.set_no - b.set_no);
  const work = workingSets(sorted).length;

  const addSet = (warm = false) => {
    const prev = [...sorted].reverse().find((s) => s.is_warmup === warm) ?? undefined;
    const lastMatch = last?.sets[Math.min(work, last.sets.length - 1)];
    const weight = warm ? Math.round(((last?.topSet.weight_kg ?? advice.targetWeight ?? 0) * 0.6) / 2.5) * 2.5 : prev?.weight_kg ?? advice.targetWeight ?? lastMatch?.weight_kg ?? 0;
    const row: WorkoutSet = {
      id: uid(), session_id: session.id, date: session.date, exercise_id: ex.id, exercise_name: ex.name, muscle: ex.muscle,
      set_no: (sorted[sorted.length - 1]?.set_no ?? 0) + 1, weight_kg: weight,
      reps: warm ? 5 : prev?.reps ?? advice.targetReps ?? ex.rep_min, rir: warm ? null : prev?.rir ?? 2, rpe: warm ? null : prev?.rpe ?? 8, is_warmup: warm, notes: "",
    };
    save("sets", row);
  };

  const topNow = sorted.length ? Math.max(0, ...workingSets(sorted).map((s) => e1RM(s.weight_kg, s.reps, s.rir))) : 0;
  const isPR = last && topNow > last.e1rm + 0.01 && hist.every((h) => topNow > h.e1rm);

  return (
    <Card className={cn(work >= ex.work_sets && "border-success/30")}>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            {ex.name}
            <Badge variant="muted" style={{ color: MUSCLES[ex.muscle].color }}>{MUSCLES[ex.muscle].label}</Badge>
            {isPR && <Badge variant="warning"><Trophy className="size-3" /> رقم قياسي!</Badge>}
          </CardTitle>
          <CardDescription>
            <span className="num">{ex.work_sets}</span> مجموعة × <span className="num">{ex.rep_min}–{ex.rep_max}</span> عدات
            {ex.rest_min ? <> · راحة <span className="num">{ex.rest_min}–{ex.rest_max}</span> د</> : null}
            {ex.warmup_sets !== "0" && <> · تسخين {ex.warmup_sets}</>}
          </CardDescription>
        </div>
        <div className="num shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">{work}/{ex.work_sets}</div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className={cn("flex items-start gap-2 rounded-lg p-2.5 text-xs", advice.status === "increase" ? "bg-success/12 text-success" : "bg-primary/10 text-primary")}>
          <TrendingUp className="mt-0.5 size-3.5 shrink-0" /><span className="leading-relaxed">{advice.text}</span>
        </div>
        {last && (
          <div className="text-[11px] text-muted-foreground">
            آخر مرة ({fmt(last.date)}): {last.sets.map((s) => `${s.weight_kg}×${s.reps}`).join(" · ")}
          </div>
        )}
        {ex.notes && <p className="text-[11px] leading-relaxed text-muted-foreground">💡 {ex.notes}</p>}
        {(ex.alt1 || ex.alt2) && <p className="text-[11px] text-muted-foreground">البدائل: {[ex.alt1, ex.alt2].filter(Boolean).join(" · ")}</p>}

        {sorted.length > 0 && (
          <div className="space-y-1.5">
            <div className="grid grid-cols-[28px_1fr_1fr_52px_52px_auto] items-center gap-1.5 px-1 text-[10px] text-muted-foreground sm:grid-cols-[32px_1fr_1fr_64px_64px_auto]">
              <span>#</span><span>الوزن كجم</span><span>العدات</span><span>RIR</span><span>RPE</span><span className="w-16" />
            </div>
            {sorted.map((s, i) => (
              <SetRow key={s.id} set={s} index={i + 1} showNotes={showNotes} onChange={(row, justAdded) => { save("sets", row); if (justAdded && !row.is_warmup) onSetSaved(ex.rest_min); }} onDelete={() => remove("sets", s.id)} />
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => { addSet(false); onSetSaved(sorted.length ? ex.rest_min : null); }} disabled={locked}><Plus /> مجموعة</Button>
          {ex.warmup_sets !== "0" && <Button size="sm" variant="ghost" onClick={() => addSet(true)}><Flame /> تسخين</Button>}
          <Button size="sm" variant="ghost" onClick={() => setShowNotes((n) => !n)}><MessageSquare /> ملاحظات</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SetRow({ set, index, showNotes, onChange, onDelete }: {
  set: WorkoutSet; index: number; showNotes: boolean; onChange: (s: WorkoutSet, justAdded?: boolean) => void; onDelete: () => void;
}) {
  const [w, setW] = React.useState(String(set.weight_kg));
  const [r, setR] = React.useState(String(set.reps));
  const [rir, setRir] = React.useState(set.rir == null ? "" : String(set.rir));
  const [rpe, setRpe] = React.useState(set.rpe == null ? "" : String(set.rpe));
  const [note, setNote] = React.useState(set.notes);
  const commit = (patch: Partial<WorkoutSet> = {}) => {
    const next: WorkoutSet = {
      ...set, weight_kg: Number(w) || 0, reps: Math.max(0, Math.round(Number(r) || 0)),
      rir: rir === "" ? null : Number(rir), rpe: rpe === "" ? null : Number(rpe), notes: note, ...patch,
    };
    if (JSON.stringify(next) !== JSON.stringify(set)) onChange(next);
  };
  const e = e1RM(Number(w) || 0, Number(r) || 0, rir === "" ? null : Number(rir));
  const cell = "h-9 px-2 text-center text-sm";
  return (
    <div className={cn("rounded-lg", set.is_warmup && "opacity-70")}>
      <div className="grid grid-cols-[28px_1fr_1fr_52px_52px_auto] items-center gap-1.5 sm:grid-cols-[32px_1fr_1fr_64px_64px_auto]">
        <button type="button" onClick={() => commit({ is_warmup: !set.is_warmup })} title="تبديل تسخين/عمل"
          className={cn("num flex size-7 items-center justify-center rounded-full text-xs font-bold", set.is_warmup ? "bg-warning/20 text-warning" : "bg-primary/15 text-primary")}>
          {set.is_warmup ? "W" : index}
        </button>
        <Input className={cell} type="number" inputMode="decimal" step="0.5" min="0" value={w} onChange={(ev) => setW(ev.target.value)} onBlur={() => commit()} aria-label="الوزن" />
        <Input className={cell} type="number" inputMode="numeric" min="0" value={r} onChange={(ev) => setR(ev.target.value)} onBlur={() => commit()} aria-label="العدات" />
        <Input className={cell} type="number" inputMode="numeric" min="0" max="6" placeholder="—" value={rir} onChange={(ev) => setRir(ev.target.value)} onBlur={() => commit()} aria-label="RIR" />
        <Input className={cell} type="number" inputMode="decimal" min="5" max="10" step="0.5" placeholder="—" value={rpe} onChange={(ev) => setRpe(ev.target.value)} onBlur={() => commit()} aria-label="RPE" />
        <div className="flex w-16 items-center justify-end gap-1">
          {!set.is_warmup && e > 0 && <span className="num hidden text-[10px] text-muted-foreground sm:inline" title="1RM تقديري">~{Math.round(e)}</span>}
          <button type="button" onClick={onDelete} className="rounded p-1 text-muted-foreground hover:text-danger" aria-label="حذف المجموعة"><Trash2 className="size-3.5" /></button>
        </div>
      </div>
      {showNotes && <Input className="mt-1 h-8 text-xs" placeholder="ملاحظة على المجموعة…" value={note} onChange={(ev) => setNote(ev.target.value)} onBlur={() => commit()} />}
    </div>
  );
}

/* --------------------------------------------------------------------- HISTORY ---- */
function HistoryTab() {
  const { db, remove, removeMany } = useData();
  const [open, setOpen] = React.useState<string | null>(null);
  const list = [...db.sessions].sort((a, b) => b.date.localeCompare(a.date) || b.started_at.localeCompare(a.started_at));
  if (!list.length) return <EmptyState icon={<HistoryIcon className="size-5" />} title="لا توجد جلسات بعد" hint="ابدأ أول جلسة من تبويب «تسجيل جلسة»." />;
  return (
    <div className="space-y-2">
      {list.map((s) => {
        const sets = db.sets.filter((x) => x.session_id === s.id);
        const byEx = new Map<string, WorkoutSet[]>();
        sets.forEach((x) => byEx.set(x.exercise_name, [...(byEx.get(x.exercise_name) ?? []), x]));
        const isOpen = open === s.id;
        return (
          <Card key={s.id}>
            <button className="flex w-full items-center gap-3 p-4 text-start" onClick={() => setOpen(isOpen ? null : s.id)}>
              <div className={cn("flex size-10 items-center justify-center rounded-xl", s.kind === "cardio" ? "bg-success/15 text-success" : "bg-primary/15 text-primary")}>
                {s.kind === "cardio" ? <Footprints className="size-5" /> : <Dumbbell className="size-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{SESSION_LABEL[s.kind]} <Badge variant={s.status === "completed" ? "success" : "warning"} className="ms-1">{s.status === "completed" ? "مكتملة" : "غير مكتملة"}</Badge></div>
                <div className="text-xs text-muted-foreground">{fmtLong(s.date)}{s.duration_min ? ` · ${s.duration_min} د` : ""}{sets.length ? ` · ${workingSets(sets).length} مجموعة · ${fmtNum(volumeLoad(sets))} كجم` : ""}</div>
              </div>
              <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
            </button>
            {isOpen && (
              <CardContent className="space-y-3 border-t pt-4">
                {[...byEx.entries()].map(([name, ss]) => (
                  <div key={name} className="text-sm"><div className="font-medium">{name}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">{ss.sort((a, b) => a.set_no - b.set_no).map((x) => (
                      <span key={x.id} className={cn("num rounded-md bg-muted px-2 py-0.5 text-xs", x.is_warmup && "opacity-60")}>{x.weight_kg}×{x.reps}{x.rir != null ? ` @${x.rir}RIR` : ""}</span>))}</div></div>
                ))}
                {s.notes && s.kind !== "cardio" && <p className="text-xs text-muted-foreground">📝 {s.notes}</p>}
                <Button variant="danger" size="sm" onClick={() => { if (confirm("حذف هذه الجلسة؟")) { removeMany("sets", sets.map((x) => x.id)); remove("sessions", s.id); } }}><Trash2 /> حذف الجلسة</Button>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------- PROGRESS ---- */
function ProgressTab() {
  const { db } = useData();
  const bests = React.useMemo(() => currentBests(db), [db]);
  const prs = React.useMemo(() => prEvents(db), [db]);
  const names = bests.map((b) => b.exercise);
  const [sel, setSel] = React.useState<string>("");
  const exName = sel || names[0] || "";
  const hist = exerciseHistory(db, exName);
  const weeks = weeklyWorkoutSeries(db, 12);
  const [wOff, setWOff] = React.useState(0);
  const ws = addDays(weekStart(today()), wOff * 7);
  const mus = weeklyMuscleSets(db, ws);

  if (!db.sets.length) return <EmptyState icon={<Activity className="size-5" />} title="لا توجد بيانات تمرين بعد" hint="سجّل مجموعاتك لتظهر الأرقام القياسية والاتجاهات والحمل التدريجي." />;

  const chart = hist.map((h) => ({ label: fmt(h.date, "d/M"), e1rm: Math.round(h.e1rm * 10) / 10, weight: h.bestWeight, volume: Math.round(h.volume), rpe: h.avgRpe }));
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><div><CardTitle className="flex items-center gap-2"><Trophy className="size-4 text-warning" /> أحدث الأرقام القياسية</CardTitle><CardDescription>1RM تقديري (Epley + RIR)</CardDescription></div></CardHeader>
          <CardContent className="space-y-2">
            {prs.slice(0, 6).map((p) => (
              <div key={p.exercise + p.date} className="flex items-center gap-3 rounded-lg bg-warning/10 p-2.5 text-sm">
                <Trophy className="size-4 text-warning" />
                <div className="min-w-0 flex-1"><div className="truncate font-medium">{p.exercise}</div><div className="text-[11px] text-muted-foreground">{fmt(p.date)} · {p.weight}×{p.reps}</div></div>
                <div className="text-end"><div className="num font-bold">{fmtNum(p.e1rm, 1)}</div><div className="num text-[10px] text-success">+{fmtNum(p.e1rm - p.previous, 1)}</div></div>
              </div>
            ))}
            {!prs.length && <p className="text-sm text-muted-foreground">لا أرقام قياسية جديدة بعد — تحتاج جلستين على الأقل لنفس التمرين.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>PR Tracker — أفضل أداء لكل تمرين</CardTitle></div></CardHeader>
          <CardContent className="max-h-[22rem] space-y-1.5 overflow-y-auto">
            {bests.map((b) => (
              <div key={b.exercise} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/50">
                <span className="min-w-0 truncate">{b.exercise}</span>
                <span className="num shrink-0 text-xs text-muted-foreground">{b.weight}×{b.reps} · <b className="text-foreground">~{Math.round(b.e1rm)}</b> 1RM</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <ChartCard title="تقدم القوة" description="1RM التقديري وأعلى وزن لكل جلسة" height={260}
        right={<Select className="h-8 w-52 text-xs" value={exName} onChange={(e) => setSel(e.target.value)}>{names.map((n) => <option key={n}>{n}</option>)}</Select>}>
        {chart.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chart} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} domain={["dataMin - 5", "dataMax + 5"]} />
              <Tooltip content={<ChartTip labels={{ e1rm: "1RM تقديري", weight: "أعلى وزن" }} unit=" كجم" />} />
              <Line type="monotone" dataKey="e1rm" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="weight" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : <p className="text-sm text-muted-foreground">لا بيانات</p>}
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="الحجم الأسبوعي (Weekly Volume)" description="Volume Load وعدد المجموعات" height={240}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={weeks} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis yAxisId="v" tickLine={false} axisLine={false} />
              <YAxis yAxisId="s" orientation="right" tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTip labels={{ volume: "Volume Load", sets: "مجموعات" }} digits={0} />} />
              <Bar yAxisId="v" dataKey="volume" fill="#f59e0b" fillOpacity={0.8} radius={[6, 6, 0, 0]} />
              <Line yAxisId="s" dataKey="sets" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="اتجاه الجهد (RPE)" description="متوسط RPE الأسبوعي — فوق 9 باستمرار = إرهاق" height={240}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={weeks.map((w) => ({ ...w, avgRpe: w.avgRpe == null ? null : Math.round(w.avgRpe * 10) / 10 }))} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis domain={[5, 10]} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTip labels={{ avgRpe: "متوسط RPE" }} />} />
              <Line type="monotone" dataKey="avgRpe" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <Card>
        <CardHeader>
          <div><CardTitle>حجم كل عضلة (مجموعات عمل/أسبوع)</CardTitle><CardDescription>النطاق المستهدف مظلل — {fmt(ws)} إلى {fmt(addDays(ws, 6))}</CardDescription></div>
          <Segmented value={wOff} onChange={setWOff} options={[{ value: -1, label: "الماضي" }, { value: 0, label: "الحالي" }]} />
        </CardHeader>
        <CardContent className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {(Object.keys(MUSCLES) as MuscleGroup[]).map((k) => {
            const m = MUSCLES[k]; const v = mus[k];
            const status = v.sets === 0 ? "none" : v.sets < m.weeklySetsMin ? "low" : v.sets > m.weeklySetsMax ? "high" : "ok";
            return (
              <div key={k}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: m.color }} />{m.label}</span>
                  <span className="num text-xs text-muted-foreground"><b className={cn("text-foreground", status === "low" && "text-warning", status === "high" && "text-danger")}>{v.sets}</b> مجموعة · {fmtNum(v.volume)} كجم</span>
                </div>
                <div className="relative h-2 rounded-full bg-muted">
                  <div className="absolute inset-y-0 rounded-full bg-success/20" style={{ insetInlineStart: `${(m.weeklySetsMin / 24) * 100}%`, width: `${((m.weeklySetsMax - m.weeklySetsMin) / 24) * 100}%` }} />
                  <div className="absolute inset-y-0 start-0 rounded-full" style={{ width: `${Math.min(100, (v.sets / 24) * 100)}%`, background: m.color }} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div><CardTitle>الحمل التدريجي — توصيات الجلسة القادمة</CardTitle><CardDescription>Double Progression: أعلى المدى على كل المجموعات ← ارفع الوزن</CardDescription></div></CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2">
          {db.exercises.filter((e, i, a) => a.findIndex((x) => x.name === e.name) === i).sort((a, b) => a.name.localeCompare(b.name)).map((e) => {
            if (!exerciseHistory(db, e.name).length) return null;
            const adv = overloadAdvice(db, e.name, e.rep_min, e.rep_max, e.work_sets, LOWER.includes(e.muscle));
            return (
              <div key={e.id} className="rounded-lg bg-muted/50 p-3 text-sm">
                <div className="flex items-center justify-between"><b>{e.name}</b><Badge variant={adv.status === "increase" ? "success" : adv.status === "hold" ? "warning" : "default"}>{adv.status === "increase" ? "ارفع الوزن" : adv.status === "hold" ? "ثبّت" : "زد عدات"}</Badge></div>
                <p className="mt-1 text-xs text-muted-foreground">{adv.text}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------------ PLAN ---- */
function PlanTab() {
  const { db } = useData();
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><div><CardTitle>دورة الأيام</CardTitle><CardDescription>Anterior A ← Posterior A ← راحة ← Anterior B ← Posterior B ← راحة ← راحة</CardDescription></div></CardHeader>
        <CardContent>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {CYCLE.map((c, i) => (
              <div key={i} className={cn("min-w-20 shrink-0 rounded-xl border p-3 text-center", c === "rest" ? "bg-muted/40 text-muted-foreground" : "bg-primary/10 border-primary/30")}>
                <div className="num text-[10px] text-muted-foreground">يوم {i + 1}</div>
                <div className="text-xs font-semibold">{c === "rest" ? "راحة" : SPLITS[c].en}</div>
              </div>
            ))}
          </div>
          <ul className="mt-4 space-y-1 text-xs text-muted-foreground">{WORKOUT_RULES.map((r) => <li key={r}>• {r}</li>)}</ul>
        </CardContent>
      </Card>
      {SPLIT_ORDER.map((s) => (
        <Card key={s}>
          <CardHeader><div><CardTitle>{SPLITS[s].en} — {SPLITS[s].label}</CardTitle><CardDescription>{SPLITS[s].focus}</CardDescription></div></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="text-xs text-muted-foreground"><th className="py-1 text-start font-medium">التمرين</th><th className="font-medium">تسخين</th><th className="font-medium">مجموعات</th><th className="font-medium">عدات</th><th className="font-medium">راحة</th><th className="text-start font-medium">البدائل</th></tr></thead>
              <tbody>
                {db.exercises.filter((e) => e.split === s).sort((a, b) => a.sort - b.sort).map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="py-2 font-medium">{e.name}</td>
                    <td className="num text-center">{e.warmup_sets}</td><td className="num text-center">{e.work_sets}</td>
                    <td className="num text-center">{e.rep_min}–{e.rep_max}</td><td className="num text-center">{e.rest_min ? `${e.rest_min}–${e.rest_max}د` : "—"}</td>
                    <td className="text-xs text-muted-foreground">{[e.alt1, e.alt2].filter(Boolean).join(" · ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}
      <p className="text-center text-[11px] text-muted-foreground">المصدر: برنامج Belghamdi Splits — حقوق النشر 2024 لـ Bassam El Ghamdi.</p>
    </div>
  );
}
