"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useCartStore } from "@/store/cart";
import { ShoppingBag, Menu, X } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export default function Header({ locale }: { locale: string }) {
  const t = useTranslations("nav");
  const { itemCount, openCart } = useCartStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { href: "/", label: t("home") },
    { href: "/menu", label: t("menu") },
    { href: "/merch", label: t("merch") },
    { href: "/legal/terminos-club-crooki", label: t("club") },
    { href: "/mi-pedido", label: t("my_order") },
  ];

  const switchLocale = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale });
  };

  const count = itemCount();

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        scrolled ? "bg-white shadow-md" : "bg-white"
      )}
    >
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <Image
            src="/crooki-wordmark-red.png"
            alt="Crooki Bake Bar"
            width={913}
            height={224}
            priority
            className="h-7 md:h-8 w-auto"
          />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm font-semibold uppercase tracking-wide transition-colors",
                pathname === link.href
                  ? "text-[#8b0031]"
                  : "text-gray-700 hover:text-[#8b0031]"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right: lang + cart */}
        <div className="flex items-center gap-3">
          {/* Language switcher */}
          <div className="hidden md:flex items-center gap-1 text-xs font-bold">
            <button
              onClick={() => switchLocale("es")}
              className={cn(
                "px-2 py-1 rounded transition-colors",
                locale === "es"
                  ? "text-[#8b0031]"
                  : "text-gray-500 hover:text-gray-800"
              )}
            >
              ES
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={() => switchLocale("en")}
              className={cn(
                "px-2 py-1 rounded transition-colors",
                locale === "en"
                  ? "text-[#8b0031]"
                  : "text-gray-500 hover:text-gray-800"
              )}
            >
              EN
            </button>
          </div>

          {/* Cart button */}
          <button
            onClick={openCart}
            className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Cart"
          >
            <ShoppingBag className="w-6 h-6 text-gray-700" />
            {count > 0 && (
              <span
                className="absolute -top-1 -right-1 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "#8b0031" }}
              >
                {count > 9 ? "9+" : count}
              </span>
            )}
          </button>

          {/* Mobile Order CTA */}
          <Link
            href="/menu"
            className="md:hidden text-white text-sm font-bold px-4 py-2 rounded-full"
            style={{ backgroundColor: "#8b0031" }}
          >
            {t("order")}
          </Link>

          {/* Desktop Order CTA */}
          <Link
            href="/menu"
            className="hidden md:flex text-white text-sm font-bold px-5 py-2 rounded-full transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#8b0031" }}
          >
            {t("order")}
          </Link>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            {mobileOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 flex flex-col gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="text-base font-semibold text-gray-700 hover:text-[#8b0031]"
            >
              {link.label}
            </Link>
          ))}
          <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
            <span className="text-sm text-gray-500">Idioma:</span>
            <button
              onClick={() => { switchLocale("es"); setMobileOpen(false); }}
              className={cn("text-sm font-bold", locale === "es" ? "text-[#8b0031]" : "text-gray-500")}
            >
              Español
            </button>
            <button
              onClick={() => { switchLocale("en"); setMobileOpen(false); }}
              className={cn("text-sm font-bold", locale === "en" ? "text-[#8b0031]" : "text-gray-500")}
            >
              English
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
