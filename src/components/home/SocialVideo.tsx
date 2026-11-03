"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";

interface Props {
  src: string;
  poster: string;
}

// Muted, looping clip that plays only while it is on screen (like the feed),
// and only downloads once it gets close. With reduced motion it waits for a tap.
export default function SocialVideo({ src, poster }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => setReducedMotion(motion.matches);
    onMotion();
    motion.addEventListener("change", onMotion);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !motion.matches) {
          // Autoplay can be refused (e.g. low-power mode): the poster stays.
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.6 },
    );
    observer.observe(video);
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", onMotion);
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <video
        ref={ref}
        src={src}
        poster={poster}
        muted
        loop
        playsInline
        preload="none"
        aria-hidden="true"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className="w-full h-full object-cover"
      />
      {reducedMotion && !playing && (
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <span className="w-12 h-12 rounded-full bg-black/45 flex items-center justify-center">
            <Play className="w-5 h-5 text-white ml-0.5" />
          </span>
        </span>
      )}
    </div>
  );
}
