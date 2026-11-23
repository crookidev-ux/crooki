import type { CSSProperties } from "react";
import Image from "next/image";
import Cookie3D from "@/components/business/Cookie3D";
import Tilt from "@/components/business/Tilt";
import { BUSINESS_HERO_IMAGE } from "@/lib/business-catalog";

// Falling crumbs only run when the visitor allows motion.
const css = `
@keyframes biz-crumb{0%{transform:translate3d(0,0,0) rotate(0);opacity:0}15%{opacity:.9}100%{transform:translate3d(var(--dx),150px,0) rotate(220deg);opacity:0}}
.biz-crumb{display:none}
@media (prefers-reduced-motion:no-preference){
  .biz-crumb{display:block;animation:biz-crumb var(--d) ease-in var(--delay) infinite}
}`;

const CRUMBS = [
  { left: "18%", size: 7, dx: "-14px", d: "3.4s", delay: "0s", radius: "45% 55% 40% 60%" },
  { left: "42%", size: 5, dx: "10px", d: "4.1s", delay: "1.2s", radius: "60% 40% 55% 45%" },
  { left: "62%", size: 8, dx: "-6px", d: "3.8s", delay: "2.1s", radius: "50% 50% 35% 65%" },
  { left: "30%", size: 4, dx: "18px", d: "4.6s", delay: "0.6s", radius: "40% 60% 60% 40%" },
  { left: "75%", size: 6, dx: "-20px", d: "3.6s", delay: "2.8s", radius: "55% 45% 50% 50%" },
];

// The Christmas boxes photo with the 3D cookie stack floating on its corner.
// Shared by the home business section and the /empresas header.
export default function BusinessVisual({ alt, priority = false }: { alt: string; priority?: boolean }) {
  return (
    <div className="relative mx-auto w-full max-w-sm lg:max-w-md mb-10 lg:mb-0">
      <style href="business-visual" precedence="default">{css}</style>
      <div className="absolute -inset-3 rounded-[2.5rem] bg-white/10 -rotate-3" aria-hidden="true" />
      <Tilt className="rounded-[2rem]">
        <Image
          src={BUSINESS_HERO_IMAGE}
          alt={alt}
          width={1121}
          height={1403}
          sizes="(min-width: 1024px) 448px, (min-width: 640px) 384px, 90vw"
          priority={priority}
          className="relative w-full aspect-[4/5] max-h-[70vh] object-cover rounded-[2rem] shadow-2xl"
        />
      </Tilt>

      <div className="pointer-events-none absolute -bottom-12 -left-6 md:-left-20 w-40 h-44 md:w-60 md:h-64">
        <Cookie3D className="w-full h-full" fallbackSrc="/images/empresas/galletas-stack.webp" fallbackAlt="" />
        <div aria-hidden="true" className="absolute inset-x-0 top-1/2 h-40">
          {CRUMBS.map((c) => (
            <span
              key={c.left}
              className="biz-crumb absolute top-0 bg-[#d9a45f] shadow-sm"
              style={
                {
                  left: c.left,
                  width: c.size,
                  height: c.size,
                  borderRadius: c.radius,
                  "--dx": c.dx,
                  "--d": c.d,
                  "--delay": c.delay,
                } as CSSProperties
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
