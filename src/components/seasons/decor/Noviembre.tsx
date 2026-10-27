import type { CSSProperties } from "react";
import Peekaboo from "../Peekaboo";
import { particles, r2 } from "./particles";

// Colors of Cartagena's flag.
const RED = "#e0262b";
const YELLOW = "#fcd116";
const GREEN = "#13924a";
const FLAG = [RED, YELLOW, GREEN];
const CONFETTI = particles(28, 1111);

// The viewBox width roughly matches the rendered width so the pennants keep
// their shape: one garland for phones, one for wider screens.
function Garland({ className, count, w }: { className: string; count: number; w: number }) {
  const step = w / count;
  return (
    <svg className={className} viewBox={`0 0 ${w} 70`} preserveAspectRatio="none">
      <path d={`M0 6 Q${w / 2} 34 ${w} 6`} stroke="#fff" strokeWidth="1.2" fill="none" opacity="0.6" />
      {Array.from({ length: count }, (_, i) => {
        const x = r2(i * step + step * 0.12);
        const t = (x + step * 0.38) / w;
        const y = r2(6 + 56 * t * (1 - t)); // on the string's curve
        return (
          <path
            key={i}
            d={`M${x} ${y - 2} L${r2(x + step * 0.76)} ${y - 2} L${r2(x + step * 0.38)} ${y + 26}z`}
            fill={FLAG[i % 3]}
            opacity="0.92"
          />
        );
      })}
    </svg>
  );
}

function Burst({ color, size, delay = 0 }: { color: string; size: number; delay?: number }) {
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" className="sz-burst" style={{ animationDelay: `${delay}s` }}>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <line
            key={i}
            x1={r2(Math.cos(a) * 14)}
            y1={r2(Math.sin(a) * 14)}
            x2={r2(Math.cos(a) * 44)}
            y2={r2(Math.sin(a) * 44)}
            stroke={i % 2 ? "#fff" : color}
            strokeWidth="3"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

export function Ambient() {
  return (
    <div className="sz-layer" aria-hidden="true">
      <Garland className="absolute top-0 left-0 w-full h-[54px] md:hidden" count={11} w={420} />
      <Garland className="absolute top-0 left-0 w-full h-[64px] hidden md:block" count={28} w={1300} />

      {CONFETTI.map((c, i) => (
        <span
          key={i}
          className={`sz-fall rounded-[1px] ${c.mobile ? "" : "hidden md:block"}`}
          style={{
            left: `${c.left}%`,
            width: 5 + c.size * 4,
            height: 8 + c.size * 5,
            background: FLAG[c.hue % 3],
            opacity: c.opacity + 0.1,
            animationDuration: `${c.duration}s`,
            animationDelay: `${c.delay}s`,
            "--dx": `${c.drift}px`,
            "--spin": `${c.drift * 12}deg`,
            "--rest": `${c.rest}px`,
          } as CSSProperties}
        />
      ))}

      <div className="absolute left-[3%] top-[22%] hidden md:block opacity-70">
        <Burst color={YELLOW} size={110} />
      </div>
      <div className="absolute right-[4%] bottom-[12%] hidden md:block opacity-60">
        <Burst color={GREEN} size={90} delay={-1.8} />
      </div>
    </div>
  );
}

export function Companion() {
  return (
    // Buscapié (firecracker): leaps up on click and comes back
    <Peekaboo
      className="-left-2 md:-left-6 -bottom-3 w-[46px] md:w-[62px]"
      style={{ "--hide": "translate(-10px, -80px) rotate(-25deg) scale(0.6)" } as CSSProperties}
    >
      <svg viewBox="0 0 44 80" className="w-full h-auto drop-shadow-[0_8px_12px_rgba(42,0,16,0.4)]">
        <g className="sz-flicker">
          <path d="M22 2l3 8 7-3-4 7 7 3-8 2 2 7-7-5-7 5 2-7-8-2 7-3-4-7 7 3z" fill={YELLOW} />
          <circle cx="22" cy="12" r="3" fill="#fff" />
        </g>
        <path d="M22 20 q4 6 0 12" stroke="#f3c78b" strokeWidth="2" fill="none" />
        <rect x="11" y="32" width="22" height="44" rx="5" fill={RED} />
        <rect x="11" y="44" width="22" height="9" fill={YELLOW} />
        <rect x="11" y="53" width="22" height="9" fill={GREEN} />
        <rect x="11" y="32" width="22" height="44" rx="5" fill="none" stroke="#2a0010" strokeOpacity="0.15" strokeWidth="2" />
      </svg>
    </Peekaboo>
  );
}
