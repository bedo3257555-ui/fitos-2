# 04 — Application Architecture

```
┌────────────────────────── Browser (Next.js 15 App Router, RTL) ──────────────────────────┐
│ Pages (client)  →  DataProvider (state + optimistic writes)  →  Store adapter            │
│                         │                                          ├─ LocalStore (localStorage)
│                         ├─ analytics.ts (pure functions)           └─ SupabaseStore (PostgREST + Storage)
│                         └─ reminders.ts + sw.js (Notifications)                          │
└───────────────┬──────────────────────────────────────────────────────────────────────────┘
                │ middleware.ts (refresh session, redirect to /login — only if Supabase configured)
┌───────────────▼──────────────── Supabase ─────────────────────────────────────────────────┐
│ Auth (email/password) · Postgres + RLS · Storage (progress-photos, private)                │
│ Edge Functions: compute-insights (daily), weekly-report (weekly) ← pg_cron + pg_net        │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

## القرارات المعمارية
1. **Store Adapter:** واجهة واحدة `Store` بتنفيذين. بدون مفاتيح Supabase يعمل التطبيق محليًا بالكامل؛ مع المفاتيح يتحول تلقائيًا. صفحات التطبيق لا تعرف أيهما يعمل.
2. **تحميل كامل ثم حساب محلي:** مستخدم واحد وبيانات صغيرة، فيُحمَّل كل شيء مرة واحدة (مع ترقيم 1000 صف) وتُحسب التحليلات في المتصفح كدوال نقية قابلة للاختبار (`lib/analytics.ts`).
3. **Optimistic UI:** `save/remove` تحدّث الحالة فورًا ثم تكتب في الخلفية؛ الأخطاء تظهر في شريط تنبيه.
4. **Edge Functions** لما يجب أن يعمل والتطبيق مغلق: توليد Insights وحفظ تقارير أسبوعية.
5. **الصور:** تُضغط في المتصفح (≤1280px JPEG) قبل الرفع؛ تُعرض عبر Signed URLs مؤقتة.
6. **PWA خفيف:** `manifest.webmanifest` + `sw.js` للتثبيت والإشعارات.

## التقنيات
Next.js 15 · React 19 · TypeScript · Tailwind CSS 3 · مكونات بنمط shadcn/ui (Radix) · Framer Motion · Recharts · Supabase (Auth/Postgres/Storage/Edge) · date-fns · next-themes.
