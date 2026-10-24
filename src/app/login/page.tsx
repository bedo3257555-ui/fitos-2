"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Activity, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/shared/field";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [mode, setMode] = React.useState<"in" | "up">("in");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isSupabaseConfigured) router.replace("/");
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const sb = getSupabase();
      if (mode === "in") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/");
        router.refresh();
      } else {
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) { router.replace("/"); router.refresh(); }
        else setMsg("تم إنشاء الحساب. افتح رسالة التأكيد في بريدك ثم سجّل الدخول.");
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "حدث خطأ غير متوقع");
    } finally { setBusy(false); }
  }

  return (
    <div className="hero-glow flex min-h-dvh items-center justify-center p-4">
      <form onSubmit={submit} className="glass w-full max-w-sm space-y-5 rounded-2xl p-7 shadow-2xl">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_12px_32px_-10px_hsl(var(--primary))]"><Activity className="size-7" /></span>
          <div><h1 className="text-2xl font-bold">FitOS</h1><p className="text-sm text-muted-foreground">لوحة صحة عبد الرحمن الشخصية</p></div>
        </div>
        <Field label="البريد الإلكتروني"><Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" /></Field>
        <Field label="كلمة المرور"><Input type="password" required minLength={8} autoComplete={mode === "in" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" /></Field>
        {msg && <p role="alert" className="rounded-md bg-danger/10 p-2 text-xs text-danger">{msg}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />}{mode === "in" ? "تسجيل الدخول" : "إنشاء الحساب"}</Button>
        <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")} className="w-full text-center text-xs text-muted-foreground hover:text-foreground">
          {mode === "in" ? "أول مرة؟ أنشئ حسابك (ثم عطّل التسجيل من لوحة Supabase)" : "لدي حساب بالفعل"}
        </button>
      </form>
    </div>
  );
}
