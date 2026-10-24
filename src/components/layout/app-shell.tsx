"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "next-themes";
import {
  Activity, Brain, Camera, Cloud, CloudOff, Droplets, Dumbbell, FileBarChart, LayoutDashboard, LogOut, MoreHorizontal, Moon, Pill, Plus, Ruler, Search, Settings,
  Sparkles, Stethoscope, Sun, Utensils, X,
} from "lucide-react";
import { NAV } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useData } from "@/components/providers/data-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useReminders } from "@/hooks/use-reminders";
import { today, uid } from "@/lib/dates";
import { CommandPalette } from "@/components/layout/command-palette";
import { Celebrations } from "@/components/layout/celebrations";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Utensils, Droplets, Pill, Dumbbell, Ruler, Camera, Moon, Sparkles, FileBarChart, Settings, Brain, Stethoscope,
};
const MOBILE_MAIN = ["/", "/nutrition", "/workouts", "/medications"];

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [m, setM] = React.useState(false);
  React.useEffect(() => setM(true), []);
  return (
    <Button variant="ghost" size="icon-sm" aria-label="تبديل الوضع" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
      {m && resolvedTheme === "dark" ? <Sun /> : <Moon />}
    </Button>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((n) => {
        const Icon = ICONS[n.icon];
        const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
        return (
          <Link key={n.href} href={n.href} onClick={onNavigate}
            className={cn("relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors", active ? "text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
            {active && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-md bg-primary/12" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
            <Icon className="relative size-[18px]" />
            <span className="relative">{n.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function QuickWater() {
  const { save, db } = useData();
  const [pulse, setPulse] = React.useState(false);
  const add = () => {
    save("water_logs", { id: uid(), date: today(), amount_ml: 250, logged_at: new Date().toISOString() });
    setPulse(true);
    setTimeout(() => setPulse(false), 700);
  };
  const total = db.water_logs.filter((w) => w.date === today()).reduce((s, w) => s + w.amount_ml, 0);
  return (
    <Button size="sm" variant="secondary" onClick={add} className={cn("gap-1.5", pulse && "animate-pulse-ring")} aria-label="إضافة 250 مل ماء">
      <Droplets className="text-primary" /> <Plus className="size-3" /><span className="num">250</span>
      <span className="num hidden text-muted-foreground sm:inline">· {total}</span>
    </Button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { ready, mode, error, clearError, signOut, profile } = useData();
  const [more, setMore] = React.useState(false);
  const [palette, setPalette] = React.useState(false);
  useReminders();
  React.useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((v) => !v); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  React.useEffect(() => setMore(false), [path]);

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="no-print fixed inset-y-0 start-0 z-30 hidden w-64 flex-col border-e bg-surface/80 p-4 backdrop-blur-xl md:flex">
        <Link href="/" className="mb-6 flex items-center gap-3 px-2 pt-1">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_8px_24px_-8px_hsl(var(--primary))]"><Activity className="size-5" /></span>
          <div className="leading-tight"><div className="text-base font-bold tracking-tight">FitOS</div><div className="text-[11px] text-muted-foreground">Health · Nutrition · Training</div></div>
        </Link>
        <div className="flex-1 overflow-y-auto"><NavLinks /></div>
        <div className="mt-4 rounded-lg border bg-card/60 p-3">
          <div className="truncate text-sm font-semibold">{profile?.full_name?.split(" ").slice(0, 2).join(" ") ?? <Skeleton className="h-4 w-24" />}</div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {mode === "supabase" ? <Cloud className="size-3 text-success" /> : <CloudOff className="size-3 text-warning" />}
            {mode === "supabase" ? "متصل بـ Supabase" : "وضع محلي (هذا المتصفح فقط)"}
          </div>
          {mode === "supabase" && <button onClick={signOut} className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"><LogOut className="size-3" /> تسجيل الخروج</button>}
        </div>
      </aside>

      {/* Main */}
      <div className="app-main md:ps-64">
        <header className="no-print glass sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-x-0 border-t-0 px-4 md:px-8">
          <div className="flex items-center gap-2 md:hidden">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Activity className="size-4" /></span>
            <span className="font-bold">FitOS</span>
          </div>
          <div className="hidden text-sm text-muted-foreground md:block">
            {new Date().toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon-sm" aria-label="بحث وأوامر سريعة (Ctrl+K)" onClick={() => setPalette(true)}><Search /></Button>
            <QuickWater />
            <ThemeToggle />
          </div>
        </header>

        {mode === "local" && ready && (
          <div className="mx-4 mt-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning md:mx-8">
            الوضع المحلي: بياناتك محفوظة في هذا المتصفح فقط. أضف مفاتيح Supabase في <span className="num font-mono">.env.local</span> للمزامنة بين الأجهزة.
          </div>
        )}
        {error && (
          <div role="alert" className="mx-4 mt-3 flex items-start justify-between gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger md:mx-8">
            <span>تعذّرت المزامنة: {error}</span>
            <button onClick={clearError} aria-label="إغلاق"><X className="size-3.5" /></button>
          </div>
        )}

        <main className="mx-auto w-full max-w-[1400px] px-4 pb-28 pt-6 md:px-8 md:pb-10">
          {ready && profile ? (
            <AnimatePresence mode="wait">
              <motion.div key={path} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                {children}
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="space-y-4">
              <Skeleton className="h-10 w-64" />
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
            </div>
          )}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="no-print glass fixed inset-x-0 bottom-0 z-30 flex border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="التنقل الرئيسي">
        {NAV.filter((n) => MOBILE_MAIN.includes(n.href)).map((n) => {
          const Icon = ICONS[n.icon];
          const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} className={cn("flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium", active ? "text-primary" : "text-muted-foreground")}>
              <Icon className="size-5" />{n.label}
            </Link>
          );
        })}
        <button onClick={() => setMore(true)} className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium text-muted-foreground"><MoreHorizontal className="size-5" />المزيد</button>
      </nav>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
      <Celebrations />
      <AnimatePresence>
        {more && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMore(false)} />
            <motion.div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:hidden"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 320 }}>
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted" />
              <div className="grid grid-cols-3 gap-2">
                {NAV.filter((n) => !MOBILE_MAIN.includes(n.href)).map((n) => {
                  const Icon = ICONS[n.icon];
                  return (
                    <Link key={n.href} href={n.href} className="flex flex-col items-center gap-1.5 rounded-lg bg-muted/60 p-3 text-xs font-medium active:scale-95"><Icon className="size-5 text-primary" />{n.label}</Link>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
