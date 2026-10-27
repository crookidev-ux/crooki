import { parseActiveSeason, type SeasonId } from "./seasons";

// The season the admin switched on, read on every home request. Any failure
// (no Supabase env, missing table, network) means "no season": the home
// renders exactly as it does without decoration.
export async function getActiveSeason(): Promise<SeasonId | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("your_")) {
    return null;
  }
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("site_settings")
      .select("active_season")
      .eq("id", 1)
      .maybeSingle();
    if (error) return null;
    return parseActiveSeason(data?.active_season);
  } catch {
    return null;
  }
}
