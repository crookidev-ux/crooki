// Deterministic pseudo-random values, so server and client render the same
// particles (Math.random would break hydration).
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export type Particle = {
  left: number; // % of the hero width
  size: number; // px
  duration: number; // s
  delay: number; // s (negative: already mid-way on first paint)
  drift: number; // px of horizontal drift
  rest: number; // px offset used when motion is reduced
  opacity: number;
  hue: number; // index into the caller's palette
  mobile: boolean; // also shown on phones
};

export function particles(count: number, seed: number, mobileEvery = 2): Particle[] {
  const r = seeded(seed);
  return Array.from({ length: count }, (_, i) => {
    const duration = 9 + r() * 9;
    return {
      left: r() * 100,
      size: r(),
      duration,
      delay: -r() * duration,
      drift: Math.round(r() * 60 - 30),
      rest: Math.round(40 + r() * 420),
      opacity: 0.35 + r() * 0.5,
      hue: Math.floor(r() * 1000),
      mobile: i % mobileEvery === 0,
    };
  });
}

// Trig results can differ in the last digit between Node and the browser;
// rounded SVG coordinates keep server and client markup identical.
export const r2 = (n: number) => Math.round(n * 100) / 100;
