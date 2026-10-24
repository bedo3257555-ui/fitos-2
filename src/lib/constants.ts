import type { FoodGroup, MealKey, MuscleGroup, Servings, SessionKind, SplitKey } from "./types";

export const FOOD_GROUPS: Record<FoodGroup, { label: string; unit: string; color: string }> = {
  starch: { label: "نشويات", unit: "حصة", color: "#f59e0b" },
  meat: { label: "لحوم / بروتين", unit: "حصة", color: "#ef4444" },
  veg: { label: "خضروات", unit: "حصة", color: "#22c55e" },
  fruit: { label: "فاكهة", unit: "حصة", color: "#ec4899" },
  dairy: { label: "ألبان", unit: "حصة", color: "#38bdf8" },
  fat: { label: "دهون", unit: "حصة (ملعقة صغيرة)", color: "#a78bfa" },
  legumes: { label: "بقوليات", unit: "حصة", color: "#84cc16" },
};
export const GROUP_ORDER: FoodGroup[] = ["meat", "starch", "veg", "dairy", "fruit", "fat", "legumes"];

/**
 * Exchange-list nutrition per ONE serving (used to estimate calories & macros from servings).
 * Sum of the doctor's plan (6 starch, 4 meat, 2 veg, 1 fruit, 2 dairy, 9 fat) ≈ 1535 kcal / 66 g protein,
 * matching the plan's 66 g protein and ~1595 kcal (the plan figure stays the official target).
 */
export const EXCHANGE: Record<FoodGroup | "dairy_skim", { kcal: number; p: number; c: number; f: number }> = {
  starch: { kcal: 80, p: 3, c: 15, f: 1 },
  meat: { kcal: 75, p: 7, c: 0, f: 5 },
  veg: { kcal: 25, p: 2, c: 5, f: 0 },
  fruit: { kcal: 60, p: 0, c: 15, f: 0 },
  dairy: { kcal: 150, p: 8, c: 12, f: 8 },
  dairy_skim: { kcal: 90, p: 8, c: 12, f: 0 },
  fat: { kcal: 45, p: 0, c: 0, f: 5 },
  legumes: { kcal: 80, p: 5, c: 14, f: 0.5 },
};

export function exchangeFor(group: FoodGroup, meal: MealKey) {
  return group === "dairy" && meal === "breakfast" ? EXCHANGE.dairy_skim : EXCHANGE[group];
}

export const DEFAULT_SERVINGS: Servings = { starch: 6, meat: 4, veg: 2, fruit: 1, dairy: 2, fat: 9, legumes: 0 };

export const MEALS: Record<MealKey, { label: string; icon: string; defaultTime: string }> = {
  breakfast: { label: "الفطار", icon: "🌅", defaultTime: "08:00" },
  lunch: { label: "الغداء", icon: "☀️", defaultTime: "13:30" },
  dinner: { label: "العشاء", icon: "🌙", defaultTime: "21:00" },
  snack: { label: "وجبات بينية", icon: "🍎", defaultTime: "17:00" },
};
export const MEAL_ORDER: MealKey[] = ["breakfast", "lunch", "dinner", "snack"];

/** Servings allotted to each meal – sums exactly to the daily plan. */
export const MEAL_TARGETS: Record<MealKey, Partial<Servings>> = {
  breakfast: { starch: 2, meat: 1, veg: 0.5, dairy: 1, fat: 3 },
  lunch: { starch: 2, meat: 2, veg: 1, fat: 3 },
  dinner: { starch: 2, meat: 1, veg: 0.5, fat: 3 },
  snack: { dairy: 1, fruit: 1 },
};

