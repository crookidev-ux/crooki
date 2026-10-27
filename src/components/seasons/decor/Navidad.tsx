import type { CSSProperties } from "react";
import Peekaboo from "../Peekaboo";
import { particles } from "./particles";

const CREAM = "#f3c78b";
const PINE = "#1f6b43";
const SNOW = particles(36, 1225);

function Ornament({ color, r, string, band }: { color: string; r: number; string: number; band?: string }) {
  const w = r * 2 + 4;
  return (
    <svg width={w} height={string + r * 2 + 8} viewBox={`0 0 ${w} ${string + r * 2 + 8}`}>
      <line x1={w / 2} y1="0" x2={w / 2} y2={string} stroke={CREAM} strokeWidth="1.4" opacity="0.85" />
      <rect x={w / 2 - 4} y={string - 1} width="8" height="6" rx="1.5" fill={CREAM} />
      <circle cx={w / 2} cy={string + 5 + r} r={r} fill={color} />
      {band && <path d={`M${w / 2 - r} ${string + 5 + r} h${r * 2}`} stroke={band} strokeWidth="2.5" />}
      <circle cx={w / 2 - r * 0.35} cy={string + 5 + r * 0.6} r={r * 0.25} fill="#fff" opacity="0.55" />
    </svg>
  );
}

const ORNAMENTS = [
  { left: "6%", color: CREAM, r: 19, string: 46, delay: -0.8, mobile: true },
  { left: "47%", color: "#fff", r: 15, string: 24, band: PINE, delay: -2.6, mobile: false },
  { left: "57%", color: PINE, r: 18, string: 70, delay: -1.4, mobile: false },
  { left: "88%", color: CREAM, r: 16, string: 34, band: "#8b0031", delay: -3.3, mobile: true },
];

export function Ambient() {
  return (
    <div className="sz-layer" aria-hidden="true">
      {SNOW.map((f, i) => (
        <span
          key={i}
          className={`sz-fall rounded-full bg-white ${f.mobile ? "" : "hidden md:block"}`}
          style={{
            left: `${f.left}%`,
            width: Math.round(3 + f.size * 6),
            height: Math.round(3 + f.size * 6),
            opacity: f.opacity,
            animationDuration: `${f.duration}s`,
            animationDelay: `${f.delay}s`,
            "--dx": `${f.drift}px`,
            "--rest": `${f.rest}px`,
          } as CSSProperties}
        />
      ))}

      {ORNAMENTS.map((o, i) => (
        <div
          key={i}
          className={`absolute top-0 sz-sway ${o.mobile ? "" : "hidden lg:block"}`}
          style={{ left: o.left, animationDelay: `${o.delay}s` }}
        >
          <Ornament color={o.color} r={o.r} string={o.string} band={o.band} />
        </div>
      ))}
    </div>
  );
}

export function Companion() {
  return (
    // Elf peeking up from behind the photo's bottom-left corner
    <Peekaboo
      className="-left-3 md:-left-6 -bottom-4 w-[66px] md:w-[90px]"
      style={{ "--hide": "translateY(60px) scale(0.8)" } as CSSProperties}
    >
      <svg viewBox="0 0 60 72" className="w-full h-auto drop-shadow-[0_8px_12px_rgba(42,0,16,0.4)]">
        <path d="M13 30 L37 3 L47 30z" fill={PINE} />
        <circle cx="37" cy="4" r="4.5" fill="#fff" />
        <rect x="9" y="27" width="42" height="8" rx="4" fill="#fff" />
        <path d="M11 44l-7-7 2 11zM49 44l7-7-2 11z" fill="#f2c39e" />
        <circle cx="30" cy="48" r="17" fill="#f5cdaa" />
        <circle cx="24" cy="46" r="2.4" fill="#2a0010" />
        <circle cx="36" cy="46" r="2.4" fill="#2a0010" />
        <path d="M25 54q5 4.5 10 0" stroke="#2a0010" strokeWidth="2" fill="none" strokeLinecap="round" />
        <circle cx="19" cy="52" r="3.2" fill="#f7a8b8" opacity="0.75" />
        <circle cx="41" cy="52" r="3.2" fill="#f7a8b8" opacity="0.75" />
        <path d="M14 64 h32 v8 h-32z" fill="#8b0031" />
        <path d="M14 64 l8 6 8-6 8 6 8-6" stroke={CREAM} strokeWidth="2" fill="none" />
      </svg>
    </Peekaboo>
  );
}
