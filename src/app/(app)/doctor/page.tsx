"use client";
import * as React from "react";
import { Check, Copy, Printer, Stethoscope } from "lucide-react";
import { useData } from "@/components/providers/data-provider";
import { PageHeader } from "@/components/shared/page-header";
import { Segmented } from "@/components/shared/segmented";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { medAdherence, missedDoses, periodReport, sortedMeasurements, trackingStart } from "@/lib/analytics";
import { medPatterns, weightTrend } from "@/lib/intel";
import { addDays, fmt, fmtLong, today } from "@/lib/dates";
import { fmtNum } from "@/lib/utils";

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

export default function DoctorPage() {
  const { db, profile } = useData();
  const t = today();
  const [days, setDays] = React.useState<30 | 60 | 90>(30);
  const [copied, setCopied] = React.useState(false);
  const start = addDays(t, -(days - 1));
  const g = profile.goals;

  const rep = React.useMemo(() => periodReport(db, start, t), [db, start, t]);
  const med = React.useMemo(() => medAdherence(db, start, t), [db, start, t]);
  const mp = React.useMemo(() => medPatterns(db, t, days), [db, t, days]);
  const missed = React.useMemo(() => missedDoses(db, start, t), [db, start, t]);
  const trend = React.useMemo(() => weightTrend(db, t), [db, t]);
  const ms = sortedMeasurements(db).filter((m) => m.body_fat_pct != null || m.weight_kg != null);

  const perMed = React.useMemo(() => {
    const map = new Map<string, { name: string; due: number; taken: number }>();
    mp.bySlot.forEach((s) => { const c = map.get(s.name) ?? { name: s.name, due: 0, taken: 0 }; c.due += s.due; c.taken += s.taken; map.set(s.name, c); });
    return [...map.values()].map((m) => ({ ...m, rate: m.due ? m.taken / m.due : 1 })).sort((a, b) => a.rate - b.rate);
  }, [mp]);
  const ts = trackingStart(db);

  const summary = [
    `تقرير متابعة — ${profile.full_name}`,
    `الفترة: ${fmt(start, "d MMM yyyy")} → ${fmt(t, "d MMM yyyy")} (${days} يومًا)`,
    `الالتزام الدوائي: ${pct(med.pct)} (فاتت ${med.missed} جرعة من ${med.due})`,
    `الالتزام الغذائي: ${pct(rep.foodCompliance)} · متوسط السعرات ${fmtNum(rep.avgKcal)} · بروتين ${fmtNum(rep.avgProtein)} جم`,
    `الماء: متوسط ${fmtNum(rep.avgWater)} مل · هدف محقق ${rep.waterGoalDays} يومًا`,
    `التمرين: ${rep.sessions} جلسة مقاومة · ${rep.cardio} كارديو`,
    `النوم: متوسط ${rep.avgSleep != null ? rep.avgSleep.toFixed(1) : "—"} ساعة`,
    ms.length ? `آخر قياس: وزن ${ms[ms.length - 1].weight_kg ?? "—"} كجم · دهون ${ms[ms.length - 1].body_fat_pct ?? "—"}% · عضلات ${ms[ms.length - 1].muscle_mass_kg ?? "—"} كجم` : "",
    `الهدف ${g.target_weight_kg} كجم — ${trend.headline}`,
  ].filter(Boolean).join("\n");

  const copy = async () => {
    try { await navigator.clipboard.writeText(summary); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  };

  return (
    <div className="space-y-5">
      <div className="no-print">
        <PageHeader title="تقرير الطبيب" subtitle="ملخص جاهز للطباعة أو المشاركة مع د. أحمد — التزام فقط، دون أي اقتراح بتغيير جرعات أو نظام"
          actions={<>
            <Segmented value={days} onChange={setDays} options={[{ value: 30, label: "30 يوم" }, { value: 60, label: "60 يوم" }, { value: 90, label: "90 يوم" }]} />
            <Button variant="secondary" size="sm" onClick={copy}>{copied ? <Check /> : <Copy />} {copied ? "تم النسخ" : "نسخ ملخص نصي"}</Button>
            <Button size="sm" onClick={() => window.print()}><Printer /> طباعة / PDF</Button>
          </>} />
      </div>

      <Card className="print-card">
        <CardHeader><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary"><Stethoscope className="size-5" /></span>
          <div><CardTitle className="text-base">{profile.full_name}</CardTitle><CardDescription>{profile.age} سنة · {profile.height_cm} سم · {profile.doctor}</CardDescription></div></div>
          <div className="text-end text-xs text-muted-foreground"><div>تاريخ التقرير</div><div className="font-semibold text-foreground">{fmtLong(t)}</div><div className="num">{fmt(start, "d/M/yyyy")} – {fmt(t, "d/M/yyyy")}</div></div></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="الالتزام الدوائي" value={pct(med.pct)} hint={`فاتت ${med.missed} من ${med.due}`} />
          <Kpi label="الالتزام الغذائي" value={pct(rep.foodCompliance)} hint={`${rep.loggedDays} يوم مسجّل`} />
          <Kpi label="متوسط النوم" value={rep.avgSleep != null ? `${rep.avgSleep.toFixed(1)} س` : "—"} hint={`الهدف ${g.sleep_hours} س`} />
          <Kpi label="الماء (متوسط)" value={rep.avgWater != null ? `${(rep.avgWater / 1000).toFixed(1)} ل` : "—"} hint={`هدف محقق ${rep.waterGoalDays} يومًا`} />
          <Kpi label="متوسط السعرات" value={fmtNum(rep.avgKcal)} hint={`الخطة ${g.calories}`} />
          <Kpi label="متوسط البروتين" value={rep.avgProtein != null ? `${fmtNum(rep.avgProtein)} جم` : "—"} hint={`الخطة ${g.protein_g} جم`} />
          <Kpi label="جلسات المقاومة" value={`${rep.sessions}`} hint={`كارديو ${rep.cardio}`} />
          <Kpi label="اتجاه الوزن" value={trend.ratePerWeek != null ? `${trend.ratePerWeek > 0 ? "+" : ""}${trend.ratePerWeek}` : "—"} hint="كجم / أسبوع" />
        </CardContent>
      </Card>

      <Card className="print-card">
        <CardHeader><div><CardTitle>قراءات InBody والقياسات</CardTitle><CardDescription>بالترتيب الزمني</CardDescription></div></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b text-muted-foreground">{["التاريخ", "الوزن", "الدهون %", "كتلة الدهون", "العضلات SMM", "BMI", "حشوية", "خصر"].map((h) => <th key={h} className="px-2 py-2 text-start font-medium">{h}</th>)}</tr></thead>
            <tbody>{ms.map((m) => (
              <tr key={m.id} className="border-b last:border-0"><td className="px-2 py-1.5">{fmt(m.date, "d MMM yyyy")}</td>
                {[m.weight_kg, m.body_fat_pct, m.fat_mass_kg, m.muscle_mass_kg, m.bmi, m.visceral_fat, m.waist_cm].map((v, i) => <td key={i} className="num px-2 py-1.5">{v ?? "—"}</td>)}</tr>))}</tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="print-card">
          <CardHeader><div><CardTitle>الالتزام حسب الدواء</CardTitle><CardDescription>الأضعف أولًا{ts ? ` — التتبع بدأ ${fmt(ts, "d MMM")}` : ""}</CardDescription></div></CardHeader>
          <CardContent>
            {perMed.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد بيانات أدوية في هذه الفترة.</p> : (
              <table className="w-full text-xs"><thead><tr className="border-b text-muted-foreground"><th className="py-2 text-start font-medium">الدواء / المكمل</th><th className="text-start font-medium">المأخوذ</th><th className="text-start font-medium">النسبة</th></tr></thead>
                <tbody>{perMed.map((m) => <tr key={m.name} className="border-b last:border-0"><td className="py-1.5">{m.name}</td><td className="num">{m.taken}/{m.due}</td><td className={m.rate < 0.8 ? "num font-semibold text-danger" : "num"}>{Math.round(m.rate * 100)}%</td></tr>)}</tbody></table>
            )}
          </CardContent>
        </Card>
        <Card className="print-card">
          <CardHeader><div><CardTitle>الجرعات الفائتة</CardTitle><CardDescription>آخر {Math.min(15, missed.length)} من {missed.length}</CardDescription></div></CardHeader>
          <CardContent>
            {missed.length === 0 ? <p className="text-sm text-success">لا توجد جرعات فائتة 🎉</p> : (
              <ul className="space-y-1 text-xs">{missed.slice(0, 15).map((m, i) => <li key={i} className="flex justify-between border-b py-1 last:border-0"><span>{m.name} <span className="text-muted-foreground">({m.label})</span></span><span className="num text-muted-foreground">{fmt(m.date, "d MMM")} · {m.explicit ? "متخطّاة" : "لم تُسجَّل"}</span></li>)}</ul>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-[11px] text-muted-foreground">أُنشئ هذا التقرير تلقائيًا من سجلّات المتابعة الذاتية في FitOS. لا يمثّل تشخيصًا، والقرارات العلاجية والغذائية تخص الطبيب المعالج وحده.</p>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="rounded-lg border bg-muted/30 p-3"><div className="text-[11px] text-muted-foreground">{label}</div><div className="num text-xl font-bold">{value}</div>{hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}</div>;
}
