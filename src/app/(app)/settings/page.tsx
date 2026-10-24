"use client";
import * as React from "react";
import { useTheme } from "next-themes";
import { Bell, Database, Download, Upload, FlaskConical, LogOut, Monitor, Moon, ShieldAlert, Sun, Trash2, User } from "lucide-react";
import { useData } from "@/components/providers/data-provider";
import { PageHeader } from "@/components/shared/page-header";
import { Field } from "@/components/shared/field";
import { Segmented } from "@/components/shared/segmented";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FOOD_GROUPS, GROUP_ORDER, MEALS, MEAL_ORDER } from "@/lib/constants";
import { notify } from "@/lib/reminders";
import type { FoodGroup, Goals, MealKey, Profile } from "@/lib/types";

export default function SettingsPage() {
  const { profile, updateProfile, mode, exportJSON, importJSON, loadSample, clearSample, hasSample, wipeAll, signOut } = useData();
  const { theme, setTheme } = useTheme();
  const [p, setP] = React.useState<Profile>(profile);
  const [saved, setSaved] = React.useState(false);
  const [perm, setPerm] = React.useState<NotificationPermission | "unsupported">("default");

  React.useEffect(() => {
    setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);

  const g = p.goals;
  const setGoal = <K extends keyof Goals>(k: K, v: Goals[K]) => setP((x) => ({ ...x, goals: { ...x.goals, [k]: v } }));
  const num = (v: string) => (v === "" ? 0 : Number(v));
  const save = () => {
    updateProfile(p);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  const dirty = JSON.stringify(p) !== JSON.stringify(profile);

  const download = () => {
    const blob = new Blob([exportJSON()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `fitos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try { setImportMsg({ ok: true, text: importJSON(await f.text()) }); } catch (err) { setImportMsg({ ok: false, text: err instanceof Error ? err.message : "تعذّر الاستيراد" }); }
  };
  const askPermission = async () => {
    if (typeof Notification === "undefined") return;
    const r = await Notification.requestPermission();
    setPerm(r);
    if (r === "granted") notify("FitOS", "تم تفعيل التذكيرات ✅", "test");
  };

  return (
    <div className="space-y-5">
      <PageHeader title="الإعدادات" subtitle="الملف الشخصي والأهداف والتذكيرات والبيانات" actions={
        <Button onClick={save} disabled={!dirty && !saved}>{saved ? "تم الحفظ ✓" : "حفظ التغييرات"}</Button>
      } />

      <Card>
        <CardHeader><div><CardTitle className="flex items-center gap-2"><User className="size-4" /> الملف الشخصي</CardTitle></div></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="الاسم" className="sm:col-span-2"><Input value={p.full_name} onChange={(e) => setP({ ...p, full_name: e.target.value })} /></Field>
          <Field label="السن"><Input type="number" value={p.age} onChange={(e) => setP({ ...p, age: num(e.target.value) })} /></Field>
          <Field label="الطول (سم)"><Input type="number" value={p.height_cm} onChange={(e) => setP({ ...p, height_cm: num(e.target.value) })} /></Field>
          <Field label="الطبيب المعالج" className="sm:col-span-2 lg:col-span-4"><Input value={p.doctor} onChange={(e) => setP({ ...p, doctor: e.target.value })} /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div><CardTitle>الأهداف اليومية والأسبوعية</CardTitle><CardDescription>مأخوذة من نظام الدكتور — عدّلها فقط بتوجيه منه</CardDescription></div></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Field label="السعرات (kcal)"><Input type="number" value={g.calories} onChange={(e) => setGoal("calories", num(e.target.value))} /></Field>
          <Field label="البروتين (جم)"><Input type="number" value={g.protein_g} onChange={(e) => setGoal("protein_g", num(e.target.value))} /></Field>
          <Field label="الماء (مل)"><Input type="number" step="250" value={g.water_ml} onChange={(e) => setGoal("water_ml", num(e.target.value))} /></Field>
          <Field label="الوزن المستهدف (كجم)"><Input type="number" step="0.1" value={g.target_weight_kg} onChange={(e) => setGoal("target_weight_kg", num(e.target.value))} /></Field>
          <Field label="ساعات النوم"><Input type="number" step="0.5" value={g.sleep_hours} onChange={(e) => setGoal("sleep_hours", num(e.target.value))} /></Field>
          <Field label="النوم قبل الساعة"><Input type="time" value={g.bedtime_before} onChange={(e) => setGoal("bedtime_before", e.target.value)} /></Field>
          <Field label="الشاشات (دقيقة/يوم)"><Input type="number" value={g.screen_max_min} onChange={(e) => setGoal("screen_max_min", num(e.target.value))} /></Field>
          <Field label="تمارين مقاومة/أسبوع"><Input type="number" min="1" max="7" value={g.workouts_per_week} onChange={(e) => setGoal("workouts_per_week", num(e.target.value))} /></Field>
          <Field label="كارديو (أيام/أسبوع)"><Input type="number" min="0" max="7" value={g.cardio_days_per_week} onChange={(e) => setGoal("cardio_days_per_week", num(e.target.value))} /></Field>
          <Field label="تاريخ بدء النظام"><Input type="date" value={g.plan_start} onChange={(e) => setGoal("plan_start", e.target.value)} /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div><CardTitle>الحصص اليومية</CardTitle><CardDescription>عدد الحصص المقررة لكل مجموعة غذائية</CardDescription></div></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {GROUP_ORDER.map((gr) => (
            <Field key={gr} label={FOOD_GROUPS[gr].label}>
              <Input type="number" step="0.5" min="0" value={g.servings[gr]} onChange={(e) => setGoal("servings", { ...g.servings, [gr as FoodGroup]: num(e.target.value) })} />
            </Field>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div><CardTitle className="flex items-center gap-2"><Bell className="size-4" /> التذكيرات</CardTitle>
          <CardDescription>تعمل أثناء فتح التطبيق (أو كتطبيق PWA مثبّت). مواعيد الجرعات تُعدَّل من صفحة الأدوية.</CardDescription></div>
          {perm === "granted" ? <Badge variant="success">مفعّلة</Badge> : perm === "unsupported" ? <Badge variant="muted">غير مدعومة</Badge> :
            <Button size="sm" onClick={askPermission} disabled={perm === "denied"}>{perm === "denied" ? "محظورة من المتصفح" : "تفعيل الإشعارات"}</Button>}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {([["meds", "الأدوية والمكملات"], ["water", "شرب الماء"], ["meals", "مواعيد الوجبات"], ["sleep", "النوم المبكر"], ["workout", "يوم التمرين"]] as const).map(([k, label]) => (
              <label key={k} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5 text-sm">
                {label}<Switch checked={g.reminders[k]} onCheckedChange={(v) => setGoal("reminders", { ...g.reminders, [k]: v })} />
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {MEAL_ORDER.map((m) => (
              <Field key={m} label={`موعد ${MEALS[m].label}`}><Input type="time" value={g.meal_times[m]} onChange={(e) => setGoal("meal_times", { ...g.meal_times, [m as MealKey]: e.target.value })} /></Field>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div><CardTitle>المظهر</CardTitle></div></CardHeader>
        <CardContent>
          <Segmented value={theme ?? "dark"} onChange={setTheme} options={[
            { value: "dark", label: <span className="flex items-center gap-1.5"><Moon className="size-3.5" /> داكن</span> },
            { value: "light", label: <span className="flex items-center gap-1.5"><Sun className="size-3.5" /> فاتح</span> },
            { value: "system", label: <span className="flex items-center gap-1.5"><Monitor className="size-3.5" /> النظام</span> },
          ]} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div><CardTitle className="flex items-center gap-2"><Database className="size-4" /> البيانات والحساب</CardTitle>
          <CardDescription>{mode === "supabase" ? "متصل بـ Supabase — بياناتك محفوظة في قاعدة بياناتك الخاصة." : "وضع محلي: البيانات محفوظة في هذا المتصفح فقط. اربط Supabase (README) للمزامنة بين الأجهزة."}</CardDescription></div>
          <Badge variant={mode === "supabase" ? "success" : "warning"}>{mode === "supabase" ? "Supabase" : "Local"}</Badge></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={download}><Download /> تصدير نسخة JSON</Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}><Upload /> استعادة من نسخة</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onImport} />
          {importMsg && <span className={importMsg.ok ? "text-xs text-success" : "text-xs text-danger"}>{importMsg.text}</span>}
          {mode === "local" && (hasSample
            ? <Button variant="secondary" onClick={clearSample}><FlaskConical /> حذف البيانات التجريبية</Button>
            : <Button variant="secondary" onClick={loadSample}><FlaskConical /> تحميل بيانات تجريبية (للمعاينة)</Button>)}
          {mode === "supabase" && <Button variant="secondary" onClick={signOut}><LogOut /> تسجيل الخروج</Button>}
        </CardContent>
      </Card>

      <Card className="border-danger/30">
        <CardHeader><div><CardTitle className="flex items-center gap-2 text-danger"><ShieldAlert className="size-4" /> منطقة الخطر</CardTitle>
          <CardDescription>حذف كل سجلاتك وإعادة التهيئة ببيانات الدكتور الأصلية.</CardDescription></div></CardHeader>
        <CardContent>
          <Button variant="danger" onClick={async () => { if (confirm("سيتم حذف كل بياناتك نهائيًا. هل أنت متأكد؟")) await wipeAll(); }}><Trash2 /> حذف كل البيانات</Button>
        </CardContent>
      </Card>

      <p className="pb-4 text-center text-[11px] leading-relaxed text-muted-foreground">
        هذا التطبيق أداة متابعة شخصية وليس بديلًا عن الاستشارة الطبية. لا تغيّر جرعات الأدوية أو النظام الغذائي دون الرجوع للطبيب المعالج.
      </p>
    </div>
  );
}
