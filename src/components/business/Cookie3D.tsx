"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

// The real Crooki cookie stack as a "3D photo" that turns and floats. The
// static cut-out is always in the HTML (fixed box, no layout shift) and stays
// when the visitor prefers reduced motion, has no WebGL, or until the shader
// has drawn its first frame.
export default function Cookie3D({
  className = "",
  fallbackSrc,
  fallbackAlt,
}: {
  className?: string;
  fallbackSrc: string;
  fallbackAlt: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const probe = document.createElement("canvas");
    if (!probe.getContext("webgl2") && !probe.getContext("webgl")) return;

    let scene: import("./cookie-scene").CookieScene | null = null;
    let visible = false;
    let cancelled = false;
    const sync = () => {
      if (!scene) return;
      if (visible && !document.hidden) scene.start();
      else scene.stop();
    };

    // Load the shader only when the cookie is about to scroll into view, then keep
    // it paused whenever it is off screen or the tab is hidden.
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !scene && !cancelled) {
          import("./cookie-scene").then(({ createCookieScene }) => {
            if (cancelled) return;
            try {
              scene = createCookieScene(box, () => setReady(true));
              sync();
            } catch {
              scene = null; // WebGL context refused: the photo stays
            }
          });
        }
        sync();
      },
      { rootMargin: "200px" },
    );
    io.observe(box);
    const ro = new ResizeObserver(() => scene?.resize());
    ro.observe(box);
    document.addEventListener("visibilitychange", sync);

    return () => {
      cancelled = true;
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", sync);
      scene?.dispose();
    };
  }, []);

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      {/* soft contact shadow under the stack */}
      <div aria-hidden="true" className="absolute left-[18%] right-[18%] bottom-[2%] h-[8%] rounded-[50%] bg-black/35 blur-md" />
      <Image
        src={fallbackSrc}
        alt={fallbackAlt}
        fill
        sizes="256px"
        className={`object-contain p-[5%] transition-opacity duration-700 ${ready ? "opacity-0" : "opacity-100"}`}
      />
    </div>
  );
}
