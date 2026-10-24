# 07 — UI Design System

**المبادئ:** هدوء Notion · دقة Stripe · لمسة Apple · طاقة تطبيقات اللياقة.

## الألوان (HSL tokens في `globals.css`)
| Token | Dark | Light |
|---|---|---|
| background | 240 6% 4% (أسود) | 0 0% 98% |
| card (Charcoal) | 240 5% 9% | 0 0% 100% |
| foreground | 0 0% 97% | 240 10% 6% |
| **primary (Electric Blue)** | 218 100% 62% | 218 100% 56% |
| success / warning / danger / violet | أخضر / عنبري / أحمر / بنفسجي |

ألوان البيانات: دهون برتقالي `#f97316`، عضلات بنفسجي `#8b5cf6`، وزن أزرق `#3b82f6`، ماء سماوي `#38bdf8`، سعرات أحمر `#ef4444`، بروتين أخضر `#10b981`.

## الخط والمسافات
IBM Plex Sans Arabic + Inter (Google Fonts)، أرقام Tabular LTR (`.num`). نصف قطر 16px، شبكة 4px.

## الأنماط
- `.card-surface` بطاقة بظل ناعم · `.glass` زجاجي (Blur 20px) للـ Topbar/Bottom Nav/التلميحات · `.hero-glow` توهج Radial.
- الحركة: دخول متدرّج للبطاقات، Spring للـ Rings والـ Progress، `prefers-reduced-motion` محترم.
- إمكانية الوصول: تباين عالٍ، `aria-label` للأزرار الأيقونية، Focus ring أزرق.
