import { redirect } from "next/navigation";
import AdminLoginClient from "@/components/admin/AdminLoginClient";
import { getAdminSession } from "@/lib/admin-auth";

export default async function AdminLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ "sin-permiso"?: string }>;
}) {
  const [{ locale }, sp, { isAdmin }] = await Promise.all([params, searchParams, getAdminSession()]);
  if (isAdmin) redirect(`/${locale}/admin`);
  return <AdminLoginClient noAccess={sp["sin-permiso"] === "1"} />;
}
