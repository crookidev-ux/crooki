"use client";

// Loads Bold's checkout library once per page session and exposes our own
// "Pagar" button behaviour (`new BoldCheckout(config).open()`), so the button
// keeps Crooki's style and never says "Bold".
import { useCallback, useSyncExternalStore } from "react";
import type { BoldClientConfig } from "@/lib/bold";

declare global {
  interface Window {
    BoldCheckout?: new (config: BoldClientConfig) => { open: () => void };
  }
}

const SRC = "https://checkout.bold.co/library/boldPaymentButton.js";
// Slow mobile networks are common; only give up after a generous wait.
const LOAD_TIMEOUT_MS = 20_000;

type Status = "idle" | "loading" | "ready" | "failed";

let status: Status = "idle";
const listeners = new Set<() => void>();

function setStatus(next: Status) {
  if (status === next) return;
  status = next;
  listeners.forEach((l) => l());
}

function ensureScript() {
  if (typeof window === "undefined") return;
  // Already available (e.g. navigating back to the checkout).
  if (window.BoldCheckout) {
    setStatus("ready");
    return;
  }
  if (status === "loading" || status === "ready") return;

  setStatus("loading");
  const cleanup = () => {
    clearTimeout(timer);
    window.removeEventListener("boldCheckoutLoaded", onLoaded);
    window.removeEventListener("boldCheckoutLoadFailed", onFailed);
  };
  const onLoaded = () => {
    cleanup();
    setStatus(window.BoldCheckout ? "ready" : "failed");
  };
  const onFailed = () => {
    cleanup();
    setStatus("failed");
  };
  window.addEventListener("boldCheckoutLoaded", onLoaded);
  window.addEventListener("boldCheckoutLoadFailed", onFailed);
  const timer = setTimeout(() => {
    if (window.BoldCheckout) onLoaded();
    else onFailed();
  }, LOAD_TIMEOUT_MS);

  // A previous failed attempt leaves a dead tag behind: replace it.
  document.querySelectorAll<HTMLScriptElement>(`script[src="${SRC}"]`).forEach((s) => {
    if (s.dataset.boldFailed === "true") s.remove();
  });
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
  const script = existing ?? document.createElement("script");
  if (!existing) {
    script.src = SRC;
    script.async = true;
    document.head.appendChild(script);
  }
  script.addEventListener("error", () => {
    script.dataset.boldFailed = "true";
    onFailed();
  });
  // Fallback in case the library is usable but the event was missed.
  script.addEventListener("load", () => {
    if (window.BoldCheckout) onLoaded();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function subscribeAndLoad(listener: () => void) {
  const unsubscribe = subscribe(listener);
  ensureScript();
  return unsubscribe;
}

const getSnapshot = () => status;
const getServerSnapshot = (): Status => "idle";

/** `enabled: false` skips loading the script (online payment not configured). */
export function useBoldCheckout(enabled = true): {
  ready: boolean;
  failed: boolean;
  open(config: BoldClientConfig): void;
} {
  const current = useSyncExternalStore(
    enabled ? subscribeAndLoad : subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const open = useCallback((config: BoldClientConfig) => {
    if (!window.BoldCheckout) throw new Error("Bold checkout is not loaded");
    new window.BoldCheckout(config).open();
  }, []);
  return { ready: current === "ready", failed: current === "failed", open };
}
