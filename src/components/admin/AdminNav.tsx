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

  const links = [
    { href: `/${locale}/admin`, icon: Package, label: t("products") },
    { href: `/${locale}/admin/categorias`, icon: Tag, label: "Categorías" },
    { href: `/${locale}/admin/temporadas`, icon: Sparkles, label: "Temporadas" },
    { href: `/${locale}/admin#orders`, icon: ShoppingBag, label: t("orders") },
  ];

  return (
    // Sticks right under the store header (h-16) instead of sliding beneath it.
    <div style={{ backgroundColor: "#8b0031" }} className="sticky top-16 z-40 text-white shadow-lg">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-black text-xl tracking-tight">CROOKI Admin</span>
          <nav className="hidden md:flex items-center gap-5 text-sm">
            {links.map(({ href, icon: Icon, label }) => (
              <a key={href} href={href} className="text-white/80 hover:text-white flex items-center gap-1.5 transition-colors">
                <Icon className="w-4 h-4" />
                {label}
              </a>
            ))}
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
      {/* Phones: the same links as a swipeable row */}
      <nav className="md:hidden flex gap-2 overflow-x-auto px-4 pb-3 text-sm [scrollbar-width:none]">
        {links.map(({ href, icon: Icon, label }) => (
          <a
            key={href}
            href={href}
            className="shrink-0 flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-white/90"
          >
            <Icon className="w-4 h-4" />
            {label}
          </a>
        ))}
      </nav>
    </div>
  );
}