/** Portion guide transcribed from the doctor's plan (shown as hints inside the meal cards). */
export const MEAL_GUIDE: Record<MealKey, Partial<Record<FoodGroup, string>>> = {
  breakfast: {
    meat: "3 بياض بيض، أو 45 جم لحوم/برجر مشوي/كبدة/سجق/رومي/فراخ/شاورما فراخ/حمام/تونة مصفاة",
    fat: "3 ملاعق صغيرة زيت زيتون/ذرة/زبدة/سمنة/مايونيز، أو 1 م.ك قشطة/سمسم/طحينة/شيا/كتان، أو 30 جم زيتون أسمر، أو 75 جم أفوكادو",
    veg: "½ كوب (100 جم) خيار/قثة/فلفل أخضر/باذنجان/بنجر/جزر/طماطم قليلة — بدون قشور أو بذور",
    dairy: "1 كوب (250 جم) لبن/زبادي/رايب خالي الدسم",
    starch: "0.3 رغيف بلدي تموين، أو ½ رغيف أسمر كبير، أو 1 توست بني/شوفان، أو 3 م.ك شوفان/كينوا/بليلة، أو ½ كوب بطاطا/بطاطس/قرع",
  },
  lunch: {
    meat: "60 جم لحوم/برجر/كبدة/بط/رومي/سجق/شاورما/حمام/أرانب/جمبري، أو 8 م.ك فول مدشوش/عدس",
    fat: "نفس بدائل الفطار (3 ملاعق صغيرة زيت/زبدة/مايونيز، أو 1 م.ك سمسم/طحينة، أو 30 جم زيتون)",
    veg: "½ كوب (100 جم) خضروات نيئة + 0.3 كوب (50 جم) خضار مطبوخ (ماعدا البطاطس/القلقاس/البسلة)",
    starch: "3 م.ك أرز/كشري/مكرونة/شعرية، أو 0.3 رغيف بلدي، أو ½ رغيف أسمر كبير، أو 1 توست، أو ½ كوب بطاطس/قلقاس/بسلة",
  },
  dinner: {
    meat: "3 بياض بيض، أو 45 جم لحوم/فراخ/رومي/كبدة، أو 45 جم جبنة لبن طبيعي (دومتي/قتيلو/لبنة/موتزاريلا)، أو 1.5 م.ك زبدة فول سوداني/مكسرات، أو 0.8 كوب فول/عدس",
    fat: "3 ملاعق صغيرة زيت/زبدة/مايونيز، أو 1 م.ك قشطة/سمسم/طحينة/شيا، أو 30 جم زيتون، أو 75 جم أفوكادو",
    veg: "½ كوب (100 جم) خيار/قثة/فلفل/باذنجان/بنجر/جزر/طماطم — بدون قشور أو بذور",
    starch: "0.3 رغيف بلدي، أو ½ رغيف أسمر كبير، أو 1 توست بني/شوفان، أو 3 م.ك شوفان/كينوا، أو 1 كوب بطاطا/بطاطس/قرع",
  },
  snack: {
    dairy: "1 كوب (250 جم) لبن كامل الدسم خالي اللاكتوز",
    fruit: "ثمرة صغيرة (100 جم) موز/تفاح أخضر/كمثرى/جوافة/كيوي/برتقال/خوخ/مشمش، أو 1 كوب شمام/فراولة/بطيخ، أو ½ كوب مانجو/رمان، أو 10 عنب، أو 3 بلح",
  },
};

export const FORBIDDEN_FOODS =
  "المشروبات الغازية والمصنعة والعصائر (خصوصًا عصير القصب)، الشوكولاتة، الشيبسي، الكاراتيه، الإندومي، المنتجات المحفوظة والمصنعة والألوان الصناعية، الحلويات، المقليات.";

export const DIET_RULES = [
  "حصة فاكهة واحدة يوميًا (3 ملاعق صغيرة سكر/عسل/مربى/تمر = حصة فاكهة).",
  "النوم بعد الأكل بساعتين، والنوم المبكر قبل الساعة 11 مساءً.",
  "2 لتر ماء على 8 مرات على مدار اليوم.",
  "الشاشات الإلكترونية: 120 دقيقة على الأكثر.",
];

export const MUSCLES: Record<MuscleGroup, { label: string; color: string; weeklySetsMin: number; weeklySetsMax: number }> = {
  chest: { label: "الصدر", color: "#3b82f6", weeklySetsMin: 8, weeklySetsMax: 18 },
  back: { label: "الظهر", color: "#06b6d4", weeklySetsMin: 10, weeklySetsMax: 20 },
  shoulders: { label: "الأكتاف", color: "#8b5cf6", weeklySetsMin: 8, weeklySetsMax: 18 },
  biceps: { label: "البايسبس", color: "#f59e0b", weeklySetsMin: 6, weeklySetsMax: 14 },
  triceps: { label: "الترايسبس", color: "#ef4444", weeklySetsMin: 6, weeklySetsMax: 14 },
  forearms: { label: "الساعد", color: "#84cc16", weeklySetsMin: 3, weeklySetsMax: 10 },
  quads: { label: "الفخذ الأمامي", color: "#10b981", weeklySetsMin: 8, weeklySetsMax: 18 },
  hamstrings: { label: "الفخذ الخلفي", color: "#14b8a6", weeklySetsMin: 6, weeklySetsMax: 14 },
  calves: { label: "السمانة", color: "#ec4899", weeklySetsMin: 6, weeklySetsMax: 14 },
  adductors: { label: "الفخذ الداخلي", color: "#f97316", weeklySetsMin: 2, weeklySetsMax: 8 },
  abs: { label: "البطن", color: "#a3e635", weeklySetsMin: 4, weeklySetsMax: 12 },
  traps: { label: "الترابيس", color: "#64748b", weeklySetsMin: 2, weeklySetsMax: 8 },
};

