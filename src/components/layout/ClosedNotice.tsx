"use client";

import { useTranslations } from "next-intl";
import { Clock } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useStoreHours } from "@/components/order/useStoreHours";

/** Thin bar under the header while the shop is closed (9 p.m. – 11 a.m.). */
export default function ClosedNotice() {
  const t = useTranslations("hours");
  const hours = useStoreHours();
  if (!hours || hours.open) return null;

  return (
    <div role="status" className="bg-[#fdf8f0] border-b border-[#f3c78b] text-[#8b0031]">
      <p className="max-w-6xl mx-auto px-4 py-2.5 text-sm flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center">
        <Clock aria-hidden="true" className="w-4 h-4 shrink-0" />
        <span className="font-semibold">{t(hours.opensToday ? "closed_today" : "closed_tomorrow")}</span>
        <Link href="/menu" className="underline underline-offset-2 font-medium">
          {t("closed_cta")}
        </Link>
      </p>
    </div>
  );
}
