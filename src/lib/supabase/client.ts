import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

let client: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured");
  if (!client) client = createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
  return client;
}
