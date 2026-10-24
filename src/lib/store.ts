import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "./supabase/client";
import type { DB, Profile } from "./types";
import { uid } from "./dates";

export type CollectionKey = Exclude<keyof DB, "profile">;

/** Mapping between app collections and Postgres tables. */
export const TABLES: Record<CollectionKey, string> = {
  measurements: "measurements",
  medications: "medications",
  med_logs: "med_logs",
  meal_logs: "meal_logs",
  water_logs: "water_logs",
  sleep_logs: "sleep_logs",
  checkins: "daily_checkins",
  exercises: "exercises",
  sessions: "workout_sessions",
  sets: "workout_sets",
  photos: "photos",
  insights: "insights",
};
export const COLLECTIONS = Object.keys(TABLES) as CollectionKey[];

export interface Store {
  mode: "local" | "supabase";
  userId: string;
  loadAll(): Promise<DB>;
  saveProfile(p: Profile): Promise<void>;
  upsert(key: CollectionKey, rows: { id: string }[]): Promise<void>;
  remove(key: CollectionKey, ids: string[]): Promise<void>;
  uploadPhoto(blob: Blob): Promise<string>;
  photoUrl(path: string): Promise<string>;
  deletePhotoFile(path: string): Promise<void>;
  wipe(): Promise<void>;
}

export const emptyDB = (): DB => ({
  profile: null, measurements: [], medications: [], med_logs: [], meal_logs: [], water_logs: [],
  sleep_logs: [], checkins: [], exercises: [], sessions: [], sets: [], photos: [], insights: [],
});

/* ------------------------------------------------------------------ Local (browser) ---- */
const LS = "fitos:v1:";
const read = <T,>(k: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(LS + k);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(LS + k, JSON.stringify(v));
  } catch (e) {
    throw new Error("تعذّر الحفظ: مساحة تخزين المتصفح ممتلئة. جرّب حذف بعض الصور أو ربط Supabase.");
  }
};

export function createLocalStore(): Store {
  return {
    mode: "local",
    userId: "local",
    async loadAll() {
      const db = emptyDB();
      db.profile = read<Profile | null>("profile", null);
      for (const k of COLLECTIONS) (db as unknown as Record<string, unknown>)[k] = read(k, []);
      return db;
    },
    async saveProfile(p) {
      write("profile", p);
    },
    async upsert(key, rows) {
      const cur = read<{ id: string }[]>(key, []);
      const map = new Map(cur.map((r) => [r.id, r]));
      rows.forEach((r) => map.set(r.id, r));
      write(key, [...map.values()]);
    },
    async remove(key, ids) {
      const set = new Set(ids);
      write(key, read<{ id: string }[]>(key, []).filter((r) => !set.has(r.id)));
    },
    async uploadPhoto(blob) {
      return await blobToDataUrl(blob);
    },
    async photoUrl(path) {
      return path;
    },
    async deletePhotoFile() {},
    async wipe() {
      Object.keys(localStorage).filter((k) => k.startsWith(LS)).forEach((k) => localStorage.removeItem(k));
    },
  };
}

/* ------------------------------------------------------------------------ Supabase ---- */
const PAGE = 1000;
const BUCKET = "progress-photos";

export function createSupabaseStore(userId: string): Store {
  const sb: SupabaseClient = getSupabase();
  const urlCache = new Map<string, { url: string; exp: number }>();

  async function fetchAll<T>(table: string): Promise<T[]> {
    const out: T[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await sb.from(table).select("*").order("id").range(from, from + PAGE - 1);
      if (error) throw error;
      out.push(...((data ?? []) as T[]));
      if (!data || data.length < PAGE) break;
    }
    return out;
  }
  const strip = (r: unknown) => {
    const { user_id: _u, created_at: _c, updated_at: _up, ...rest } = r as Record<string, unknown>;
    return rest;
  };

  return {
    mode: "supabase",
    userId,
    async loadAll() {
      const db = emptyDB();
      const { data: prof, error } = await sb.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (error) throw error;
      db.profile = (prof as Profile | null) ?? null;
      const results = await Promise.all(COLLECTIONS.map((k) => fetchAll(TABLES[k])));
      COLLECTIONS.forEach((k, i) => ((db as unknown as Record<string, unknown>)[k] = results[i].map(strip)));
      if (db.profile) db.profile = strip(db.profile) as unknown as Profile;
      return db;
    },
    async saveProfile(p) {
      const { error } = await sb.from("profiles").upsert({ ...p, id: userId });
      if (error) throw error;
    },
    async upsert(key, rows) {
      if (!rows.length) return;
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await sb.from(TABLES[key]).upsert(rows.slice(i, i + 500), { onConflict: "id" });
        if (error) throw error;
      }
    },
    async remove(key, ids) {
      if (!ids.length) return;
      const { error } = await sb.from(TABLES[key]).delete().in("id", ids);
      if (error) throw error;
    },
    async uploadPhoto(blob) {
      const path = `${userId}/${uid()}.jpg`;
      const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (error) throw error;
      return path;
    },
    async photoUrl(path) {
      if (path.startsWith("data:")) return path;
      const hit = urlCache.get(path);
      if (hit && hit.exp > Date.now()) return hit.url;
      const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600);
      if (error || !data) throw error ?? new Error("signed url failed");
      urlCache.set(path, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 });
      return data.signedUrl;
    },
    async deletePhotoFile(path) {
      if (path.startsWith("data:")) return;
      await sb.storage.from(BUCKET).remove([path]);
    },
    async wipe() {
      for (const k of [...COLLECTIONS].reverse()) {
        const { error } = await sb.from(TABLES[k]).delete().eq("user_id", userId);
        if (error) throw error;
      }
      await sb.from("profiles").delete().eq("id", userId);
    },
  };
}

/* ------------------------------------------------------------------------- helpers ---- */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}

/** Downscale + compress an image file to JPEG (max 1280px) before storing. */
export async function compressImage(file: File, maxSide = 1280, quality = 0.82): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("compress failed"))), "image/jpeg", quality));
}

export { isSupabaseConfigured };
