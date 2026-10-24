"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  COLLECTIONS, createLocalStore, createSupabaseStore, emptyDB, isSupabaseConfigured, type CollectionKey, type Store,
} from "@/lib/store";
import { seedExercises, seedMeasurements, seedMedications, seedProfile } from "@/lib/seed";
import { buildSample, isSample } from "@/lib/sample";
import { today, uid } from "@/lib/dates";
import { getSupabase } from "@/lib/supabase/client";
import type { DB, Profile } from "@/lib/types";

type Row<K extends CollectionKey> = DB[K][number];

interface Ctx {
  db: DB;
  profile: Profile;
  ready: boolean;
  mode: "local" | "supabase";
  error: string | null;
  clearError: () => void;
  save: <K extends CollectionKey>(key: K, row: Row<K>) => Row<K>;
  saveMany: <K extends CollectionKey>(key: K, rows: Row<K>[]) => void;
  remove: (key: CollectionKey, id: string) => void;
  removeMany: (key: CollectionKey, ids: string[]) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  photoUrl: (path: string) => Promise<string>;
  uploadPhoto: (blob: Blob) => Promise<string>;
  deletePhotoFile: (path: string) => Promise<void>;
  loadSample: () => void;
  clearSample: () => void;
  hasSample: boolean;
  wipeAll: () => Promise<void>;
  exportJSON: () => string;
  importJSON: (text: string) => string;
  signOut: () => Promise<void>;
}

const DataCtx = React.createContext<Ctx | null>(null);

