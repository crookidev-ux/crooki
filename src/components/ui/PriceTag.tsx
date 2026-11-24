import { useTranslations } from "next-intl";
import { effectivePrice, isSaleActive, type PromoFields } from "@/lib/promo";

const cop = (n: number) => `$${n.toLocaleString("es-CO")}`;

/**
 * Effective price, with the normal price struck through while a sale is
 * active. `chip` is the badge on a photo; `inline` sits in the card text.
 */
export default function PriceTag({
  product,
  variant = "inline",
  className = "",
}: {
  product: PromoFields;
  variant?: "chip" | "inline";
  className?: string;
}) {
  const t = useTranslations("promo");
  const now = effectivePrice(product);
  const onSale = isSaleActive(product);
  const was = Math.round(Number(product.price));
  const chip = variant === "chip";

  const style = chip
    ? onSale
      ? { backgroundColor: "#ffffff", color: "#8b0031" }
      : { backgroundColor: "#8b0031", color: "#ffffff" }
    : { color: "#8b0031" };

  return (
    <span
      className={`inline-flex items-baseline gap-1.5 font-black ${chip ? "rounded-full px-3 py-1.5 text-sm shadow-lg" : "text-xl"} ${className}`}
      style={style}
    >
      {onSale && (
        <>
          <span className="sr-only">{t("was_now", { was: cop(was), now: cop(now) })}</span>
          <del aria-hidden="true" className={`font-semibold text-gray-500 ${chip ? "text-xs" : "text-sm"}`}>
            {cop(was)}
          </del>
        </>
      )}
      <span aria-hidden={onSale || undefined}>{cop(now)}</span>
    </span>
  );
}
