# 08 — Component Library Structure

```
src/components
├─ ui/            Button · Card · Input/Textarea/Select/Label · Badge · Progress · Tabs · Dialog · Switch · Skeleton
├─ shared/        PageHeader · KpiCard · TrendBadge · Sparkline · Ring · Heatmap · Stepper · Segmented
│                 ChartCard + ChartTip · DateNav · Field · EmptyState · InsightCard
├─ layout/        AppShell (Sidebar · Topbar · QuickWater · BottomNav · MoreSheet)
├─ photos/        PhotoImg (Signed URL loader)
└─ providers/     DataProvider (useData) · ThemeProvider
```
**الاستخدام:** صفحات `app/(app)/*` تأخذ البيانات من `useData()` وتحسب عبر `lib/analytics`، وتبني الواجهة من `shared/` و`ui/` فقط.
