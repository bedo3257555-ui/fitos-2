import { DEFAULT_SERVINGS, MEALS } from "./constants";
import type { Exercise, Goals, Measurement, Medication, MuscleGroup, Profile, SplitKey } from "./types";
import { uid } from "./dates";

export const DEFAULT_GOALS: Goals = {
  calories: 1595,
  protein_g: 66,
  water_ml: 2000,
  sleep_hours: 8,
  bedtime_before: "23:00",
  screen_max_min: 120,
  workouts_per_week: 4,
  cardio_days_per_week: 5,
  target_weight_kg: 75.7,
  servings: DEFAULT_SERVINGS,
  plan_start: "2026-06-13",
  reminders: { meds: true, water: true, meals: true, sleep: true, workout: true },
  meal_times: {
    breakfast: MEALS.breakfast.defaultTime,
    lunch: MEALS.lunch.defaultTime,
    dinner: MEALS.dinner.defaultTime,
    snack: MEALS.snack.defaultTime,
  },
};

export function seedProfile(id: string): Profile {
  return {
    id,
    full_name: "عبد الرحمن إبراهيم الشرقاوي",
    birth_date: null,
    age: 22,
    height_cm: 178,
    sex: "male",
    doctor: "د. أحمد عبد العزيز — أخصائي التغذية العلاجية (Nutri-clinic)",
    goals: DEFAULT_GOALS,
  };
}

/** InBody120 history. Dates of readings 1–2 were not provided: approximated (edit them in القياسات). */
export function seedMeasurements(): Measurement[] {
  const base = {
    source: "inbody" as const, waist_cm: null, chest_cm: null, arm_cm: null, thigh_cm: null,
    fat_mass_kg: null, bmi: null, bmr: null, visceral_fat: null, body_water_l: null, inbody_score: null,
  };
  return [
    { ...base, id: uid(), date: "2026-06-13", weight_kg: 76.6, muscle_mass_kg: 33.8, body_fat_pct: 21.6, notes: "InBody — القراءة 1 (التاريخ تقريبي)" },
    { ...base, id: uid(), date: "2026-07-10", weight_kg: 78.2, muscle_mass_kg: 36.4, body_fat_pct: 17.3, notes: "InBody — القراءة 2 (التاريخ تقريبي)" },
    {
      ...base, id: uid(), date: "2026-07-29", weight_kg: 77.1, muscle_mass_kg: 36.2, body_fat_pct: 16.6,
      fat_mass_kg: 12.8, bmi: 24.3, bmr: 1759, visceral_fat: 6, body_water_l: 47.4, inbody_score: 83,
      notes: "InBody120 — 29/07/2026 17:05 · FFM 64.3 كجم · الوزن المستهدف 75.7 كجم · نسبة الخصر/الورك 0.89",
    },
  ];
}

const slot = (id: string, label: string, time: string) => ({ id, label, time });

export function seedMedications(): Medication[] {
  const m = (
    sort: number, name: string, kind: Medication["kind"], dose: string, instructions: string,
    slots: Medication["slots"], color: string
  ): Medication => ({ id: uid(), sort, name, kind, dose, instructions, slots, active: true, color, notes: "" });
  return [
    m(1, "Nexum 40", "medication", "حبة", "قبل الفطار بساعة", [slot("s1", "قبل الفطار بساعة", "07:00")], "#3b82f6"),
    m(2, "Zinctron Cap", "supplement", "كبسولة", "قبل النوم", [slot("s1", "قبل النوم", "22:30")], "#8b5cf6"),
    m(3, "Digestozyme", "medication", "حبتان", "3 مرات يوميًا قبل الأكل", [
      slot("s1", "قبل الفطار", "07:45"), slot("s2", "قبل الغداء", "13:15"), slot("s3", "قبل العشاء", "20:45"),
    ], "#14b8a6"),
    m(4, "C. Retard 500", "supplement", "حبة", "بعد الغداء", [slot("s1", "بعد الغداء", "14:30")], "#f59e0b"),
    m(5, "Coloverin D", "medication", "حسب الروشتة", "3 مرات يوميًا قبل الأكل", [
      slot("s1", "قبل الفطار", "07:45"), slot("s2", "قبل الغداء", "13:15"), slot("s3", "قبل العشاء", "20:45"),
    ], "#ec4899"),
    m(6, "Semaneuro", "supplement", "قرص مص", "قرص مص يوميًا بعد الفطار", [slot("s1", "بعد الفطار", "08:30")], "#22c55e"),
    m(7, "Zandros", "medication", "حسب الروشتة", "بعد الفطار", [slot("s1", "بعد الفطار", "08:30")], "#ef4444"),
    m(8, "Peptamin Adult", "supplement", "5 مكاييل على 200 مل ماء", "صباحًا ومساءً", [
      slot("s1", "صباحًا", "09:30"), slot("s2", "مساءً", "18:30"),
    ], "#06b6d4"),
    m(9, "Isolated Whey Protein", "supplement", "1 مكيال على 300 مل ماء", "مكيال واحد يوميًا (التوقيت مرن — يفضّل بعد التمرين)", [slot("s1", "بعد التمرين / مرن", "17:30")], "#f97316"),
    m(10, "Creatine Monohydrate", "supplement", "1 مكيال على 300 مل ماء", "مكيال واحد يوميًا", [slot("s1", "يوميًا", "12:00")], "#a3e635"),
  ];
}

