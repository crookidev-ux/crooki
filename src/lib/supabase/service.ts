// Server-only: a Supabase client that always acts as the service role. It
// ignores the visitor's session, so a logged-in admin's JWT can never replace
// the service role, and it does not call cookies(), so it is safe inside
// after(). The `server-only` import makes the build fail if a "use client"
// module ever pulls it in.
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createServiceClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
