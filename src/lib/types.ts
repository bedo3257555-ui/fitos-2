export type ID = string;
export type DateStr = string; // YYYY-MM-DD (device-local calendar day)

export type FoodGroup = "starch" | "meat" | "veg" | "fruit" | "dairy" | "fat" | "legumes";
export type MealKey = "breakfast" | "lunch" | "dinner" | "snack";
export type SplitKey = "anterior_a" | "posterior_a" | "anterior_b" | "posterior_b";
export type SessionKind = SplitKey | "cardio" | "custom";
export type MuscleGroup =
  | "chest" | "back" | "shoulders" | "biceps" | "triceps" | "forearms"
  | "quads" | "hamstrings" | "calves" | "adductors" | "abs" | "traps";
export type PhotoAngle = "front" | "side" | "back";

export type Servings = Record<FoodGroup, number>;

export interface Goals {
  calories: number;
  protein_g: number;
  water_ml: number;
  sleep_hours: number;
  bedtime_before: string; // HH:mm
  screen_max_min: number;
  workouts_per_week: number;
  cardio_days_per_week: number;
  target_weight_kg: number;
  servings: Servings;
  plan_start: DateStr;
  reminders: { meds: boolean; water: boolean; meals: boolean; sleep: boolean; workout: boolean };
  meal_times: Record<MealKey, string>;
}

export interface Profile {
  id: ID;
  full_name: string;
  birth_date: DateStr | null;
  age: number;
  height_cm: number;
  sex: "male" | "female";
  doctor: string;
  goals: Goals;
}

export interface Measurement {
  id: ID;
  date: DateStr;
  source: "manual" | "inbody";
  weight_kg: number | null;
  waist_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  body_fat_pct: number | null;
  muscle_mass_kg: number | null; // SMM
  fat_mass_kg: number | null;
  bmi: number | null;
  bmr: number | null;
  visceral_fat: number | null;
  body_water_l: number | null;
  inbody_score: number | null;
  notes: string;
}

export interface MedSlot {
  id: string;
  label: string; // e.g. "قبل الفطار بساعة"
  time: string; // HH:mm
}

export interface Medication {
  id: ID;
  name: string;
  kind: "medication" | "supplement";
  dose: string;
  instructions: string;
  slots: MedSlot[];
  active: boolean;
  color: string;
  notes: string;
  sort: number;
}

export type DoseStatus = "taken" | "missed" | "skipped";
export interface MedLog {
  id: ID;
  date: DateStr;
  medication_id: ID;
  slot_id: string;
  status: DoseStatus;
  taken_at: string | null; // ISO
}

export interface MealLog {
  id: ID;
  date: DateStr;
  meal: MealKey;
  group: FoodGroup | "extra";
  servings: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  note: string;
}

export interface WaterLog {
  id: ID;
  date: DateStr;
  amount_ml: number;
  logged_at: string; // ISO
}

export interface SleepLog {
  id: ID;
  date: DateStr; // wake-up date
  bedtime: string; // HH:mm
  wake_time: string; // HH:mm
  duration_h: number;
  quality: number; // 1..5
  notes: string;
}

export interface Checkin {
  id: ID;
  date: DateStr;
  screen_minutes: number | null;
  energy: number | null; // 1..5
  notes: string;
}

export interface Exercise {
  id: ID;
  split: SplitKey;
  sort: number;
  name: string;
  muscle: MuscleGroup;
  warmup_sets: string;
  work_sets: number;
  rep_min: number;
  rep_max: number;
  rest_min: number | null;
  rest_max: number | null;
  alt1: string;
  alt2: string;
  notes: string;
}

export interface WorkoutSession {
  id: ID;
  date: DateStr;
  kind: SessionKind;
  status: "in_progress" | "completed";
  started_at: string;
  duration_min: number | null;
  notes: string;
}

export interface WorkoutSet {
  id: ID;
  session_id: ID;
  date: DateStr;
  exercise_id: ID | null;
  exercise_name: string;
  muscle: MuscleGroup;
  set_no: number;
  weight_kg: number;
  reps: number;
  rir: number | null;
  rpe: number | null;
  is_warmup: boolean;
  notes: string;
}

export interface Photo {
  id: ID;
  date: DateStr;
  angle: PhotoAngle;
  path: string; // storage path (Supabase) or data URL (local mode)
  weight_kg: number | null;
  note: string;
}

export interface ServerInsight {
  id: ID;
  date: DateStr;
  kind: InsightKind;
  title: string;
  body: string;
  severity: number;
}

export interface DB {
  profile: Profile | null;
  measurements: Measurement[];
  medications: Medication[];
  med_logs: MedLog[];
  meal_logs: MealLog[];
  water_logs: WaterLog[];
  sleep_logs: SleepLog[];
  checkins: Checkin[];
  exercises: Exercise[];
  sessions: WorkoutSession[];
  sets: WorkoutSet[];
  photos: Photo[];
  insights: ServerInsight[];
}

export type TableName = Exclude<keyof DB, "profile"> | "profiles";

export type InsightKind = "insight" | "recommendation" | "warning" | "achievement";
export interface Insight {
  id: string;
  kind: InsightKind;
  title: string;
  body: string;
  area: "body" | "nutrition" | "water" | "meds" | "workout" | "sleep" | "general";
  severity: number; // 1 low .. 3 high
  date: DateStr;
}