type Row = [string, MuscleGroup, string, number, number, number, number | null, number | null, string, string, string];
const E = (split: SplitKey, rows: Row[]): Omit<Exercise, "id">[] =>
  rows.map((r, i) => ({
    split, sort: i + 1, name: r[0], muscle: r[1], warmup_sets: r[2], work_sets: r[3], rep_min: r[4], rep_max: r[5],
    rest_min: r[6], rest_max: r[7], alt1: r[8], alt2: r[9], notes: r[10],
  }));

const PLAN: Omit<Exercise, "id">[] = [
  ...E("anterior_a", [
    ["Machine Shoulder Press", "shoulders", "1~2", 1, 6, 8, 3, 5, "DB Shoulder Press", "Smith Shoulder Press", "حاول متعملش أرش بزيادة وتقلبه صدر أكتر من كتف"],
    ["Chest Press Machine", "chest", "1~2", 3, 6, 10, 3, 5, "DB Flat Press", "Smith Flat Press", ""],
    ["Hack Squat", "quads", "1~3", 2, 5, 8, 3, 5, "Smith Squat", "Leg Press", "120 درجة من ثني الركبة تكفي لاستهداف الكوادز، بس حاول تنزل للآخر"],
    ["Machine Lateral Raises", "shoulders", "1~2", 3, 6, 8, 3, 5, "Cable Lateral Raises", "DB Lateral Raises", "حاول قد ما تقدر تخلي الحركة طالعة من كتفك لوحده مش جسمك كله"],
    ["Overhead Extension", "triceps", "0", 2, 6, 10, 3, 5, "DB Skull Crusher", "", "لو كوعك وجعك العب بوش داون عادي جدًا"],
    ["Butterfly", "chest", "1~2", 1, 6, 10, null, null, "", "", ""],
    ["Lat Pulldown Crunches", "abs", "0", 2, 6, 10, 3, 5, "Cable Crunch", "", "ركز إن الحركة تبقى طالعة من ثني وفرد عمودك الفقري، مش ضهرك كله بيتحرك"],
    ["Leg Extension", "quads", "1~2", 1, 8, 12, 3, 5, "", "", "لو الجهاز مش موجود العب BANDED LEG EXTENSION"],
  ]),
  ...E("posterior_a", [
    ["T Bar Row", "back", "1~2", 2, 5, 7, 3, 5, "Incline DB Row", "Cable Row", "افتح كيعانك لبرة قد ما تقدر، وحاول تقرب من زاوية الـ 90 حسب راحة كتفك ومرونتك"],
    ["Machine Wide Grip Lat Pulldown", "back", "1~3", 3, 6, 8, 3, 5, "Cable Wide Grip Lat Pulldown", "", "ركز في مسار كوعك وإنك بتضم كتافك على بعض، مش بتسحب على ضهرك العلوي"],
    ["RDL", "hamstrings", "1~3", 1, 5, 8, 3, 5, "Hip Extension", "Hip Thrust", ""],
    ["SA Rear Delt Flies", "shoulders", "0", 1, 6, 10, 3, 5, "Reverse Pec Dec", "", "فك لوحي كتفك من قبل ما تبدأ الحركة وحاول تركز على كتفك الخلفي"],
    ["Seated Leg Curl", "hamstrings", "1~2", 2, 8, 12, 3, 5, "Lying Leg Curl", "", "لو الجهازين مش موجودين العبه SLDL"],
    ["Preacher Curl Machine", "biceps", "0", 2, 6, 10, 3, 5, "Face In Curls", "", "بلاش مدى حركي زيادة من الكتف ومتمرجحش جسمك، خلي الحركة كلها جاية من كوعك"],
    ["Leg Press Calf Raises", "calves", "1~2", 2, 5, 7, 3, 5, "Smith Calf Raises", "", "في أي تمرينة ركبتك مفرودة، حتى لو مسكت دامبل ناحية الرجل اللي بتلعب ووقفت على ستيب"],
    ["Wrist Curls", "forearms", "0", 2, 6, 10, 3, 5, "", "", "فط صوابعك تحت في الاستطالة واختار وزن يخليك تعمل انقباض كامل"],
  ]),
  ...E("anterior_b", [
    ["Incline Chest Press Machine", "chest", "1~2", 2, 6, 10, 3, 5, "DB Incline Press", "Smith Incline Press", "لو الجيم يسمح تلعب على الكيبل العب، لو الجهاز مش كويس"],
    ["Machine Shoulder Press", "shoulders", "1~2", 2, 6, 8, 3, 5, "DB Shoulder Press", "Smith Shoulder Press", "حاول متعملش أرش بزيادة وتقلبه صدر أكتر من كتف"],
    ["Leg Extension", "quads", "1~2", 3, 8, 12, 3, 5, "", "", "لو الجهاز مش موجود العب BANDED LEG EXTENSION"],
    ["Cable Lateral Raises", "shoulders", "1~2", 2, 6, 8, 3, 5, "DB Lateral Raises", "", "يا ريت يبقى على الكيبل، متبدلهوش"],
    ["SA Tricep Pushdown", "triceps", "0", 3, 6, 10, 3, 5, "Double Rope Pushdown", "", "متدخلش الكور بزيادة وتتمرجح وتحرك كتفك، هي فرد للكوع فقط"],
    ["Butterfly", "chest", "1~2", 1, 6, 10, null, null, "", "Cable Fly", "لو قربت الوزن ناحية كوعك يبقى أفضل، بس مش لازم"],
    ["Hip Adduction", "adductors", "1~2", 1, 6, 8, 3, 5, "Cable Hip Adduction", "", "ثبت نفسك بالمقبض كويس ومتحركش نفسك على الجهاز"],
    ["Reverse Grip Curls", "forearms", "0", 2, 6, 10, 3, 5, "DB Reverse Curl", "Barbell Reverse Curl", "تقدر تغير القبضات براحتك حسب اللي يريحك، المهم كله نفس الأداء"],
  ]),
  ...E("posterior_b", [
    ["T Bar Row", "back", "1~2", 2, 5, 7, 3, 5, "Incline DB Row", "Cable Row", "افتح كيعانك لبرة قد ما تقدر، وحاول تقرب من زاوية الـ 90 حسب راحة كتفك ومرونتك"],
    ["SA Lat Row", "back", "1~3", 2, 6, 8, 3, 5, "Cable SA Lat Row", "DB SA Lat Row", "بلاش تلف حوالين نفسك والتزم بثبات جسمك طول الحركة"],
    ["Face Away Curl", "biceps", "0", 2, 6, 10, 3, 5, "DB Curls", "", "بلاش مدى حركي زيادة من الكتف ومتمرجحش جسمك، خلي الحركة كلها جاية من كوعك"],
    ["RDL", "hamstrings", "1~3", 1, 5, 8, 3, 5, "Hip Extension", "Hip Thrust", ""],
    ["SA Rear Delt Flies", "shoulders", "0", 1, 6, 10, 3, 5, "Reverse Pec Dec", "", "فك لوحي كتفك من قبل ما تبدأ الحركة وحاول تركز على كتفك الخلفي"],
    ["Cable Shrugs", "traps", "1", 1, 6, 10, null, null, "", "", "بدله بأي تمرين براحتك: دامبل أو سميث أو أيًا كان، مش فارقة"],
    ["Seated Leg Curl", "hamstrings", "1~2", 2, 8, 12, 3, 5, "Lying Leg Curl", "", "لو الجهازين مش موجودين العبه SLDL"],
    ["Leg Press Calf Raises", "calves", "1~2", 2, 5, 7, 3, 5, "Smith Calf Raises", "", "في أي تمرينة ركبتك مفرودة، حتى لو مسكت دامبل ناحية الرجل اللي بتلعب ووقفت على ستيب"],
  ]),
];

export function seedExercises(): Exercise[] {
  return PLAN.map((e) => ({ ...e, id: uid() }));
}
