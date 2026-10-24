# 11 — API Design

لا خادم مخصص: التطبيق يتحدث مباشرة مع **PostgREST** عبر `supabase-js`، والأمان بالكامل في RLS.

| العملية | الاستدعاء |
|---|---|
| قراءة جدول | `from(t).select('*').order('id').range(a,b)` (ترقيم 1000) |
| حفظ | `from(t).upsert(rows,{onConflict:'id'})` |
| حذف | `from(t).delete().in('id',ids)` |
| رفع صورة | `storage.from('progress-photos').upload('{uid}/{uuid}.jpg')` |
| عرض صورة | `createSignedUrl(path, 3600)` |
| دخول/خروج | `auth.signInWithPassword` / `auth.signOut` |

**Edge Functions (HTTP):**
| المسار | Body | المصادقة |
|---|---|---|
| `POST /functions/v1/compute-insights` | `{date?, user_id?}` | `Authorization: Bearer <service_role>` أو `x-cron-secret` |
| `POST /functions/v1/weekly-report` | `{week_start?, user_id?}` | نفسه |
