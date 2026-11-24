"use client";

import Image from "next/image";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import type { ProductImage } from "@/lib/types";

/**
 * Product photos: a swipeable scroll-snap track (touch on phones), arrows and
 * thumbnails (mouse/keyboard), and ←/→ when the track has focus. `overlay`
 * (the promo ribbon) sits on top of the track.
 */
export default function ProductGallery({
  images,
  name,
  overlay,
}: {
  images: ProductImage[];
  name: string;
  overlay?: ReactNode;
}) {
  const t = useTranslations("navidad");
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const total = images.length;

  const go = (i: number) => {
    const el = track.current;
    if (!el || total === 0) return;
    const next = (i + total) % total;
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    setActive(next);
  };

  // Keeps the thumbnails/dots in sync when the customer swipes.
  const onScroll = () => {
    const el = track.current;
    if (!el || el.clientWidth === 0) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== active && i >= 0 && i < total) setActive(i);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(active + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(active - 1); }
  };

  const frame = "relative aspect-square overflow-hidden rounded-3xl bg-[#fdf8f0] ring-1 ring-[#f3c78b]/60 shadow-xl";

  if (total === 0) {
    return (
      <div className={`${frame} flex items-center justify-center`}>
        <ImageOff aria-hidden="true" className="h-12 w-12 text-[#8b0031]/30" />
        {overlay}
      </div>
    );
  }

  const arrow =
    "absolute top-1/2 -translate-y-1/2 z-10 hidden sm:flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-[#8b0031] shadow-lg transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b0031]";

  return (
    <div>
      <div className={frame}>
        <div
          ref={track}
          role="region"
          aria-roledescription="carousel"
          aria-label={t("gallery", { name })}
          tabIndex={0}
          onScroll={onScroll}
          onKeyDown={onKeyDown}
          className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-[#8b0031]"
        >
          {images.map((img, i) => (
            <div
              key={img.id}
              role="group"
              aria-roledescription="slide"
              aria-label={t("photo_n", { n: i + 1, total })}
              className="relative h-full w-full shrink-0 snap-center"
            >
              <Image
                src={img.url}
                alt={total > 1 ? `${name} · ${t("photo_n", { n: i + 1, total })}` : name}
                fill
                sizes="(min-width: 1024px) 560px, (min-width: 768px) 50vw, 100vw"
                className="object-cover"
                priority={i === 0}
              />
            </div>
          ))}
        </div>
        {overlay}
        {total > 1 && (
          <>
            <button type="button" onClick={() => go(active - 1)} aria-label={t("prev_photo")} className={`${arrow} left-3`}>
              <ChevronLeft aria-hidden="true" className="h-6 w-6" />
            </button>
            <button type="button" onClick={() => go(active + 1)} aria-label={t("next_photo")} className={`${arrow} right-3`}>
              <ChevronRight aria-hidden="true" className="h-6 w-6" />
            </button>
            {/* Phone: dots over the photo (thumbnails take too much room) */}
            <div aria-hidden="true" className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/30 px-2.5 py-1.5 sm:hidden">
              {images.map((img, i) => (
                <span key={img.id} className={`h-1.5 rounded-full bg-white transition-all ${i === active ? "w-4" : "w-1.5 opacity-60"}`} />
              ))}
            </div>
          </>
        )}
      </div>

      {total > 1 && (
        <div className="mt-4 hidden sm:grid grid-cols-5 gap-3">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => go(i)}
              aria-label={t("show_photo", { n: i + 1 })}
              aria-current={i === active || undefined}
              className={`relative aspect-square overflow-hidden rounded-2xl bg-[#fdf8f0] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b0031] ${
                i === active ? "ring-2 ring-[#8b0031] ring-offset-2" : "opacity-70 hover:opacity-100"
              }`}
            >
              <Image src={img.url} alt="" fill sizes="110px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
