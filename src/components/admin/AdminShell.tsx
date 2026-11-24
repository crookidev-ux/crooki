"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import {
  CirclePlus,
  Clapperboard,
  Cookie,
  ExternalLink,
  Gift,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  Search,
  Sparkles,
  Tags,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

type Item = { href: string; label: string; icon: LucideIcon; active: boolean; count?: number | null };

interface Props {
  email: string;
  /** «Por preparar» badge; null when the count failed (no badge rather than a wrong 0). */
  toPrepare: number | null;
  storeOpen: boolean;
  children: React.ReactNode;
}

// Admin chrome (Dirección A): wine sidebar on desktop, top bar + bottom bar on
// phones. Pages render their own `.adm-page` inside <main>.
export default function AdminShell({ email, toPrepare, storeOpen, children }: Props) {
  const pathname = usePathname();
  const kind = useSearchParams().get("kind");
  const router = useRouter();
  // The phone «Más» menu remembers where it was opened, so navigating closes it.
  const here = `${pathname}?${kind ?? ""}`;
  const [openAt, setOpenAt] = useState<string | null>(null);
  const moreOpen = openAt === here;
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenAt(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  const inProducts = pathname.startsWith("/admin/productos");
  const isNavidad = inProducts && kind === "navidad";
  const home: Item = { href: "/admin", label: "Inicio", icon: LayoutDashboard, active: pathname === "/admin" };
  const orders: Item = {
    href: "/admin/pedidos",
    label: "Pedidos",
    icon: ReceiptText,
    active: pathname.startsWith("/admin/pedidos"),
    count: toPrepare,
  };
  const products: Item = { href: "/admin/productos", label: "Productos", icon: Cookie, active: inProducts && !isNavidad };
  const catalog: Item[] = [
    products,
    { href: "/admin/categorias", label: "Categorías", icon: Tags, active: pathname.startsWith("/admin/categorias") },
    { href: "/admin/productos?kind=navidad", label: "Navidad", icon: Gift, active: isNavidad },
  ];
  const site: Item[] = [
    { href: "/admin/temporadas", label: "Temporadas", icon: Sparkles, active: pathname.startsWith("/admin/temporadas") },
    { href: "/admin/redes", label: "Videos de redes", icon: Clapperboard, active: pathname.startsWith("/admin/redes") },
  ];
  const storeLabel = storeOpen ? "Tienda abierta" : "Tienda cerrada";

  const logout = async () => {
    const { error } = await createClient().auth.signOut();
    if (error) {
      toast.error(`No se pudo cerrar la sesión: ${error.message}`);
      return;
    }
    router.push("/admin/login");
    router.refresh();
  };

  const navLink = (it: Item) => (
    <Link key={it.href} href={it.href} aria-current={it.active ? "page" : undefined}>
      <it.icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
      {it.label}
      {it.count ? (
        <span className="adm-count">
          {it.count}
          <span className="sr-only"> por preparar</span>
        </span>
      ) : null}
    </Link>
  );

  return (
    <div className="adm">
      <a href="#contenido" className="adm-sr-skip">
        Saltar al contenido
      </a>

      {/* Phone top bar */}
      <header className="adm-mtop">
        <Image src="/crooki-wordmark.png" alt="Crooki" width={661} height={140} className="h-5 w-auto" />
        <span className="st">
          <span className={`adm-dot${storeOpen ? "" : " off"}`} aria-hidden="true" />
          {storeOpen ? "Abierta" : "Cerrada"}
        </span>
        <Link href="/admin/pedidos#buscar" className="adm-icon-btn" aria-label="Buscar pedido">
          <Search aria-hidden="true" className="h-[18px] w-[18px]" />
        </Link>
      </header>

      <div className="adm-app">
        <aside className="adm-side" aria-label="Menú del administrador">
          <div className="adm-logo">
            <Image src="/crooki-wordmark.png" alt="Crooki" width={661} height={140} className="h-[26px] w-auto" />
            <span>Admin</span>
          </div>
          <div className="adm-store">
            <span className={`adm-dot${storeOpen ? "" : " off"}`} aria-hidden="true" />
            <div>
              <b>{storeLabel}</b>
              <br />
              <span className="opacity-80">Todos los días 11:00 a. m. – 9:00 p. m.</span>
            </div>
          </div>
          <nav className="adm-nav" aria-label="Secciones">
            {navLink(home)}
            {navLink(orders)}
            <div className="adm-nav-label">Catálogo</div>
            {catalog.map(navLink)}
            <div className="adm-nav-label">Sitio web</div>
            {site.map(navLink)}
          </nav>
          <div className="adm-side-foot adm-nav">
            <a href="/" target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden="true" className="h-[18px] w-[18px]" />
              Ver tienda
              <span className="sr-only"> (se abre en otra pestaña)</span>
            </a>
            <div className="adm-user">
              <span className="adm-avatar" aria-hidden="true">
                {email.charAt(0) || "A"}
              </span>
              <span className="truncate" title={email}>
                {email}
              </span>
            </div>
            <button type="button" onClick={logout}>
              <LogOut aria-hidden="true" className="h-[18px] w-[18px]" />
              Cerrar sesión
            </button>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="adm-topbar">
            <form action="/admin/pedidos" role="search" className="adm-search" style={{ height: 40 }}>
              <Search aria-hidden="true" className="h-[18px] w-[18px]" />
              <label htmlFor="adm-global-search" className="sr-only">
                Buscar pedido
              </label>
              <input
                id="adm-global-search"
                name="q"
                type="search"
                placeholder="Buscar pedido: cliente, teléfono o número"
                autoComplete="off"
              />
            </form>
            <span className="flex-1" />
            <Link href="/admin/productos/nuevo" className="adm-btn adm-btn-primary">
              <CirclePlus aria-hidden="true" className="h-[18px] w-[18px]" />
              Nuevo producto
            </Link>
          </div>
          <main id="contenido">{children}</main>
        </div>
      </div>

      {/* Phone bottom bar */}
      {moreOpen && (
        <nav id="adm-more" className="adm-more-menu adm-nav" aria-label="Más secciones">
          {[...catalog.slice(1), ...site].map(navLink)}
          <a href="/" target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden="true" className="h-[18px] w-[18px]" />
            Ver tienda
          </a>
          <button type="button" onClick={logout}>
            <LogOut aria-hidden="true" className="h-[18px] w-[18px]" />
            Cerrar sesión
          </button>
        </nav>
      )}
      <nav className="adm-mnav" aria-label="Secciones principales">
        {[home, orders, products].map((it) => (
          <Link key={it.href} href={it.href} aria-current={it.active ? "page" : undefined}>
            <it.icon aria-hidden="true" className="h-5 w-5" />
            {it.label}
            {it.count ? <span className="adm-count">{it.count}</span> : null}
          </Link>
        ))}
        <Link
          href="/admin/productos/nuevo"
          aria-current={pathname === "/admin/productos/nuevo" ? "page" : undefined}
        >
          <CirclePlus aria-hidden="true" className="h-5 w-5" />
          Nuevo
        </Link>
        <button type="button" aria-expanded={moreOpen} aria-controls="adm-more" onClick={() => setOpenAt(moreOpen ? null : here)}>
          <Menu aria-hidden="true" className="h-5 w-5" />
          Más
        </button>
      </nav>
    </div>
  );
}
