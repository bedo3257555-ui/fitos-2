"use client";
import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Bot, Send, Trash2, User } from "lucide-react";
import { useData } from "@/components/providers/data-provider";
import { Button } from "@/components/ui/button";
import { answer, STARTERS, type ChatAnswer } from "@/lib/coach-chat";
import { nowMinutes, today } from "@/lib/dates";
import { cn } from "@/lib/utils";

interface Msg { id: number; role: "user" | "coach"; text: string; chips?: string[]; href?: string; hrefLabel?: string }

/** شات «اسأل المدرب»: يجيب من بياناتك محليًا، بدون إنترنت. يقبل ?ask=سؤال في الرابط. */
export function CoachChat() {
  const { db } = useData();
  const [msgs, setMsgs] = React.useState<Msg[]>([]);
  const [q, setQ] = React.useState("");
  const [typing, setTyping] = React.useState(false);
  const idRef = React.useRef(1);
  const box = React.useRef<HTMLDivElement>(null);
  const dbRef = React.useRef(db);
  dbRef.current = db;

  const ask = React.useCallback((text: string) => {
    const t = text.trim();
    if (!t) return;
    setMsgs((m) => [...m, { id: idRef.current++, role: "user", text: t }]);
    setQ("");
    setTyping(true);
    window.setTimeout(() => {
      let a: ChatAnswer;
      try { a = answer(dbRef.current, t, today(), nowMinutes()); } catch { a = { text: "حصلت مشكلة وأنا بحلّل بياناتك. جرّب سؤال تاني.", chips: STARTERS.slice(0, 3) }; }
      setMsgs((m) => [...m, { id: idRef.current++, role: "coach", text: a.text, chips: a.chips, href: a.href, hrefLabel: a.hrefLabel }]);
      setTyping(false);
    }, 380);
  }, []);

  React.useEffect(() => {
    const ask0 = new URLSearchParams(window.location.search).get("ask");
    if (ask0) { ask(ask0); window.history.replaceState(null, "", window.location.pathname); }
  }, [ask]);
  React.useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" }); }, [msgs, typing]);

  const last = msgs[msgs.length - 1];
  const chips = last?.role === "coach" ? last.chips : msgs.length === 0 ? STARTERS : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div ref={box} className="max-h-[380px] min-h-[120px] space-y-3 overflow-y-auto pe-1" aria-live="polite">
        {msgs.length === 0 && (
          <div className="rounded-lg bg-muted/50 p-3 text-sm leading-relaxed text-muted-foreground">
            اسألني بالعامية عن يومك، جاهزيتك، وزنك، أدويتك، الماء، النوم… وأنا أجاوبك من <b className="text-foreground">بياناتك أنت</b>. ما بغيّرش في نظامك الغذائي ولا برنامجك.
          </div>
        )}
        {msgs.map((m) => (
          <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn("flex gap-2", m.role === "user" && "flex-row-reverse")}>
            <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", m.role === "user" ? "bg-primary text-primary-foreground" : "bg-violet/20 text-violet")}>
              {m.role === "user" ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
            </span>
            <div className={cn("max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed", m.role === "user" ? "bg-primary/15" : "bg-muted/60")}>
              {m.text}
              {m.href && <Link href={m.href} className="mt-2 block text-xs font-semibold text-primary hover:underline">{m.hrefLabel ?? "افتح"} ←</Link>}
            </div>
          </motion.div>
        ))}
        {typing && <div className="flex gap-1 ps-9" aria-label="المدرب بيكتب">{[0, 1, 2].map((i) => <motion.span key={i} className="size-1.5 rounded-full bg-muted-foreground" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1, delay: i * 0.18 }} />)}</div>}
      </div>
      {chips && !typing && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => <button key={c} type="button" onClick={() => ask(c)} className="rounded-full border bg-card px-3 py-1 text-xs transition-colors hover:border-primary hover:text-primary">{c}</button>)}
        </div>
      )}
      <div className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") ask(q); }} placeholder="اسأل المدرب… مثال: هوصل لهدفي إمتى؟"
          className="h-10 min-w-0 flex-1 rounded-full border bg-background px-4 text-sm outline-none focus:border-primary" aria-label="سؤالك للمدرب" />
        <Button size="icon" onClick={() => ask(q)} disabled={!q.trim() || typing} aria-label="إرسال"><Send className="rtl:-scale-x-100" /></Button>
        {msgs.length > 0 && <Button size="icon" variant="ghost" onClick={() => setMsgs([])} aria-label="مسح المحادثة"><Trash2 /></Button>}
      </div>
    </div>
  );
}
