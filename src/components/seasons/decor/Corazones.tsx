import type { CSSProperties } from "react";
import Peekaboo from "../Peekaboo";
import { particles } from "./particles";

// Shared by San Valentín and Amor y Amistad: only the greeting differs.
const COLORS = ["#f7a8b8", "#f3c78b", "#ffffff", "#ff7a9a"];
// On wide screens the hearts keep to the photo's half, clear of the title.
const HEARTS = particles(18, 214, 2).map((h) => ({ ...h, side: 48 + h.left * 0.5 }));
const HEART = "M12 21s-7.5-4.6-10-9.3C.3 8.4 2.2 4 6.3 4c2.3 0 3.9 1.3 5.7 3.4C13.8 5.3 15.4 4 17.7 4c4.1 0 6 4.4 4.3 7.7C19.5 16.4 12 21 12 21z";

export function Ambient() {
  return (
    <div className="sz-layer" aria-hidden="true">
      {HEARTS.map((h, i) => (
        <span
          key={i}
          className={`sz-rise lg:[left:var(--side)]! ${h.mobile ? "" : "hidden md:block"}`}
          style={{
            left: `${h.left}%`,
            "--side": `${h.side}%`,
            animationDuration: `${h.duration + 4}s`,
            animationDelay: `${h.delay}s`,
            "--dx": `${h.drift}px`,
            "--o": Math.min(0.9, h.opacity + 0.15),
            "--rest": `${h.rest}px`,
          } as CSSProperties}
        >
          <svg width={Math.round(14 + h.size * 20)} viewBox="0 0 24 24">
            <path d={HEART} fill={COLORS[h.hue % COLORS.length]} />
          </svg>
        </span>
      ))}
    </div>
  );
}

export function Companion() {
  return (
    <>
      {/* Winged heart (cupid) peeking off the photo's top-left corner */}
      <Peekaboo
        className="-left-3 md:-left-10 top-[14%] w-[76px] md:w-[104px]"
        style={{ "--hide": "translate(30px, -20px) scale(0.5)" } as CSSProperties}
      >
        <span className="sz-bob block">
          <svg viewBox="0 0 80 60" className="w-full h-auto drop-shadow-[0_6px_10px_rgba(42,0,16,0.35)]">
            <g className="sz-flap" style={{ transformOrigin: "40px 30px" }}>
              <path d="M26 26 C14 12 2 16 4 26 C6 34 16 34 26 32z" fill="#fff" />
              <path d="M54 26 C66 12 78 16 76 26 C74 34 64 34 54 32z" fill="#fff" />
            </g>
            <g transform="translate(22 10) scale(1.5)">
              <path d={HEART} fill="#ff7a9a" />
            </g>
            <circle cx="35" cy="30" r="1.9" fill="#2a0010" />
            <circle cx="45" cy="30" r="1.9" fill="#2a0010" />
            <path d="M37 35 q3 3 6 0" stroke="#2a0010" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            <circle cx="31" cy="35" r="2.2" fill="#fff" opacity="0.45" />
            <circle cx="49" cy="35" r="2.2" fill="#fff" opacity="0.45" />
          </svg>
        </span>
      </Peekaboo>

      {/* Love letter at the photo's bottom-right corner */}
      <div className="absolute -right-4 -bottom-4 w-[66px] md:w-[88px] z-[2] pointer-events-none -rotate-12" aria-hidden="true">
        <svg viewBox="0 0 70 50" className="w-full h-auto drop-shadow-[0_8px_12px_rgba(42,0,16,0.4)]">
          <rect x="2" y="4" width="66" height="44" rx="5" fill="#fff8f0" />
          <path d="M3 7 L35 30 L67 7" stroke="#f3c78b" strokeWidth="2.5" fill="none" strokeLinejoin="round" />
          <g transform="translate(26 20) scale(0.75)">
            <path d={HEART} fill="#8b0031" />
          </g>
        </svg>
      </div>
    </>
  );
}
