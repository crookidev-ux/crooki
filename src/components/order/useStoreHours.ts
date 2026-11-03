"use client";

import { useSyncExternalStore } from "react";
import { storeStatus, type StoreStatus } from "@/lib/store-hours";

// The open/closed state is re-read every 30 s. On the server and during
// hydration it is unknown (null), so the first client render matches the HTML
// and nothing flashes. /api/checkout re-checks the hours with the server clock.
const UNKNOWN = "unknown";

function subscribe(onChange: () => void) {
  const id = setInterval(onChange, 30_000);
  return () => clearInterval(id);
}

// A string snapshot, so React sees "no change" between ticks while the state holds.
function getSnapshot(): string {
  const s = storeStatus();
  return s.open ? "open" : `${s.opensAt}|${s.opensToday ? "today" : "tomorrow"}`;
}

const getServerSnapshot = () => UNKNOWN;

export function useStoreHours(): StoreStatus | null {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (snap === UNKNOWN) return null;
  if (snap === "open") return { open: true };
  const [opensAt, day] = snap.split("|");
  return { open: false, opensAt, opensToday: day === "today" };
}
