import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { MapPin } from "lucide-react";
import Crumbs from "./Crumbs";

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

const MAPS_URL = "https://maps.app.goo.gl/SKck7m5eoNfa3SBb6";
const INSTAGRAM_URL =
  "https://www.instagram.com/crookibakebar?igsh=MWJjcnJoazB5ZmxkaQ==";
const TIKTOK_URL =
  "https://www.tiktok.com/@crookibakebar?_r=1&_t=ZS-95JY49t8jcO";
const WHATSAPP_URL = "https://wa.me/573027190084";

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M21 8.2a7 7 0 0 1-4.1-1.3v7.8a6 6 0 1 1-6-6v3.2a2.8 2.8 0 1 0 2 2.7V2h3a4.1 4.1 0 0 0 5.1 4.1V8.2Z" />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M19.1 17.3c-.3-.2-1.8-.9-2.1-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7.1a8.5 8.5 0 0 1-2.5-1.5 9.2 9.2 0 0 1-1.7-2.1c-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5a2 2 0 0 0 .3-.5.5.5 0 0 0 0-.5l-.9-2.3c-.3-.7-.5-.6-.7-.6h-.6a1.1 1.1 0 0 0-.8.4 3.3 3.3 0 0 0-1 2.5c0 1.5 1.1 2.9 1.2 3.1s2.1 3.3 5.1 4.6c1.7.8 2.4.8 3.3.7a3 3 0 0 0 2-1.4 2.5 2.5 0 0 0 .2-1.4c-.1-.1-.3-.2-.6-.4Zm-5 6.5a9.8 9.8 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.3-.4a9.9 9.9 0 1 1 8.4 4.6Zm8.4-18.3a11.8 11.8 0 0 0-18.5 14.2l-1.3 4.7 4.8-1.3a11.8 11.8 0 0 0 5.6 1.4 11.8 11.8 0 0 0 9.4-18.8Z" />
    </svg>
  );
}

export default function Footer() {
  const t = useTranslations("nav");
  const tc = useTranslations("contact");
  const tl = useTranslations("legal");
  const tf = useTranslations("footer");

  const heading = "text-xs font-bold uppercase tracking-[0.25em] text-[#f3c78b] mb-4";
  const link = "text-white/85 hover:text-white transition-colors";
  const social = "w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white hover:text-[#8b0031] transition-colors";

  return (
    <footer style={{ backgroundColor: "#8b0031" }} className="footer-bite relative -mt-10 overflow-hidden text-white">
      <Crumbs />
      <div className="relative max-w-6xl mx-auto px-4 pt-20 pb-8">
        {/* Call to action */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-10 border-b border-white/15 text-center md:text-left">
          <div>
            <h2 className="text-3xl md:text-4xl font-black">{tf("cta_title")}</h2>
            <p className="text-white/75 mt-2">{tf("cta_subtitle")}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/menu"
              className="bg-white text-[#8b0031] font-bold px-6 py-3 rounded-full hover:bg-red-50 transition-colors"
            >
              {t("order")} →
            </Link>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 border-2 border-white/70 font-bold px-6 py-3 rounded-full hover:bg-white/10 transition-colors"
            >
              <WhatsAppIcon className="w-5 h-5" />
              {tf("whatsapp")}
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-10 py-12 text-sm">
          {/* Brand */}
          <div className="md:col-span-4">
            <Image src="/crooki-wordmark.png" alt="Crooki" width={661} height={140} className="h-9 w-auto" />
            <p className="text-xs uppercase tracking-[0.4em] text-white/70 mt-2">Bake Bar</p>
            <p className="text-white/75 leading-relaxed mt-4 max-w-xs">{tf("tagline")}</p>
            <div className="flex gap-3 mt-6">
              <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" aria-label={tc("instagram")} className={social}>
                <InstagramIcon className="w-5 h-5" />
              </a>
              <a href={TIKTOK_URL} target="_blank" rel="noopener noreferrer" aria-label={tc("tiktok")} className={social}>
                <TikTokIcon className="w-5 h-5" />
              </a>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" aria-label={tc("whatsapp")} className={social}>
                <WhatsAppIcon className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Visit */}
          <div className="md:col-span-3">
            <h3 className={heading}>{tf("visit")}</h3>
            <address className="not-italic text-white/85 leading-relaxed">
              Calle 36 # 5-70
              <br />
              Centro Histórico
              <br />
              Cartagena de Indias, Colombia
            </address>
            <a
              href={MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-3 font-bold hover:text-[#f3c78b] transition-colors"
            >
              <MapPin className="w-4 h-4" />
              {tc("maps")} →
            </a>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={`block mt-2 ${link}`}>
              +57 302 719 0084
            </a>
          </div>

          {/* Hours */}
          <div className="md:col-span-3">
            <h3 className={heading}>{tf("hours")}</h3>
            <p className="text-white/85">{tf("hours_days")}</p>
            <p className="text-lg font-bold mt-1">{tf("hours_time")}</p>
          </div>

          {/* Explore */}
          <div className="md:col-span-2">
            <h3 className={heading}>{tf("explore")}</h3>
            <nav className="flex flex-col gap-2">
              <Link href="/" className={link}>{t("home")}</Link>
              <Link href="/menu" className={link}>{t("menu")}</Link>
              <Link href="/merch" className={link}>{t("merch")}</Link>
              <Link href="/legal/terminos-club-crooki" className={link}>{tf("club")}</Link>
              <Link href="/mi-pedido" className={link}>{t("my_order")}</Link>
            </nav>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/15 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-white/60 text-center">
          <p>
            © {new Date().getFullYear()} Crooki Bake Bar · Cartagena, Colombia. {tf("rights")}
          </p>
          <nav aria-label={tl("footer_title")} className="flex flex-wrap justify-center gap-x-5 gap-y-2">
            <Link href="/legal/politica-de-datos" className="hover:text-white transition-colors">
              {tl("data_policy")}
            </Link>
            <Link href="/legal/politica-de-cookies" className="hover:text-white transition-colors">
              {tl("cookie_policy")}
            </Link>
            <Link href="/legal/terminos-club-crooki" className="hover:text-white transition-colors">
              {tl("club_terms")}
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
