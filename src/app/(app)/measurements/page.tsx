"use client";
import * as React from "react";
import { CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Area } from "recharts";
import { Activity, Droplets, Flame, Gauge, Pencil, Plus, Ruler, Scale, Trash2, Dumbbell } from "lucide-react";
import { useData } from "@/components/providers/data-provider";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { ChartCard, ChartTip } from "@/components/shared/chart-card";
import { Segmented } from "@/components/shared/segmented";
import { Field } from "@/components/shared/field";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Textarea, Select } from "@/components/ui/input";
import { movingAvg, sortedMeasurements, latestValue, round } from "@/lib/analytics";
import { diffDays, fmt, fmtShort, today, uid } from "@/lib/dates";
import type { Measurement } from "@/lib/types";

type MetricKey = "weight_kg" | "body_fat_pct" | "muscle_mass_kg" | "waist_cm" | "chest_cm" | "arm_cm" | "thigh_cm";
const METRICS: { key: MetricKey; label: string; unit: string; color: string; good: "up" | "down" | "neutral" }[] = [
  { key: "weight_kg", label: "الوزن", unit: "كجم", color: "hsl(var(--primary))", good: "neutral" },
  { key: "body_fat_pct", label: "نسبة الدهون", unit: "%", color: "#f59e0b", good: "down" },
  { key: "muscle_mass_kg", label: "الكتلة العضلية", unit: "كجم", color: "#22c55e", good: "up" },
  { key: "waist_cm", label: "الخصر", unit: "سم", color: "#ef4444", good: "down" },
  { key: "chest_cm", label: "الصدر", unit: "سم", color: "#8b5cf6", good: "up" },
  { key: "arm_cm", label: "الذراع", unit: "سم", color: "#06b6d4", good: "up" },
  { key: "thigh_cm", label: "الفخذ", unit: "سم", color: "#ec4899", good: "up" },
];

const FIELDS: { key: keyof Measurement; label: string; step: string; adv?: boolean }[] = [
  { key: "weight_kg", label: "الوزن (كجم)", step: "0.1" },
  { key: "waist_cm", label: "محيط الخصر (سم)", step: "0.1" },
  { key: "chest_cm", label: "محيط الصدر (سم)", step: "0.1" },
  { key: "arm_cm", label: "محيط الذراع (سم)", step: "0.1" },
  { key: "thigh_cm", label: "محيط الفخذ (سم)", step: "0.1" },
  { key: "body_fat_pct", label: "نسبة الدهون %", step: "0.1" },
  { key: "muscle_mass_kg", label: "الكتلة العضلية SMM (كجم)", step: "0.1" },
  { key: "fat_mass_kg", label: "كتلة الدهون (كجم)", step: "0.1", adv: true },
  { key: "bmi", label: "BMI", step: "0.1", adv: true },
  { key: "bmr", label: "BMR (kcal)", step: "1", adv: true },
  { key: "visceral_fat", label: "الدهون الحشوية", step: "1", adv: true },
  { key: "body_water_l", label: "ماء الجسم (لتر)", step: "0.1", adv: true },
  { key: "inbody_score", label: "درجة InBody", step: "1", adv: true },
];

const blank = (): Measurement => ({
  id: uid(), date: today(), source: "manual", weight_kg: null, waist_cm: null, chest_cm: null, arm_cm: null, thigh_cm: null,
  body_fat_pct: null, muscle_mass_kg: null, fat_mass_kg: null, bmi: null, bmr: null, visceral_fat: null, body_water_l: null, inbody_score: null, notes: "",
});

