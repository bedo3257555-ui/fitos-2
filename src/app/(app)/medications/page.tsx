"use client";
import * as React from "react";
import { motion } from "framer-motion";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, BellRing, Check, Clock, Edit3, Pill, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { useData } from "@/components/providers/data-provider";
import { PageHeader } from "@/components/shared/page-header";
import { DateNav } from "@/components/shared/date-nav";
import { Ring } from "@/components/shared/ring";
import { KpiCard } from "@/components/shared/kpi-card";
import { ChartCard, ChartTip } from "@/components/shared/chart-card";
import { Heatmap } from "@/components/shared/heatmap";
import { EmptyState } from "@/components/shared/empty-state";
import { Field } from "@/components/shared/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dayScores, medAdherence, medDay, missedDoses, slotsOn, trackingStart, type SlotRow, type SlotState } from "@/lib/analytics";
import { addDays, fmt, rangeDays, time12, today, uid } from "@/lib/dates";
import type { MedLog, Medication, MedSlot } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATE: Record<SlotState, { label: string; variant: "success" | "warning" | "danger" | "muted" | "default" }> = {
  taken: { label: "تم", variant: "success" },
  due: { label: "حان الموعد", variant: "warning" },
  upcoming: { label: "قادم", variant: "muted" },
  missed: { label: "فائتة", variant: "danger" },
  skipped: { label: "تم تخطّيها", variant: "muted" },
};
const COLORS = ["#3b82f6", "#8b5cf6", "#14b8a6", "#f59e0b", "#ec4899", "#22c55e", "#ef4444", "#06b6d4", "#f97316", "#a3e635"];

const periodOf = (time: string) => {
  const h = Number(time.slice(0, 2));
  if (h < 12) return "الصباح";
  if (h < 17) return "الظهر والعصر";
  if (h < 21) return "المساء";
  return "الليل / قبل النوم";
};

