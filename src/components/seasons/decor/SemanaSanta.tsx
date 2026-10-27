import { r2 } from "./particles";

// Holy Week is a religious date in Colombia: a calm decoration, with palm
// fronds and a warm light, almost no movement and no playful character.

const LEAF = "#6f9a52";
const LEAF_DARK = "#4f7a3a";

function PalmFrond({ className }: { className: string }) {
  const leaflets = Array.from({ length: 11 }, (_, i) => i);
  return (
    <svg className={className} viewBox="0 0 160 160" fill="none">
      <path d="M8 152 Q70 110 150 14" stroke={LEAF_DARK} strokeWidth="3" strokeLinecap="round" />
      {leaflets.map((i) => {
        const t = 0.12 + i * 0.078;
        // point on the stem (quadratic curve)
        const x = r2((1 - t) ** 2 * 8 + 2 * (1 - t) * t * 70 + t ** 2 * 150);
        const y = r2((1 - t) ** 2 * 152 + 2 * (1 - t) * t * 110 + t ** 2 * 14);
        const len = r2(46 - i * 2.6);
        return (
          <g key={i}>
            <path d={`M${x} ${y} q${r2(-len * 0.55)} ${r2(-len * 0.25)} ${r2(-len * 0.9)} ${r2(-len * 0.95)}`} stroke={LEAF} strokeWidth="5" strokeLinecap="round" />
            <path d={`M${x} ${y} q${r2(len * 0.45)} ${r2(len * 0.1)} ${r2(len * 0.95)} ${r2(-len * 0.05)}`} stroke={LEAF} strokeWidth="5" strokeLinecap="round" />
          </g>
        );
      })}
    </svg>
  );
}

export function Ambient() {
  return (
    <div className="sz-layer" aria-hidden="true">
      {/* Warm light from above */}
      <div
        className="absolute inset-0 sz-glow"
        style={{ background: "radial-gradient(70% 55% at 50% -10%, rgba(243,199,139,0.32), transparent 70%)" }}
      />
      {/* Bottom-right, flipped: the bottom-left corner holds the address line */}
      <PalmFrond className="absolute -right-6 -bottom-8 w-[120px] md:w-[210px] opacity-70 -scale-x-100" />
      <PalmFrond className="absolute -right-4 -top-4 w-[110px] md:w-[190px] opacity-65 rotate-180" />
    </div>
  );
}

export function Companion() {
  return null;
}
