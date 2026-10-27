import type { CSSProperties } from "react";
import Peekaboo from "../Peekaboo";

const NIGHT = "#2a0010";

function Bat({ width }: { width: number }) {
  return (
    <svg width={width} viewBox="0 0 64 32" className="sz-flap" fill={NIGHT}>
      <path d="M32 10c2-4 6-4 6-4s-1 4 1 6c4-6 14-8 25-4-6 2-9 7-9 11-3-3-8-3-11 1-2-3-6-4-8-2-2-2-6-1-8 2-3-4-8-4-11-1 0-4-3-9-9-11 11-4 21-2 25 4 2-2 1-6 1-6s4 0 6 4z" />
    </svg>
  );
}

const BATS: { top: string; width: number; duration: number; delay: number; rest: string; mobile: boolean }[] = [
  { top: "10%", width: 52, duration: 16, delay: -3, rest: "58%", mobile: true },
  { top: "20%", width: 38, duration: 21, delay: -12, rest: "78%", mobile: true },
  { top: "6%", width: 28, duration: 26, delay: -19, rest: "30%", mobile: false },
];

export function Ambient() {
  return (
    <div className="sz-layer" aria-hidden="true">
      {/* Night falls on the edges: still Crooki burgundy in the middle. */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(120% 90% at 50% 10%, transparent 40%, rgba(42,0,16,0.55) 100%)" }}
      />

      {/* Cobweb in the top-right corner */}
      <svg
        className="absolute top-0 right-0 w-[140px] md:w-[230px] opacity-40"
        viewBox="0 0 100 100"
        fill="none"
        stroke="#fff"
        strokeWidth="0.7"
        strokeLinecap="round"
      >
        <path d="M100 0 L18 0 M100 0 L30 40 M100 0 L56 70 M100 0 L84 92 M100 0 L100 96" />
        <path d="M82 0 Q85 9 93 9 Q96 15 100 15" />
        <path d="M62 0 Q67 18 81 18 Q88 29 98 31 L100 31" />
        <path d="M42 0 Q50 28 70 34 Q80 50 92 56 L100 58" />
        <path d="M26 0 Q35 38 60 50 Q72 68 87 78 L100 80" />
        <line x1="74" y1="34" x2="74" y2="52" strokeWidth="0.5" />
        <circle cx="74" cy="54" r="2.4" fill="#fff" stroke="none" />
      </svg>

      {BATS.map((b, i) => (
        <div
          key={i}
          className={`sz-track ${b.mobile ? "" : "hidden md:block"}`}
          style={{ top: b.top, animationDuration: `${b.duration}s`, animationDelay: `${b.delay}s`, "--rest-x": b.rest, opacity: 0.95 - i * 0.15 } as CSSProperties}
        >
          <div className="sz-bob" style={{ animationDuration: `${2.4 + i}s` }}>
            <Bat width={b.width} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Companion() {
  return (
    <>
      {/* Ghost floating off the photo's top-left corner */}
      <Peekaboo
        className="-left-3 md:-left-8 top-[14%] w-[62px] md:w-[86px]"
        style={{ "--hide": "translateX(30px) scale(0.5)" } as CSSProperties}
      >
        <span className="sz-bob block">
          <svg viewBox="0 0 60 72" className="w-full h-auto drop-shadow-[0_6px_10px_rgba(42,0,16,0.35)]">
            <path d="M30 2C14 2 6 14 6 30v36l8-6 8 6 8-6 8 6 8-6 8 6V30C54 14 46 2 30 2z" fill="#fff8f0" />
            <ellipse cx="22" cy="30" rx="4" ry="5.5" fill={NIGHT} />
            <ellipse cx="38" cy="30" rx="4" ry="5.5" fill={NIGHT} />
            <circle cx="23.3" cy="28" r="1.2" fill="#fff" />
            <circle cx="39.3" cy="28" r="1.2" fill="#fff" />
            <ellipse cx="30" cy="42" rx="3.6" ry="3" fill={NIGHT} />
            <ellipse cx="15" cy="38" rx="3.6" ry="2.2" fill="#f7a8b8" opacity="0.75" />
            <ellipse cx="45" cy="38" rx="3.6" ry="2.2" fill="#f7a8b8" opacity="0.75" />
          </svg>
        </span>
      </Peekaboo>

      {/* Jack-o'-lantern at the photo's bottom-right corner */}
      <div className="absolute -right-3 md:-right-6 -bottom-5 w-[70px] md:w-[96px] z-[2] pointer-events-none" aria-hidden="true">
        <svg viewBox="0 0 70 62" className="w-full h-auto drop-shadow-[0_8px_12px_rgba(42,0,16,0.45)]">
          <path d="M35 12c-1-6 2-9 6-10" stroke="#3d6b2a" strokeWidth="4" fill="none" strokeLinecap="round" />
          <ellipse cx="21" cy="38" rx="16" ry="20" fill="#d9661f" />
          <ellipse cx="49" cy="38" rx="16" ry="20" fill="#d9661f" />
          <ellipse cx="35" cy="38" rx="16" ry="22" fill="#ee8434" />
          <path d="M35 16v44" stroke="#d9661f" strokeWidth="1.5" opacity="0.6" />
          <g className="sz-flicker" fill="#ffd966">
            <path d="M23 31l6 6h-9z" />
            <path d="M47 31l3 6h-9z" />
            <path d="M21 45q14 9 28 0l-4 6-4-3-6 4-6-4-4 3z" />
          </g>
        </svg>
      </div>
    </>
  );
}