export default function MedicationsPage() {
  const { db, save, remove, removeMany } = useData();
  const [date, setDate] = React.useState(today());
  const [editing, setEditing] = React.useState<Medication | null>(null);

  const rows = React.useMemo(() => slotsOn(db, date), [db, date]);
  const groups = React.useMemo(() => {
    const m = new Map<string, SlotRow[]>();
    rows.forEach((r) => m.set(periodOf(r.time), [...(m.get(periodOf(r.time)) ?? []), r]));
    return [...m.entries()];
  }, [rows]);
  const day = medDay(db, date);
  const week = medAdherence(db, addDays(today(), -6), today());
  const missed14 = React.useMemo(() => missedDoses(db, addDays(today(), -13), today()), [db]);

  const setStatus = (r: SlotRow, status: MedLog["status"] | "toggle") => {
    const existing = db.med_logs.find((l) => l.date === date && l.medication_id === r.medication_id && l.slot_id === r.slot_id);
    if (status === "toggle" || (existing && existing.status === status)) {
      if (existing && (status === "toggle" ? existing.status === "taken" : true)) { remove("med_logs", existing.id); return; }
      status = "taken";
    }
    save("med_logs", {
      id: existing?.id ?? uid(), date, medication_id: r.medication_id, slot_id: r.slot_id, status,
      taken_at: status === "taken" ? (date === today() ? new Date().toISOString() : `${date}T${r.time}:00`) : null,
    });
  };

  const missedByMed = React.useMemo(() => {
    const c = new Map<string, number>();
    missedDoses(db, addDays(today(), -29), today()).forEach((m) => c.set(m.name, (c.get(m.name) ?? 0) + 1));
    return [...c.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [db]);

  const ts = trackingStart(db);
  const adherence14 = rangeDays(today(), 14).map((d) => {
    const v = dayScores(db, d).meds;
    return { label: fmt(d, "d/M"), pct: v == null ? null : Math.round(v * 100) };
  });
  const heat = React.useMemo(() => {
    const o: Record<string, number | null> = {};
    rangeDays(today(), 84).forEach((d) => { o[d] = dayScores(db, d).meds; });
    return o;
  }, [db]);

  return (
    <div>
      <PageHeader title="الأدوية والمكملات" subtitle="تتبّع الجرعات والالتزام اليومي والأسبوعي"
        actions={<Button onClick={() => setEditing(blank(db.medications.length))}><Plus />إضافة دواء/مكمل</Button>} />

      <Tabs defaultValue="today">
        <TabsList>
          <TabsTrigger value="today">اليوم</TabsTrigger>
          <TabsTrigger value="history">السجل والالتزام</TabsTrigger>
          <TabsTrigger value="manage">الأدوية</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------- today */}
        <TabsContent value="today">
          <div className="mb-4 flex justify-center sm:justify-start"><DateNav date={date} onChange={setDate} /></div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              {rows.length === 0 && <EmptyState icon={<Pill className="size-5" />} title="لا توجد أدوية نشطة" hint="أضف أدويتك من تبويب «الأدوية»." />}
              {groups.map(([period, list]) => (
                <Card key={period}>
                  <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="size-4 text-primary" />{period}</CardTitle>
                    <span className="num text-xs text-muted-foreground">{list.filter((r) => r.state === "taken").length}/{list.length}</span></CardHeader>
                  <CardContent className="space-y-2">
                    {list.map((r, i) => {
                      const st = STATE[r.state];
                      return (
                        <motion.div key={r.medication_id + r.slot_id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                          className={cn("flex items-center gap-3 rounded-lg border p-3 transition-colors", r.state === "taken" && "border-success/30 bg-success/5", r.state === "missed" && "border-danger/30 bg-danger/5", r.state === "due" && "border-warning/40 bg-warning/5")}>
                          <motion.button whileTap={{ scale: 0.85 }} onClick={() => setStatus(r, "toggle")} aria-label={r.state === "taken" ? `إلغاء تسجيل ${r.name}` : `تسجيل أخذ ${r.name}`} aria-pressed={r.state === "taken"}
                            className={cn("flex size-12 shrink-0 items-center justify-center rounded-full border-2 transition-all", r.state === "taken" ? "border-success bg-success text-white" : "border-input text-transparent hover:border-primary hover:text-primary")}>
                            <Check className="size-6" />
                          </motion.button>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="size-2.5 rounded-full" style={{ background: r.color }} />
                              <span className={cn("font-semibold", r.state === "taken" && "text-muted-foreground line-through")} dir="ltr">{r.name}</span>
                              <Badge variant={st.variant}>{st.label}</Badge>
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">{r.label} · <span className="num">{time12(r.time)}</span> · {r.dose}</div>
                            {r.taken_at && r.state === "taken" && <div className="text-[11px] text-success">أُخذت <span className="num">{new Date(r.taken_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span></div>}
                          </div>
                          <div className="flex gap-1">
                            <Button size="icon-sm" variant="ghost" title="تخطّي" aria-label="تخطّي الجرعة" onClick={() => setStatus(r, "skipped")} className={r.state === "skipped" ? "bg-muted" : ""}><X /></Button>
                            <Button size="icon-sm" variant="ghost" title="فائتة" aria-label="تسجيل كفائتة" onClick={() => setStatus(r, "missed")} className={cn("text-danger hover:text-danger", r.logId && r.state === "missed" && "bg-danger/15")}><AlertTriangle /></Button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="space-y-4">
              <Card>
                <CardContent className="flex flex-col items-center gap-3 p-6">
                  <Ring value={day.pct ?? 0} size={150} stroke={13} color={(day.pct ?? 0) >= 0.9 ? "hsl(var(--success))" : "hsl(var(--primary))"}>
                    <span className="num text-3xl font-bold">{day.pct == null ? "—" : Math.round(day.pct * 100)}<span className="text-base">%</span></span>
                    <span className="text-[11px] text-muted-foreground">الالتزام اليومي</span>
                  </Ring>
                  <div className="text-xs text-muted-foreground"><span className="num font-semibold text-foreground">{day.taken}</span> من <span className="num">{day.expected}</span> جرعة{day.missed > 0 && <> · <span className="text-danger"><span className="num">{day.missed}</span> فائتة</span></>}</div>
                </CardContent>
              </Card>
              <KpiCard label="درجة الالتزام الأسبوعي" value={week.pct == null ? "—" : String(Math.round(week.pct * 100))} unit="%" icon={<ShieldCheck className="size-4" />}
                color="hsl(var(--success))" ring={week.pct ?? 0} hint={week.due ? `${week.taken}/${week.due} جرعة خلال 7 أيام` : "ابدأ بتسجيل جرعاتك"} />
              <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                <BellRing className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>الجرعة التي لا تُسجَّل بعد 3 ساعات من موعدها تُحتسب فائتة. التذكيرات تعمل حسب أوقات الجرعات وتُدار من الإعدادات.</span>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ----------------------------------------------------------- history */}
        <TabsContent value="history">
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="الالتزام اليومي — 14 يومًا" description={ts ? `يبدأ التتبع من ${fmt(ts, "d MMM")}` : "لم يبدأ التتبع بعد"}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={adherence14} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} interval={1} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTip unit="%" digits={0} labels={{ pct: "الالتزام" }} />} />
                  <ReferenceLine y={90} stroke="hsl(var(--success))" strokeDasharray="5 4" />
                  <Line type="monotone" dataKey="pct" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="الجرعات الفائتة لكل دواء" description="آخر 30 يومًا">
              {missedByMed.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">لا توجد جرعات فائتة 🎉</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={missedByMed} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" width={120} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: "hsl(var(--muted) / .5)" }} content={<ChartTip digits={0} labels={{ count: "فائتة" }} />} />
                    <Bar dataKey="count" fill="hsl(var(--danger))" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><div><CardTitle>خريطة الالتزام — 12 أسبوعًا</CardTitle><CardDescription>اضغط على يوم لعرضه في تبويب اليوم</CardDescription></div></CardHeader>
              <CardContent><Heatmap weeks={12} values={heat} color="var(--success)" onSelect={(d) => setDate(d)} selected={date} /></CardContent>
            </Card>
            <Card>
              <CardHeader><div><CardTitle>سجل الجرعات الفائتة</CardTitle><CardDescription>آخر 14 يومًا · <span className="num">{missed14.length}</span> جرعة</CardDescription></div></CardHeader>
              <CardContent>
                {missed14.length === 0 ? <EmptyState icon={<ShieldCheck className="size-5" />} title="لا جرعات فائتة" hint="التزام ممتاز، استمر." /> : (
                  <ul className="max-h-80 space-y-1.5 overflow-y-auto">
                    {missed14.map((m, i) => (
                      <li key={i} className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
                        <span><span dir="ltr" className="font-semibold">{m.name}</span> <span className="text-xs text-muted-foreground">· {m.label}</span></span>
                        <span className="flex items-center gap-2 text-xs text-muted-foreground"><span className="num">{fmt(m.date, "EEE d MMM")} {time12(m.time)}</span><Badge variant={m.explicit ? "warning" : "danger"}>{m.explicit ? "مسجّلة" : "تلقائية"}</Badge></span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ------------------------------------------------------------ manage */}
        <TabsContent value="manage">
          <div className="grid gap-3 md:grid-cols-2">
            {[...db.medications].sort((a, b) => a.sort - b.sort).map((m) => (
              <Card key={m.id} className={cn(!m.active && "opacity-60")}>
                <CardContent className="space-y-3 p-4 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="size-3 rounded-full" style={{ background: m.color }} />
                      <span className="font-semibold" dir="ltr">{m.name}</span>
                      <Badge variant={m.kind === "medication" ? "default" : "violet"}>{m.kind === "medication" ? "دواء" : "مكمل"}</Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Switch checked={m.active} onCheckedChange={(v) => save("medications", { ...m, active: v })} aria-label="تفعيل" />
                      <Button size="icon-sm" variant="ghost" onClick={() => setEditing(structuredClone(m))} aria-label="تعديل"><Edit3 /></Button>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">{m.dose}{m.instructions && <> — {m.instructions}</>}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {m.slots.map((s) => <Badge key={s.id} variant="muted"><Clock className="size-3" />{s.label} · <span className="num">{time12(s.time)}</span></Badge>)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs leading-relaxed text-warning">
            تنبيه طبي: التطبيق يتتبّع الالتزام فقط ولا يغيّر الجرعات ولا يقدّم نصائح علاجية. أي تعديل على الأدوية يكون من طبيبك المعالج حصرًا.
          </p>
        </TabsContent>
      </Tabs>

      <MedDialog med={editing} onClose={() => setEditing(null)}
        onSave={(m) => { save("medications", m); setEditing(null); }}
        onDelete={(m) => {
          if (!confirm(`حذف «${m.name}» وكل سجلاته؟`)) return;
          removeMany("med_logs", db.med_logs.filter((l) => l.medication_id === m.id).map((l) => l.id));
          remove("medications", m.id);
          setEditing(null);
        }} isNew={editing ? !db.medications.some((x) => x.id === editing.id) : false} />
    </div>
  );
}

function blank(n: number): Medication {
  return { id: uid(), name: "", kind: "medication", dose: "", instructions: "", slots: [{ id: "s1", label: "صباحًا", time: "08:00" }], active: true, color: COLORS[n % COLORS.length], notes: "", sort: n + 1 };
}

function MedDialog({ med, onClose, onSave, onDelete, isNew }: { med: Medication | null; onClose: () => void; onSave: (m: Medication) => void; onDelete: (m: Medication) => void; isNew: boolean }) {
  const [d, setD] = React.useState<Medication | null>(med);
  React.useEffect(() => setD(med), [med]);
  if (!d) return <Dialog open={false}><span /></Dialog>;
  const patch = (p: Partial<Medication>) => setD({ ...d, ...p });
  const setSlot = (id: string, p: Partial<MedSlot>) => patch({ slots: d.slots.map((s) => (s.id === id ? { ...s, ...p } : s)) });
  const addSlot = () => {
    let n = d.slots.length + 1;
    while (d.slots.some((s) => s.id === `s${n}`)) n++;
    patch({ slots: [...d.slots, { id: `s${n}`, label: "", time: "12:00" }] });
  };
  const valid = d.name.trim() && d.slots.length > 0 && d.slots.every((s) => s.label.trim() && /^\d{2}:\d{2}$/.test(s.time));
  return (
    <Dialog open={!!med} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={isNew ? "إضافة دواء / مكمل" : "تعديل الدواء"} description="أوقات الجرعات تُستخدم للتذكيرات وحساب الالتزام.">
        <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); if (valid) onSave({ ...d, name: d.name.trim(), slots: d.slots.map((s) => ({ ...s, label: s.label.trim() })) }); }}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="الاسم"><Input value={d.name} onChange={(e) => patch({ name: e.target.value })} dir="ltr" required /></Field>
            <Field label="النوع"><Select value={d.kind} onChange={(e) => patch({ kind: e.target.value as Medication["kind"] })}><option value="medication">دواء</option><option value="supplement">مكمل</option></Select></Field>
          </div>
          <Field label="الجرعة"><Input value={d.dose} onChange={(e) => patch({ dose: e.target.value })} placeholder="مثال: حبتان" /></Field>
          <Field label="طريقة الاستخدام"><Input value={d.instructions} onChange={(e) => patch({ instructions: e.target.value })} placeholder="مثال: قبل الفطار بساعة" /></Field>
          <Field label="اللون">
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => <button type="button" key={c} onClick={() => patch({ color: c })} aria-label={c} className={cn("size-7 rounded-full ring-offset-2 ring-offset-card transition", d.color === c && "ring-2 ring-foreground")} style={{ background: c }} />)}
            </div>
          </Field>
          <div>
            <div className="mb-1.5 flex items-center justify-between"><span className="text-xs font-medium text-muted-foreground">مواعيد الجرعات</span>
              <Button type="button" size="sm" variant="secondary" onClick={addSlot}><Plus />موعد</Button></div>
            <div className="space-y-2">
              {d.slots.map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <Input value={s.label} onChange={(e) => setSlot(s.id, { label: e.target.value })} placeholder="الوصف (قبل الغداء…)" aria-label="وصف الموعد" />
                  <Input type="time" value={s.time} onChange={(e) => setSlot(s.id, { time: e.target.value })} className="w-28 shrink-0" aria-label="الوقت" />
                  <Button type="button" size="icon-sm" variant="ghost" disabled={d.slots.length <= 1} onClick={() => patch({ slots: d.slots.filter((x) => x.id !== s.id) })} aria-label="حذف الموعد"><Trash2 /></Button>
                </div>
              ))}
            </div>
          </div>
          <label className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">نشط (يظهر في الجدول اليومي)<Switch checked={d.active} onCheckedChange={(v) => patch({ active: v })} /></label>
          <div className="mt-2 flex gap-2">
            <Button type="submit" className="flex-1" disabled={!valid}>حفظ</Button>
            {!isNew && <Button type="button" variant="danger" onClick={() => onDelete(d)}><Trash2 />حذف</Button>}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