export const SPLITS: Record<SplitKey, { label: string; en: string; short: string; focus: string }> = {
  anterior_a: { label: "الجزء الأمامي أ", en: "Anterior A", short: "A·A", focus: "صدر · أكتاف · كوادز · ترايسبس" },
  posterior_a: { label: "الجزء الخلفي أ", en: "Posterior A", short: "P·A", focus: "ظهر · هامسترنج · بايسبس · سمانة" },
  anterior_b: { label: "الجزء الأمامي ب", en: "Anterior B", short: "A·B", focus: "صدر علوي · أكتاف · كوادز · ترايسبس" },
  posterior_b: { label: "الجزء الخلفي ب", en: "Posterior B", short: "P·B", focus: "ظهر · هامسترنج · بايسبس · ترابيس" },
};
export const SPLIT_ORDER: SplitKey[] = ["anterior_a", "posterior_a", "anterior_b", "posterior_b"];
/** Anterior A → Posterior A → rest → Anterior B → Posterior B → rest → rest */
export const CYCLE: (SplitKey | "rest")[] = ["anterior_a", "posterior_a", "rest", "anterior_b", "posterior_b", "rest", "rest"];

export const SESSION_LABEL: Record<SessionKind, string> = {
  anterior_a: "Anterior A",
  posterior_a: "Posterior A",
  anterior_b: "Anterior B",
  posterior_b: "Posterior B",
  cardio: "كارديو / مشي",
  custom: "تمرين حر",
};

export const WARMUP_PROTOCOL = [
  { reps: "10 لكل جانب", name: "Pallof Press" },
  { reps: "10 لكل جانب", name: "Pallof Rotation" },
  { reps: "10", name: "External Rotation" },
  { reps: "10", name: "Scapula Push Plus" },
];

export const SPECIFIC_WARMUP = [
  { type: "تمرين خفيف", sets: "مجموعة واحدة: ≈60% من الوزن الفعلي × 3–6 عدات" },
  { type: "تمرين متوسط الشدة", sets: "مجموعتان: ≈50% × 3–6، ثم 75–80% × 3" },
  { type: "تمرين ثقيل", sets: "2–4 مجاميع: ≈50% × 3–6، 75–80% × 3، 85–90% × 1–3" },
];

export const WORKOUT_RULES = [
  "الفشل العضلي = ألا تستطيع الأداء بمدى حركي كامل وبجودة قريبة من أول عدة. لو عارف إن العدة الجاية مش هتبقى كاملة، متحاولش.",
  "متزودش مجاميع ولا تمارين ولا تغيّر الترتيب قبل 12 أسبوعًا من تجربة البرنامج كما هو.",
  "المسموح الوحيد: زيادة تدريجية في الأحمال (عدات أو وزن).",
  "لو هتتمرن أكثر من 4 مرات أسبوعيًا، أعد الدورة بعد يوم راحة واحد فقط.",
];

export const NAV = [
  { href: "/", label: "لوحة التحكم", icon: "LayoutDashboard" },
  { href: "/coach", label: "المدرب الذكي", icon: "Brain" },
  { href: "/nutrition", label: "التغذية", icon: "Utensils" },
  { href: "/water", label: "الماء", icon: "Droplets" },
  { href: "/medications", label: "الأدوية", icon: "Pill" },
  { href: "/workouts", label: "التمارين", icon: "Dumbbell" },
  { href: "/measurements", label: "القياسات", icon: "Ruler" },
  { href: "/photos", label: "الصور", icon: "Camera" },
  { href: "/sleep", label: "النوم", icon: "Moon" },
  { href: "/insights", label: "التحليلات", icon: "Sparkles" },
  { href: "/reports", label: "التقارير", icon: "FileBarChart" },
  { href: "/doctor", label: "تقرير الطبيب", icon: "Stethoscope" },
  { href: "/settings", label: "الإعدادات", icon: "Settings" },
] as const;
