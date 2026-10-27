"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { LogOut, Package, ShoppingBag, Sparkles, Tag } from "lucide-react";
import type { User } from "@supabase/supabase-js";

interface Props {
  locale: string;
  user: User;
}

export default function AdminNav({ locale, user }: Props) {
  const t = useTranslations("admin");
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
  };

  return (
    <div style={{ backgroundColor: "#8b0031" }} className="text-white shadow-lg">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-black text-xl tracking-tight">CROOKI Admin</span>
          <nav className="hidden md:flex items-center gap-5 text-sm">
            <a href={`/${locale}/admin`} className="text-white/80 hover:text-white flex items-center gap-1.5 transition-colors">
              <Package className="w-4 h-4" />
              {t("products")}
            </a>
            <a href={`/${locale}/admin/categorias`} className="text-white/80 hover:text-white flex items-center gap-1.5 transition-colors">
              <Tag className="w-4 h-4" />
              Categorías
            </a>
            <a href={`/${locale}/admin/temporadas`} className="text-white/80 hover:text-white flex items-center gap-1.5 transition-colors">
              <Sparkles className="w-4 h-4" />
              Temporadas
            </a>
            <a href={`/${locale}/admin#orders`} className="text-white/80 hover:text-white flex items-center gap-1.5 transition-colors">
              <ShoppingBag className="w-4 h-4" />
              {t("orders")}
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-white/70 text-sm hidden md:block">{user.email}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            {t("logout")}
          </button>
        </div>
      </div>
    </div>
  );
}
