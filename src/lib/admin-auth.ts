import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// A session alone is not enough: the account must be in `admin_users`
// (migration 20261104000200). RLS enforces the same rule on every write.
export async function requireAdmin(locale: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/${locale}/admin/login`);
  }
  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  if (error || isAdmin !== true) {
    if (error) console.error("[admin-auth] is_admin check failed", error);
    redirect(`/${locale}/admin/login`);
  }
  return { user, supabase };
}
