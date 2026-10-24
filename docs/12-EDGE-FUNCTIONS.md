# 12 — Edge Functions

| الدالة | الوظيفة | الجدولة |
|---|---|---|
| `compute-insights` | تحسب قواعد الالتزام (ماء/أدوية/تغذية/نوم/تمارين) وتكتب صفوفًا في `insights` بمعرفات حتمية (Idempotent) | يوميًا 19:00 UTC |
| `weekly-report` | تجمع إحصاءات الأسبوع (السبت→الجمعة) في `reports.data` | السبت 01:00 UTC |

**النشر:**
```bash
supabase functions deploy compute-insights weekly-report
supabase secrets set CRON_SECRET=<سر طويل>   # اختياري
# ثم شغّل supabase/migrations/0002_cron.sql بعد وضع القيمتين في Vault (موضّح داخل الملف)
```
الكود المشترك في `supabase/functions/_shared/util.ts`. التطبيق نفسه لا يعتمد عليهما: يحسب التحليلات محليًا، وتُدمج نتائج الدالة عند وجودها.