function MeasurementDialog({ open, onOpenChange, initial, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; initial: Measurement; onSave: (m: Measurement) => void }) {
  const [m, setM] = React.useState<Measurement>(initial);
  const [showAdv, setShowAdv] = React.useState(false);
  React.useEffect(() => { if (open) { setM(initial); setShowAdv(initial.source === "inbody" || FIELDS.some((f) => f.adv && initial[f.key] != null)); } }, [open, initial]);
  const num = (k: keyof Measurement, v: string) => setM((p) => ({ ...p, [k]: v === "" ? null : Number(v) }));
  const hasAny = FIELDS.some((f) => m[f.key] != null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="تسجيل قياسات" description="سجّل ما قِسته فقط — الحقول الفارغة تُتجاهل.">
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (hasAny) { onSave(m); onOpenChange(false); } }}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="التاريخ"><Input type="date" required max={today()} value={m.date} onChange={(e) => setM({ ...m, date: e.target.value })} /></Field>
            <Field label="المصدر">
              <Select value={m.source} onChange={(e) => setM({ ...m, source: e.target.value as Measurement["source"] })}>
                <option value="manual">قياس يدوي</option><option value="inbody">جهاز InBody</option>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {FIELDS.filter((f) => !f.adv).map((f) => (
              <Field key={f.key} label={f.label}><Input type="number" inputMode="decimal" step={f.step} min="0" value={(m[f.key] as number | null) ?? ""} onChange={(e) => num(f.key, e.target.value)} /></Field>
            ))}
          </div>
          <button type="button" onClick={() => setShowAdv((s) => !s)} className="text-start text-xs font-medium text-primary">{showAdv ? "إخفاء" : "إظهار"} تفاصيل InBody الإضافية</button>
          {showAdv && (
            <div className="grid grid-cols-2 gap-3">
              {FIELDS.filter((f) => f.adv).map((f) => (
                <Field key={f.key} label={f.label}><Input type="number" inputMode="decimal" step={f.step} min="0" value={(m[f.key] as number | null) ?? ""} onChange={(e) => num(f.key, e.target.value)} /></Field>
              ))}
            </div>
          )}
          <Field label="ملاحظات"><Textarea value={m.notes} onChange={(e) => setM({ ...m, notes: e.target.value })} /></Field>
          <Button type="submit" size="lg" disabled={!hasAny}>حفظ</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function MeasurementsPage() {
  const { db, profile, save, remove } = useData();
  const [metric, setMetric] = React.useState<MetricKey>("weight_kg");
  const [range, setRange] = React.useState<"30" | "90" | "all">("all");
  const [dlg, setDlg] = React.useState<Measurement | null>(null);
  const ms = React.useMemo(() => sortedMeasurements(db), [db]);
  const cfg = METRICS.find((m) => m.key === metric)!;
  const inRange = React.useCallback((d: string) => range === "all" || diffDays(today(), d) <= Number(range), [range]);

  const series = React.useMemo(() => {
    const rows = ms.filter((m) => m[metric] != null && inRange(m.date));
    const base = rows.map((m) => ({ date: m.date, label: fmt(m.date, "d MMM"), v: m[metric] as number }));
    const ma = movingAvg(base.map((b) => b.v), 7);
    return base.map((b, i) => ({ ...b, ma: metric === "weight_kg" ? round(ma[i] as number, 2) : null }));
  }, [ms, metric, inRange]);

  const comp = React.useMemo(() => ms.filter((m) => m.muscle_mass_kg != null && (m.fat_mass_kg != null || (m.body_fat_pct != null && m.weight_kg != null)) && inRange(m.date)).map((m) => ({
    label: fmt(m.date, "d MMM"),
    smm: m.muscle_mass_kg as number,
    fat: m.fat_mass_kg ?? round(((m.body_fat_pct as number) / 100) * (m.weight_kg as number), 1),
    pbf: m.body_fat_pct,
  })), [ms, inRange]);

  const kpi = METRICS.map((m, i) => {
    const l = latestValue(db, m.key);
    const dec = m.unit === "%" ? 1 : 1;
    return (
      <KpiCard key={m.key} index={i} label={m.label} color={m.color}
        value={l ? String(round(l.value, dec)) : "—"} unit={l ? m.unit : undefined}
        delta={l && l.prev != null ? round(l.value - l.prev, 2) : undefined} deltaGood={m.good} deltaDigits={1}
        spark={ms.map((x) => x[m.key] as number | null).filter((v): v is number => v != null)}
        hint={l ? `آخر قياس ${fmt(l.date)}` : "لا قياسات بعد"}
        icon={m.key === "weight_kg" ? <Scale className="size-4" /> : m.key === "muscle_mass_kg" ? <Dumbbell className="size-4" /> : m.key === "body_fat_pct" ? <Flame className="size-4" /> : <Ruler className="size-4" />} />
    );
  });

  const lastInbody = [...ms].reverse().find((m) => m.source === "inbody" && (m.inbody_score != null || m.bmr != null || m.visceral_fat != null || m.bmi != null || m.body_water_l != null));
  const ib = lastInbody
    ? [
        { label: "درجة InBody", value: lastInbody.inbody_score, unit: "/100", icon: Gauge, hint: "الأعلى أفضل" },
        { label: "BMI", value: lastInbody.bmi, unit: "كجم/م²", icon: Activity, hint: "الطبيعي 18.5–24.9" },
        { label: "BMR", value: lastInbody.bmr, unit: "kcal", icon: Flame, hint: "الطبيعي 1644–1927" },
        { label: "الدهون الحشوية", value: lastInbody.visceral_fat, unit: "مستوى", icon: Activity, hint: "الطبيعي 1–9" },
        { label: "ماء الجسم", value: lastInbody.body_water_l, unit: "لتر", icon: Droplets, hint: "الطبيعي 39.2–47.9" },
        { label: "كتلة الدهون", value: lastInbody.fat_mass_kg, unit: "كجم", icon: Flame, hint: "الطبيعي 8.4–16.7" },
      ].filter((x) => x.value != null)
    : [];

  return (
    <>
      <PageHeader title="القياسات" subtitle="الوزن والمحيطات وتكوين الجسم مع رسوم تفاعلية"
        actions={<Button onClick={() => setDlg(blank())}><Plus />قياس جديد</Button>} />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">{kpi}</div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented value={metric} onChange={setMetric} options={METRICS.map((m) => ({ value: m.key, label: m.label }))} className="max-w-full overflow-x-auto" />
        <Segmented value={range} onChange={setRange} options={[{ value: "30", label: "30 يوم" }, { value: "90", label: "90 يوم" }, { value: "all", label: "الكل" }]} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title={`${cfg.label} عبر الزمن`} description={metric === "weight_kg" ? `المتوسط المتحرك (7 قراءات) · الهدف ${profile.goals.target_weight_kg} كجم` : undefined}>
          {series.length < 1 ? <EmptyState title="لا بيانات لهذا المقياس" hint="سجّل قياسًا ليظهر الرسم." /> : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs><linearGradient id="mg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={cfg.color} stopOpacity=".28" /><stop offset="1" stopColor={cfg.color} stopOpacity="0" /></linearGradient></defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis domain={["auto", "auto"]} tickLine={false} axisLine={false} width={44} />
                <Tooltip content={<ChartTip unit={` ${cfg.unit}`} labels={{ v: cfg.label, ma: "المتوسط المتحرك" }} />} />
                {metric === "weight_kg" && <ReferenceLine y={profile.goals.target_weight_kg} stroke="hsl(var(--success))" strokeDasharray="5 4" label={{ value: "الهدف", fill: "hsl(var(--success))", fontSize: 11, position: "insideTopRight" }} />}
                <Area dataKey="v" name={cfg.label} stroke={cfg.color} strokeWidth={2.5} fill="url(#mg)" dot={{ r: 3, fill: cfg.color }} activeDot={{ r: 5 }} />
                {metric === "weight_kg" && <Line dataKey="ma" name="المتوسط المتحرك" stroke="hsl(var(--violet))" strokeWidth={2} strokeDasharray="4 3" dot={false} />}
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="تكوين الجسم" description="الكتلة العضلية مقابل كتلة الدهون (كجم) ونسبة الدهون">
          {comp.length < 1 ? <EmptyState title="لا بيانات كافية" hint="أضف قياسات بها SMM ونسبة الدهون." /> : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={comp} margin={{ top: 8, right: 0, left: -12, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis yAxisId="kg" domain={["auto", "auto"]} tickLine={false} axisLine={false} width={44} />
                <YAxis yAxisId="pbf" orientation="right" domain={["auto", "auto"]} tickLine={false} axisLine={false} width={36} />
                <Tooltip content={<ChartTip labels={{ smm: "SMM (كجم)", fat: "كتلة الدهون (كجم)", pbf: "نسبة الدهون %" }} />} />
                <Legend formatter={(v) => ({ smm: "العضلات (كجم)", fat: "الدهون (كجم)", pbf: "الدهون %" }[v as string] ?? v)} wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="kg" dataKey="smm" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line yAxisId="kg" dataKey="fat" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line yAxisId="pbf" dataKey="pbf" stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 2 }} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {ib.length > 0 && lastInbody && (
        <Card className="mt-4">
          <CardHeader><div><CardTitle>تحليل InBody الأخير</CardTitle><CardDescription>{fmt(lastInbody.date, "d MMMM yyyy")}</CardDescription></div><Badge variant="default">InBody</Badge></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {ib.map((x) => (
                <div key={x.label} className="rounded-lg bg-muted/60 p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><x.icon className="size-3.5 text-primary" />{x.label}</div>
                  <div className="mt-1.5"><span className="num text-2xl font-bold">{x.value}</span> <span className="text-[11px] text-muted-foreground">{x.unit}</span></div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{x.hint}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mt-4">
        <CardHeader><div><CardTitle>سجل القياسات</CardTitle><CardDescription>تاريخا القراءتين الأولى والثانية من InBody تقريبيان — عدّلهما بالتاريخ الفعلي.</CardDescription></div></CardHeader>
        <CardContent>
          {ms.length === 0 ? <EmptyState icon={<Ruler />} title="لا قياسات" /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead><tr className="border-b text-xs text-muted-foreground">
                  {["التاريخ", "المصدر", "الوزن", "دهون %", "عضلات", "خصر", "صدر", "ذراع", "فخذ", ""].map((h) => <th key={h} className="px-2 py-2 text-start font-medium">{h}</th>)}
                </tr></thead>
                <tbody>
                  {[...ms].reverse().map((m) => (
                    <tr key={m.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="px-2 py-2.5 font-medium"><span className="num">{fmtShort(m.date)}</span> <span className="num text-xs text-muted-foreground">{m.date.slice(0, 4)}</span></td>
                      <td className="px-2"><Badge variant={m.source === "inbody" ? "default" : "muted"}>{m.source === "inbody" ? "InBody" : "يدوي"}</Badge></td>
                      {([m.weight_kg, m.body_fat_pct, m.muscle_mass_kg, m.waist_cm, m.chest_cm, m.arm_cm, m.thigh_cm] as (number | null)[]).map((v, i) => <td key={i} className="num px-2">{v ?? "—"}</td>)}
                      <td className="px-2"><div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" aria-label="تعديل" onClick={() => setDlg(m)}><Pencil /></Button>
                        <Button variant="ghost" size="icon-sm" aria-label="حذف" onClick={() => { if (confirm("حذف هذا القياس؟")) remove("measurements", m.id); }}><Trash2 className="text-danger" /></Button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <MeasurementDialog open={dlg != null} onOpenChange={(o) => !o && setDlg(null)} initial={dlg ?? blank()} onSave={(m) => save("measurements", m)} />
    </>
  );
}
