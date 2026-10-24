# 09 — Folder Structure

```
fitos/
├─ docs/                       وثائق التصميم (هذه الملفات)
├─ public/                     manifest · icon.svg · sw.js
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/0001_schema.sql   الجداول + RLS + Storage
│  ├─ migrations/0002_cron.sql     جدولة الـ Edge Functions
│  └─ functions/{_shared,compute-insights,weekly-report}
└─ src/
   ├─ middleware.ts
   ├─ app/
   │  ├─ layout.tsx · globals.css · login/
   │  └─ (app)/ page.tsx(dashboard) nutrition water medications workouts measurements photos sleep insights reports settings
   ├─ components/ ui · shared · layout · photos · providers
   ├─ hooks/ use-reminders · use-today
   └─ lib/ types · constants · seed · dates · store · analytics · reminders · sample · utils · supabase/{client,middleware}
```