export function useData(): Ctx {
  const c = React.useContext(DataCtx);
  if (!c) throw new Error("useData must be used inside <DataProvider>");
  return c;
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [db, setDb] = React.useState<DB>(emptyDB);
  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const storeRef = React.useRef<Store | null>(null);
  const dbRef = React.useRef(db);
  dbRef.current = db;

  const fail = React.useCallback((e: unknown) => {
    const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
    setError(msg);
  }, []);

  const init = React.useCallback(async () => {
    try {
      let store: Store;
      if (isSupabaseConfigured) {
        const { data } = await getSupabase().auth.getUser();
        if (!data.user) { router.replace("/login"); return; }
        store = createSupabaseStore(data.user.id);
      } else store = createLocalStore();
      storeRef.current = store;
      let loaded = await store.loadAll();
      if (!loaded.profile) {
        // first run: seed the doctor's plan, prescription and workout program
        const profile = seedProfile(store.userId);
        const measurements = seedMeasurements(), medications = seedMedications(), exercises = seedExercises();
        await store.saveProfile(profile);
        await store.upsert("measurements", measurements);
        await store.upsert("medications", medications);
        await store.upsert("exercises", exercises);
        loaded = { ...loaded, profile, measurements, medications, exercises };
      }
      setDb(loaded);
      setReady(true);
    } catch (e) {
      fail(e);
      setReady(true);
    }
  }, [fail, router]);

  React.useEffect(() => { void init(); }, [init]);

  const save = React.useCallback(<K extends CollectionKey>(key: K, row: Row<K>): Row<K> => {
    setDb((p) => {
      const list = p[key] as { id: string }[];
      const i = list.findIndex((r) => r.id === row.id);
      const next = i >= 0 ? list.map((r, j) => (j === i ? row : r)) : [...list, row];
      return { ...p, [key]: next } as DB;
    });
    storeRef.current?.upsert(key, [row as { id: string }]).catch(fail);
    return row;
  }, [fail]);

  const saveMany = React.useCallback(<K extends CollectionKey>(key: K, rows: Row<K>[]) => {
    if (!rows.length) return;
    setDb((p) => {
      const map = new Map((p[key] as { id: string }[]).map((r) => [r.id, r]));
      rows.forEach((r) => map.set(r.id, r));
      return { ...p, [key]: [...map.values()] } as DB;
    });
    storeRef.current?.upsert(key, rows as { id: string }[]).catch(fail);
  }, [fail]);

  const removeMany = React.useCallback((key: CollectionKey, ids: string[]) => {
    const set = new Set(ids);
    setDb((p) => ({ ...p, [key]: (p[key] as { id: string }[]).filter((r) => !set.has(r.id)) }) as DB);
    storeRef.current?.remove(key, ids).catch(fail);
  }, [fail]);
  const remove = React.useCallback((key: CollectionKey, id: string) => removeMany(key, [id]), [removeMany]);

  const updateProfile = React.useCallback((patch: Partial<Profile>) => {
    const cur = dbRef.current.profile;
    if (!cur) return;
    const next = { ...cur, ...patch, goals: { ...cur.goals, ...(patch.goals ?? {}) } };
    setDb((p) => ({ ...p, profile: next }));
    storeRef.current?.saveProfile(next).catch(fail);
  }, [fail]);

  const loadSample = React.useCallback(() => {
    if (storeRef.current?.mode !== "local") return;
    const s = buildSample(dbRef.current, today());
    (Object.keys(s) as CollectionKey[]).forEach((k) => saveMany(k, s[k] as never));
  }, [saveMany]);

  const clearSample = React.useCallback(() => {
    COLLECTIONS.forEach((k) => {
      const ids = (dbRef.current[k] as { id: string }[]).filter((r) => isSample(r.id)).map((r) => r.id);
      if (ids.length) removeMany(k, ids);
    });
  }, [removeMany]);

  const hasSample = React.useMemo(
    () => COLLECTIONS.some((k) => (db[k] as { id: string }[]).some((r) => isSample(r.id))),
    [db]
  );

  const wipeAll = React.useCallback(async () => {
    await storeRef.current?.wipe();
    setReady(false);
    setDb(emptyDB());
    await init();
  }, [init]);

  const exportJSON = React.useCallback(() => JSON.stringify({ exported_at: new Date().toISOString(), app: "fitos", ...dbRef.current }, null, 2), []);

  /** استعادة نسخة احتياطية: دمج (upsert) حسب المعرّف دون حذف أي بيانات حالية. */
  const importJSON = React.useCallback((text: string): string => {
    let obj: Record<string, unknown>;
    try { obj = JSON.parse(text) as Record<string, unknown>; } catch { throw new Error("الملف ليس JSON صالحًا."); }
    if (!obj || obj.app !== "fitos") throw new Error("هذا ليس ملف نسخة احتياطية من FitOS.");
    let rows = 0;
    COLLECTIONS.forEach((k) => {
      const list = obj[k];
      if (Array.isArray(list) && list.length) {
        const valid = list.filter((r): r is { id: string } => !!r && typeof (r as { id?: unknown }).id === "string");
        saveMany(k, valid as never);
        rows += valid.length;
      }
    });
    const p = obj.profile as Partial<Profile> | null | undefined;
    if (p && typeof p === "object") { const { id: _id, ...rest } = p; updateProfile(rest); }
    return `تمت استعادة ${rows} سجلًا`;
  }, [saveMany, updateProfile]);

  const signOut = React.useCallback(async () => {
    if (isSupabaseConfigured) {
      await getSupabase().auth.signOut();
      router.replace("/login");
    }
  }, [router]);

  const value = React.useMemo<Ctx>(() => ({
    db, profile: db.profile as Profile, ready, mode: storeRef.current?.mode ?? (isSupabaseConfigured ? "supabase" : "local"),
    error, clearError: () => setError(null), save, saveMany, remove, removeMany, updateProfile, importJSON,
    photoUrl: (p) => storeRef.current!.photoUrl(p), uploadPhoto: (b) => storeRef.current!.uploadPhoto(b),
    deletePhotoFile: (p) => storeRef.current!.deletePhotoFile(p), loadSample, clearSample, hasSample, wipeAll, exportJSON, signOut,
  }), [db, ready, error, save, saveMany, remove, removeMany, updateProfile, importJSON, loadSample, clearSample, hasSample, wipeAll, exportJSON, signOut]);

  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}

export { uid };
