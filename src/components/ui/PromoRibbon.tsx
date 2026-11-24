import { useTranslations } from "next-intl";
import { BadgePercent, Gem, Sparkles, Star, TreePine, Zap, type LucideIcon } from "lucide-react";
import type { PromoTag } from "@/lib/promo";

// Fixed look per tag; every text/band pair passes WCAG AA (≥ 4.5:1).
const STYLES: Record<PromoTag, { icon: LucideIcon; band: string; text: string; edge: string }> = {
  black_friday: { icon: Zap, band: "#0b0b0c", text: "#f3c78b", edge: "#c9954f" },
  oferta: { icon: BadgePercent, band: "#8b0031", text: "#fdf8f0", edge: "#5c0020" },
  navidad: { icon: TreePine, band: "#14532d", text: "#fdf8f0", edge: "#b91c1c" },
  nuevo: { icon: Sparkles, band: "#fdf8f0", text: "#8b0031", edge: "#8b0031" },
  mas_vendido: { icon: Star, band: "#f3c78b", text: "#5c0020", edge: "#c9954f" },
  edicion_limitada: { icon: Gem, band: "#3b0016", text: "#f3c78b", edge: "#c9954f" },
};

/**
 * Ribbon pinned to the top-left corner of a product photo (the parent must be
 * `relative`). Shared by the menu, merch and home cards, and the Christmas
 * pages next.
 */
export default function PromoRibbon({ tag, className = "" }: { tag: PromoTag; className?: string }) {
  const t = useTranslations("promo");
  const s = STYLES[tag];
  const Icon = s.icon;
  const isBlackFriday = tag === "black_friday";
  const label = t(`tags.${tag}`);

  return (
    <span
      className={`absolute left-0 top-4 z-10 inline-flex items-center gap-1.5 overflow-hidden rounded-r-full py-2 pl-3.5 pr-4 text-[11px] font-black uppercase leading-none tracking-[0.16em] ${className}`}
      style={{
        backgroundColor: s.band,
        color: s.text,
        // The left stripe reads as the ribbon's fold; Black Friday adds a gold hairline.
        boxShadow: `inset 4px 0 0 ${s.edge}${isBlackFriday ? `, inset 0 0 0 1px ${s.edge}80` : ""}, 0 8px 18px -8px rgba(0,0,0,.55)`,
      }}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
      {isBlackFriday ? (
        <span
          className="bg-clip-text text-transparent"
          style={{ backgroundImage: "linear-gradient(100deg, #fbe7c2 0%, #f3c78b 45%, #d9a55b 100%)" }}
        >
          {label}
        </span>
      ) : (
        label
      )}
      {isBlackFriday && (
        <span
          aria-hidden="true"
          className="promo-sheen pointer-events-none absolute inset-y-0 left-0 w-1/3 -translate-x-[120%]"
          style={{ background: "linear-gradient(90deg, transparent, rgba(251,231,194,.3), transparent)" }}
        />
      )}
    </span>
  );
}
