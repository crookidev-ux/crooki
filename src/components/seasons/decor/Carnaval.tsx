import type { CSSProperties } from "react";
import Peekaboo from "../Peekaboo";
import { particles, r2 } from "./particles";

const COLORS = ["#ffd23f", "#2bb673", "#ff6fb5", "#3a9bff", "#ff8a3d", "#ffffff"];
const CONFETTI = particles(30, 2027);

// Curly streamer hanging from the top edge.
function Streamer({ color, length, flip }: { color: string; length: number; flip?: boolean }) {
  const turns = Math.round(length / 22);
  let d = "M10 0";
  for (let i = 0; i < turns; i++) {
    const y = i * 22;
    d += ` C${flip ? -4 : 24} ${y + 5} ${flip ? -4 : 24} ${y + 17} 10 ${y + 22}`;
    d += ` C${flip ? 24 : -4} ${y + 27} ${flip ? 24 : -4} ${y + 39} 10 ${y + 44}`;
    i++;
  }
  return (
    <svg width="26" height={length} viewBox={`-6 0 32 ${length}`} className="overflow-visible">
      <path d={d} stroke={color} strokeWidth="5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

const STREAMERS = [
  { left: "3%", color: COLORS[0], length: 150, delay: -0.5, mobile: true },
  { left: "10%", color: COLORS[2], length: 96, delay: -2, mobile: false },
  { left: "85%", color: COLORS[3], length: 120, delay: -1.2, mobile: false },
  { left: "93%", color: COLORS[1], length: 170, delay: -3, mobile: true },
];

export function Ambient() {
  return (
    <div className="sz-layer" aria-hidden="true">
      {STREAMERS.map((s, i) => (
        <div
          key={i}
          className={`absolute top-0 sz-sway ${s.mobile ? "" : "hidden md:block"}`}
          style={{ left: s.left, animationDelay: `${s.delay}s`, opacity: 0.95 }}
        >
          <Streamer color={s.color} length={s.length} flip={i % 2 === 1} />
        </div>
      ))}

      {CONFETTI.map((c, i) => (
        <span
          key={i}
          className={`sz-fall ${c.hue % 3 === 0 ? "rounded-full" : "rounded-[1px]"} ${c.mobile ? "" : "hidden md:block"}`}
          style={{
            left: `${c.left}%`,
            width: 5 + c.size * 4,
            height: c.hue % 3 === 0 ? 5 + c.size * 4 : 9 + c.size * 4,
            background: COLORS[c.hue % COLORS.length],
            opacity: c.opacity + 0.1,
            animationDuration: `${c.duration}s`,
            animationDelay: `${c.delay}s`,
            "--dx": `${c.drift}px`,
            "--spin": `${c.drift * 14}deg`,
            "--rest": `${c.rest}px`,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}

export function Companion() {
  return (
    <>
      {/* Marimonda peeking from the photo's bottom-left corner */}
      <Peekaboo
        className="-left-3 md:-left-8 -bottom-4 w-[70px] md:w-[96px]"
        style={{ "--hide": "translateY(60px) rotate(-12deg) scale(0.8)" } as CSSProperties}
      >
        <svg viewBox="0 0 80 84" className="w-full h-auto drop-shadow-[0_8px_12px_rgba(42,0,16,0.4)]">
          {/* ears */}
          <ellipse cx="13" cy="32" rx="13" ry="17" fill="#ffd23f" />
          <ellipse cx="67" cy="32" rx="13" ry="17" fill="#2bb673" />
          <ellipse cx="13" cy="32" rx="7" ry="10" fill="#ff6fb5" />
          <ellipse cx="67" cy="32" rx="7" ry="10" fill="#3a9bff" />
          {/* face */}
          <ellipse cx="40" cy="34" rx="25" ry="27" fill="#1d1d3a" />
          {/* eyes with white rings */}
          <circle cx="30" cy="28" r="8" fill="#fff" />
          <circle cx="50" cy="28" r="8" fill="#fff" />
          <circle cx="30" cy="28" r="3.6" fill="#1d1d3a" />
          <circle cx="50" cy="28" r="3.6" fill="#1d1d3a" />
          {/* trunk nose */}
          <path d="M37 38 Q34 58 42 72 Q46 79 51 74" stroke="#ff8a3d" strokeWidth="8" fill="none" strokeLinecap="round" />
          <path d="M37 38 Q34 58 42 72 Q46 79 51 74" stroke="#ffd23f" strokeWidth="2.5" strokeDasharray="3 5" fill="none" strokeLinecap="round" />
          {/* mouth */}
          <path d="M24 46 q6 6 10 2" stroke="#ff6fb5" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M56 46 q-6 6 -10 2" stroke="#ff6fb5" strokeWidth="3" fill="none" strokeLinecap="round" />
        </svg>
      </Peekaboo>

      {/* Congo hat with flowers at the photo's top-right corner */}
      <div className="absolute -right-3 md:-right-6 -top-6 w-[72px] md:w-[100px] z-[2] pointer-events-none rotate-12" aria-hidden="true">
        <svg viewBox="0 0 90 60" className="w-full h-auto drop-shadow-[0_6px_10px_rgba(42,0,16,0.35)]">
          <ellipse cx="45" cy="50" rx="42" ry="9" fill="#fff" />
          <path d="M20 50 Q22 18 45 16 Q68 18 70 50z" fill="#fff" />
          <path d="M21 42 Q45 34 69 42" stroke="#e0262b" strokeWidth="5" fill="none" />
          {[
            [28, 22, "#ff6fb5"],
            [42, 12, "#ffd23f"],
            [57, 18, "#3a9bff"],
            [66, 30, "#ff8a3d"],
            [24, 33, "#2bb673"],
          ].map(([x, y, c], i) => (
            <g key={i}>
              {[0, 72, 144, 216, 288].map((a) => (
                <circle
                  key={a}
                  cx={r2((x as number) + Math.cos((a * Math.PI) / 180) * 4.5)}
                  cy={r2((y as number) + Math.sin((a * Math.PI) / 180) * 4.5)}
                  r="3.6"
                  fill={c as string}
                />
              ))}
              <circle cx={x as number} cy={y as number} r="2.4" fill="#fff8d6" />
            </g>
          ))}
        </svg>
      </div>
    </>
  );
}
