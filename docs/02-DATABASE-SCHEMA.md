# 02 — Database Schema

الملف التنفيذي: `supabase/migrations/0001_schema.sql` (جداول + فهارس + RLS + Bucket).

| الجدول | الغرض | مفاتيح مهمة |
|---|---|---|
| `profiles` | الملف الشخصي + `goals jsonb` | `id = auth.uid()` |
| `measurements` | وزن/محيطات/InBody | `(user_id, date desc)` |
| `medications` | الأدوية والمكملات + `slots jsonb` | `(user_id, sort)` |
| `med_logs` | تسجيل الجرعات (taken/missed/skipped) | فريد: `(user_id,date,medication_id,slot_id)` |
| `meal_logs` | حصص كل وجبة + ماكروز + off-plan (`group='extra'`) | فريد جزئي: `(user_id,date,meal,group)` لغير extra |
| `water_logs` | جرعات الماء | `(user_id, date desc)` |
| `sleep_logs` | نوم | فريد: `(user_id,date)` |
| `daily_checkins` | شاشات/طاقة/ملاحظات | `(user_id,date)` |
| `exercises` | مكتبة البرنامج (4 Splits) | `(user_id, split, sort)` |
| `workout_sessions` | جلسات (split/cardio/custom) | `(user_id, date desc)` |
| `workout_sets` | المجموعات: وزن/عدات/RIR/RPE/تسخين/ملاحظات | `session_id`, `(user_id, exercise_name, date)` |
| `photos` | مسارات الصور في Storage | `(user_id, date desc)` |
| `insights` | تحليلات تولدها Edge Function | `(user_id, date desc)` |
| `reports` | تقارير أسبوعية JSON | `(user_id, start_date desc)` |

**Storage:** Bucket خاص `progress-photos`، المسار `{user_id}/{uuid}.jpg`، سياسات تقصر الوصول على المجلد الخاص بالمستخدم.

**RLS:** أربع سياسات (select/insert/update/delete) لكل جدول بشرط `user_id = auth.uid()`؛ `user_id` يُملأ تلقائيًا بـ `default auth.uid()`.

**اختيارات تصميم:**
- `date` من نوع `date` بتوقيت جهاز المستخدم (يوم تقويمي)، لا `timestamptz`.
- `goals` و`slots` كـ JSONB لمرونة التعديل بدون Migrations.
- `exercise_name` مكرر في `workout_sets` عمدًا لتتبّع نفس التمرين عبر Splits مختلفة (T Bar Row في Posterior A و B).
- المعرفات UUID تُولَّد في الواجهة (Optimistic UI).
