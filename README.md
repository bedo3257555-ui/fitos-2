# FitOS — متابعة الصحة والتغذية والتمارين

Next.js 15 · TypeScript · Tailwind · shadcn-style UI · Framer Motion · Recharts · Supabase (Auth/Postgres/Storage/Edge).

## تشغيل سريع (وضع محلي — بدون أي إعداد)
```bash
npm install
npm run dev        # http://localhost:3000
```
البيانات تُحفظ في متصفحك، ومعبّأة مسبقًا ببياناتك: الروشتة (10 أدوية)، الحصص، برنامج Belghamdi Splits كاملًا، وقراءات InBody الثلاث.
من الإعدادات يمكنك تحميل **بيانات تجريبية** لمعاينة الرسوم ثم حذفها.

## الربط مع Supabase (مزامنة + صور + تذكيرات الخادم)
1. أنشئ مشروعًا على supabase.com.
2. نفّذ `supabase/migrations/0001_schema.sql` في SQL Editor (أو `supabase db push`).
3. Authentication → أنشئ مستخدمك (email/password) ثم عطّل التسجيل الجديد.
4. انسخ `.env.example` إلى `.env.local` وضع `NEXT_PUBLIC_SUPABASE_URL` و`NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. `npm run dev` ← سجّل الدخول؛ يُزرع ملفك وبرنامجك تلقائيًا.
6. (اختياري) `supabase functions deploy compute-insights weekly-report` ثم `0002_cron.sql`.

## النشر
Vercel: أضف متغيري البيئة وانشر. 

## الطبقة الذكية (جديد)
- **المدرب الذكي** `/coach`: «ماذا أفعل الآن؟»، جاهزية التمرين، إيقاع الماء، توقّع الوصول للوزن، أنماط الأدوية، مستويات وأوسمة.
- **تقرير الطبيب** `/doctor`: ملخص 30/60/90 يوم للطباعة أو النسخ.
- **بحث وأوامر سريعة** `Ctrl/⌘+K`: مثال «شربت 500» · «وزني 77.2» · «طاقتي 4».
- **اسأل المدرب**: شات محلي بالعامية يجيب من بياناتك. **تحدّي الأسبوع** · **مراجعة اليوم** · **محاكي الالتزام** · **احتفالات** · **تنبيهات تكيّفية**.
- **استعادة نسخة JSON** من الإعدادات.
> لم يُعدَّل النظام الغذائي ولا برنامج التمرين. التفاصيل: `docs/16-SMART-LAYER.md`.

## الوثائق
مجلد `docs/` (PRD، Schema، ERD، Architecture، Flows، Wireframes، Design System، Components، Folders، SQL، API، Edge Functions، Dashboard، Mobile، Roadmap).

## ملاحظات
- تاريخا القراءتين الأولى والثانية من InBody تقريبيان (لم تُذكر) — عدّلهما من صفحة القياسات.
- السعرات والماكروز تقديرية من نظام الحصص؛ الهدف الرسمي 1595 kcal.
- التطبيق لا يعدّل جرعات ولا يغني عن الطبيب.
