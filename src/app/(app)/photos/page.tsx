"use client";
import * as React from "react";
import { Camera, Columns2, Layers, Loader2, Plus, ShieldCheck, Trash2, Upload } from "lucide-react";
import { useData } from "@/components/providers/data-provider";
import { PageHeader } from "@/components/shared/page-header";
import { Field } from "@/components/shared/field";
import { EmptyState } from "@/components/shared/empty-state";
import { Segmented } from "@/components/shared/segmented";
import { PhotoImg } from "@/components/photos/photo-img";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { compressImage } from "@/lib/store";
import { latestValue } from "@/lib/analytics";
import { diffDays, fmt, today, uid } from "@/lib/dates";
import type { Photo, PhotoAngle } from "@/lib/types";

const ANGLES: { value: PhotoAngle; label: string }[] = [
  { value: "front", label: "أمامية" }, { value: "side", label: "جانبية" }, { value: "back", label: "خلفية" },
];
const angleLabel = (a: PhotoAngle) => ANGLES.find((x) => x.value === a)!.label;

function UploadDialog({ open, onOpenChange, defaultAngle }: { open: boolean; onOpenChange: (o: boolean) => void; defaultAngle: PhotoAngle }) {
  const { db, save, uploadPhoto } = useData();
  const [date, setDate] = React.useState(today());
  const [angle, setAngle] = React.useState<PhotoAngle>(defaultAngle);
  const [weight, setWeight] = React.useState("");
  const [note, setNote] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) return;
    setDate(today()); setAngle(defaultAngle); setNote(""); setFiles([]); setErr(null);
    setWeight(String(latestValue(db, "weight_kg")?.value ?? ""));
  }, [open, defaultAngle, db]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!files.length) return;
    setBusy(true); setErr(null);
    try {
      for (const f of files) {
        const blob = await compressImage(f);
        const path = await uploadPhoto(blob);
        save("photos", { id: uid(), date, angle, path, weight_kg: weight ? Number(weight) : null, note });
      }
      onOpenChange(false);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "فشل رفع الصورة");
    } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="رفع صورة تقدّم" description="الصور تُضغط تلقائيًا قبل الحفظ. التقط نفس الوضعية والإضاءة كل مرة للمقارنة الأدق.">
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="التاريخ"><Input type="date" max={today()} required value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="الزاوية"><Select value={angle} onChange={(e) => setAngle(e.target.value as PhotoAngle)}>{ANGLES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</Select></Field>
          </div>
          <Field label="الوزن وقتها (اختياري)"><Input type="number" step="0.1" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} /></Field>
          <input ref={inputRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
          <button type="button" onClick={() => inputRef.current?.click()} className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-sm text-muted-foreground transition hover:border-primary hover:text-foreground">
            <Upload className="size-6" />
            {files.length ? <span className="font-medium text-foreground">{files.length} صورة مختارة ({files.map((f) => f.name).join("، ").slice(0, 60)})</span> : "اضغط لاختيار صورة أو التقاطها بالكاميرا"}
          </button>
          <Field label="ملاحظة"><Textarea value={note} onChange={(e) => setNote(e.target.value)} className="min-h-[56px]" /></Field>
          {err && <p role="alert" className="rounded-md bg-danger/10 p-2 text-xs text-danger">{err}</p>}
          <Button type="submit" size="lg" disabled={busy || !files.length}>{busy && <Loader2 className="animate-spin" />}حفظ</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PhotoCard({ p, onOpen }: { p: Photo; onOpen: (p: Photo) => void }) {
  return (
    <button onClick={() => onOpen(p)} className="group relative aspect-[3/4] overflow-hidden rounded-lg border bg-muted text-start">
      <PhotoImg path={p.path} alt={`صورة ${angleLabel(p.angle)} ${p.date}`} className="size-full transition-transform duration-300 group-hover:scale-105" />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-2 text-white">
        <div className="text-xs font-semibold">{fmt(p.date, "d MMM yyyy")}</div>
        <div className="flex items-center gap-1.5 text-[10px] opacity-90">{angleLabel(p.angle)}{p.weight_kg != null && <span className="num">· {p.weight_kg} كجم</span>}</div>
      </div>
    </button>
  );
}

function CompareSlider({ a, b }: { a: Photo; b: Photo }) {
  const [pos, setPos] = React.useState(50);
  const ref = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef(false);
  const move = (x: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.max(0, Math.min(100, ((x - r.left) / r.width) * 100)));
  };
  return (
    <div ref={ref} dir="ltr" className="relative mx-auto aspect-[3/4] w-full max-w-md touch-none select-none overflow-hidden rounded-xl border bg-muted"
      onPointerDown={(e) => { drag.current = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); move(e.clientX); }}
      onPointerMove={(e) => drag.current && move(e.clientX)}
      onPointerUp={() => (drag.current = false)} onPointerCancel={() => (drag.current = false)}>
      <PhotoImg path={b.path} alt="بعد" className="absolute inset-0 size-full" />
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <PhotoImg path={a.path} alt="قبل" className="absolute inset-0 size-full" />
      </div>
      <div className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,.6)]" style={{ left: `${pos}%` }}>
        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white p-2 text-black shadow-lg"><Columns2 className="size-4" /></div>
      </div>
      <Badge className="absolute start-2 top-2 bg-black/60 text-white">قبل · {fmt(a.date, "d MMM yy")}</Badge>
      <Badge className="absolute end-2 top-2 bg-black/60 text-white">بعد · {fmt(b.date, "d MMM yy")}</Badge>
    </div>
  );
}

