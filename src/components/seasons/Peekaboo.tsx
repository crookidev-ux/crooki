"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";

// The playful character beside the hero photo. A click hides it for a
// moment and it pops back. Purely decorative: hidden from screen readers and
// out of the tab order.
export default function Peekaboo({
  className = "",
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const [hidden, setHidden] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = () => {
    if (hidden) return;
    setHidden(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setHidden(false), 1600);
  };

  return (
    <button
      type="button"
      tabIndex={-1}
      aria-hidden="true"
      onClick={hide}
      className={`sz-peek ${hidden ? "sz-hide" : ""} ${className}`}
      style={style}
    >
      {children}
    </button>
  );
}
