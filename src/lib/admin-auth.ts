import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Session + allowlist check, once per request (the admin layout and the page
 * both ask). A session alone is not enough: the account must be in
 * `admin_users` (migration 20261104000200). RLS enforces the same rule on
 * every write.
 */
export const getAdminSession = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, isAdmin: false };
  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  if (error) console.error("[admin-auth] is_admin check failed", error);
  return { supabase, user, isAdmin: !error && isAdmin === true };
});

export async function requireAdmin(locale: string) {
  const { supabase, user, isAdmin } = await getAdminSession();
  if (!user) redirect(`/${locale}/admin/login`);
  // Signed in but not on the allowlist: say so on the login page.
  if (!isAdmin) redirect(`/${locale}/admin/login?sin-permiso=1`);
  return { user, supabase };
}
