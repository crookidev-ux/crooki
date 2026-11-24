import type { Metadata } from "next";
import { getAdminSession } from "@/lib/admin-auth";
import { countTab } from "@/lib/admin-orders.server";
import { storeStatus } from "@/lib/store-hours";
import AdminShell from "@/components/admin/AdminShell";
import "./admin.css";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

// The admin has its own chrome (no shop header, footer or WhatsApp button) and
// is Spanish only. Each page still calls requireAdmin(): this layout only
// decides whether to draw the shell.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, isAdmin } = await getAdminSession();
  if (!user || !isAdmin) return <div className="adm">{children}</div>;

  const toPrepare = await countTab(supabase, "preparar");
  const store = storeStatus();
  return (
    <AdminShell email={user.email ?? ""} toPrepare={toPrepare} storeOpen={store.open}>
      {children}
    </AdminShell>
  );
}