function BeforeAfter({ photos }: { photos: Photo[] }) {
  const [angle, setAngle] = React.useState<PhotoAngle>("front");
  const [view, setView] = React.useState<"slider" | "side">("slider");
  const list = React.useMemo(() => photos.filter((p) => p.angle === angle).sort((x, y) => x.date.localeCompare(y.date)), [photos, angle]);
  const [aId, setAId] = React.useState("");
  const [bId, setBId] = React.useState("");
  React.useEffect(() => {
    setAId(list[0]?.id ?? ""); setBId(list[list.length - 1]?.id ?? "");
  }, [list]);
  const a = list.find((p) => p.id === aId), b = list.find((p) => p.id === bId);
  const optLabel = (p: Photo) => `${fmt(p.date, "d MMM yyyy")}${p.weight_kg != null ? ` · ${p.weight_kg} كجم` : ""}`;
  return (
    <Card>
      <CardHeader>
        <div><CardTitle>قبل / بعد</CardTitle><CardDescription>اختر صورتين بنفس الزاوية وحرّك المقبض للمقارنة.</CardDescription></div>
        <Segmented value={view} onChange={setView} options={[{ value: "slider", label: "منزلق" }, { value: "side", label: "جنبًا لجنب" }]} />
      </CardHeader>
      <CardContent className="space-y-4">
        <Segmented value={angle} onChange={setAngle} options={ANGLES} />
        {list.length < 2 ? <EmptyState icon={<Layers />} title="تحتاج صورتين على الأقل" hint={`ارفع صورتين ${angleLabel(angle)} بتاريخين مختلفين.`} /> : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="قبل"><Select value={aId} onChange={(e) => setAId(e.target.value)}>{list.map((p) => <option key={p.id} value={p.id}>{optLabel(p)}</option>)}</Select></Field>
              <Field label="بعد"><Select value={bId} onChange={(e) => setBId(e.target.value)}>{list.map((p) => <option key={p.id} value={p.id}>{optLabel(p)}</option>)}</Select></Field>
            </div>
            {a && b && (
              <>
                {view === "slider" ? <CompareSlider a={a} b={b} /> : (
                  <div className="grid grid-cols-2 gap-3">
                    {[a, b].map((p, i) => (
                      <div key={p.id + i} className="overflow-hidden rounded-xl border">
                        <PhotoImg path={p.path} alt={i ? "بعد" : "قبل"} className="aspect-[3/4] w-full" />
                        <div className="p-2 text-center text-xs font-medium">{i ? "بعد" : "قبل"} · {fmt(p.date, "d MMM yyyy")}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap justify-center gap-2 text-xs">
                  <Badge variant="muted">الفاصل <span className="num">{Math.abs(diffDays(b.date, a.date))}</span> يوم</Badge>
                  {a.weight_kg != null && b.weight_kg != null && <Badge variant="default">الوزن <span className="num">{(b.weight_kg - a.weight_kg > 0 ? "+" : "")}{(b.weight_kg - a.weight_kg).toFixed(1)}</span> كجم</Badge>}
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function PhotosPage() {
  const { db, remove, deletePhotoFile } = useData();
  const [upload, setUpload] = React.useState(false);
  const [uploadAngle, setUploadAngle] = React.useState<PhotoAngle>("front");
  const [view, setView] = React.useState<Photo | null>(null);
  const [tlAngle, setTlAngle] = React.useState<PhotoAngle>("front");

  const photos = db.photos;
  const sorted = React.useMemo(() => [...photos].sort((a, b) => b.date.localeCompare(a.date)), [photos]);
  const byMonth = React.useMemo(() => {
    const m = new Map<string, Photo[]>();
    sorted.forEach((p) => m.set(p.date.slice(0, 7), [...(m.get(p.date.slice(0, 7)) ?? []), p]));
    return [...m.entries()];
  }, [sorted]);
  const monthly = React.useMemo(() => {
    const months = [...new Set(photos.map((p) => p.date.slice(0, 7)))].sort().reverse();
    return months.map((mo) => ({
      mo,
      byAngle: ANGLES.map((a) => ({ angle: a.value, photo: photos.filter((p) => p.date.startsWith(mo) && p.angle === a.value).sort((x, y) => x.date.localeCompare(y.date))[0] })),
    }));
  }, [photos]);

  const del = async (p: Photo) => {
    if (!confirm("حذف الصورة نهائيًا؟")) return;
    remove("photos", p.id);
    await deletePhotoFile(p.path).catch(() => {});
    setView(null);
  };
  const openUpload = (a: PhotoAngle) => { setUploadAngle(a); setUpload(true); };

  return (
    <>
      <PageHeader title="صور التقدّم" subtitle="مقارنة بصرية عبر الزمن — الأدق من الميزان"
        actions={<Button onClick={() => openUpload("front")}><Plus />صورة جديدة</Button>} />

      <div className="mb-5 flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
        <span>صورك خاصة: في وضع Supabase تُحفظ في مخزن خاص بروابط موقّعة مؤقتة لا يراها غيرك؛ وفي الوضع المحلي تبقى داخل هذا المتصفح فقط.</span>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        {ANGLES.map((a) => (
          <button key={a.value} onClick={() => openUpload(a.value)} className="card-surface flex flex-col items-center gap-1.5 p-4 transition hover:border-primary/50 active:scale-95">
            <Camera className="size-5 text-primary" /><span className="text-sm font-medium">{a.label}</span>
            <span className="num text-[11px] text-muted-foreground">{photos.filter((p) => p.angle === a.value).length} صورة</span>
          </button>
        ))}
      </div>

      {photos.length === 0 ? (
        <EmptyState icon={<Camera />} title="لا صور بعد" hint="ابدأ بصور أمامية وجانبية وخلفية بنفس الإضاءة، ثم كرّرها شهريًا." action={<Button onClick={() => openUpload("front")}><Upload />رفع أول صورة</Button>} />
      ) : (
        <Tabs defaultValue="gallery">
          <TabsList><TabsTrigger value="gallery">المعرض</TabsTrigger><TabsTrigger value="timeline">الخط الزمني</TabsTrigger><TabsTrigger value="compare">قبل / بعد</TabsTrigger><TabsTrigger value="monthly">مقارنة شهرية</TabsTrigger></TabsList>

          <TabsContent value="gallery" className="space-y-6">
            {byMonth.map(([mo, list]) => (
              <section key={mo}>
                <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{fmt(mo + "-01", "MMMM yyyy")} <span className="num">· {list.length}</span></h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{list.map((p) => <PhotoCard key={p.id} p={p} onOpen={setView} />)}</div>
              </section>
            ))}
          </TabsContent>

          <TabsContent value="timeline" className="space-y-4">
            <Segmented value={tlAngle} onChange={setTlAngle} options={ANGLES} />
            {(() => {
              const list = photos.filter((p) => p.angle === tlAngle).sort((a, b) => a.date.localeCompare(b.date));
              return list.length === 0 ? <EmptyState title="لا صور بهذه الزاوية" /> : (
                <div className="flex gap-4 overflow-x-auto pb-3">
                  {list.map((p, i) => (
                    <div key={p.id} className="w-40 shrink-0 sm:w-48">
                      <div className="mb-2 flex items-center gap-2"><span className="flex size-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground num">{i + 1}</span><div className="h-px flex-1 bg-border" /></div>
                      <PhotoCard p={p} onOpen={setView} />
                      {i > 0 && <div className="num mt-1.5 text-center text-[11px] text-muted-foreground">+{diffDays(p.date, list[i - 1].date)} يوم</div>}
                    </div>
                  ))}
                </div>
              );
            })()}
          </TabsContent>

          <TabsContent value="compare"><BeforeAfter photos={photos} /></TabsContent>

          <TabsContent value="monthly" className="space-y-5">
            {monthly.map(({ mo, byAngle }) => (
              <Card key={mo}>
                <CardHeader><CardTitle>{fmt(mo + "-01", "MMMM yyyy")}</CardTitle><CardDescription>أول صورة في الشهر لكل زاوية</CardDescription></CardHeader>
                <CardContent><div className="grid grid-cols-3 gap-3">
                  {byAngle.map(({ angle, photo }) => (
                    <div key={angle}>
                      <div className="mb-1.5 text-center text-xs font-medium text-muted-foreground">{angleLabel(angle)}</div>
                      {photo ? <PhotoCard p={photo} onOpen={setView} /> : <div className="flex aspect-[3/4] items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">لا صورة</div>}
                    </div>
                  ))}
                </div></CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      )}

      <UploadDialog open={upload} onOpenChange={setUpload} defaultAngle={uploadAngle} />
      <Dialog open={view != null} onOpenChange={(o) => !o && setView(null)}>
        {view && (
          <DialogContent title={`${angleLabel(view.angle)} — ${fmt(view.date, "d MMMM yyyy")}`} description={view.weight_kg != null ? `الوزن ${view.weight_kg} كجم` : undefined}>
            <PhotoImg path={view.path} alt="صورة التقدم" className="max-h-[65dvh] w-full rounded-lg object-contain" />
            {view.note && <p className="text-sm text-muted-foreground">{view.note}</p>}
            <Button variant="danger" onClick={() => del(view)}><Trash2 />حذف الصورة</Button>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
