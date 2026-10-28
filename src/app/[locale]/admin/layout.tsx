import { createClient } from "@/lib/supabase/server";
import AdminNav from "@/components/admin/AdminNav";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Allow login page without auth
  // For other admin pages, redirect if not authenticated
  // We handle this by checking the URL in the child pages

  return (
    <div className="min-h-screen bg-gray-50">
      {user && <AdminNav locale={locale} user={user} />}
      <div className={user ? "max-w-6xl mx-auto px-4 py-8" : ""}>
        {children}
      </div>
    </div>
  );
}
