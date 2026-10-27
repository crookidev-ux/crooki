"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// While a payment is being confirmed, re-renders the server page every few
// seconds (each render asks Bold again), so the customer never has to reload.
// Stops after `maxTries`; the manual «Recargar» button stays as a fallback.
export default function AutoRefresh({
  everyMs = 6000,
  maxTries = 20,
  label,
}: {
  everyMs?: number;
  maxTries?: number;
  label: string;
}) {
  const router = useRouter();

  useEffect(() => {
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (tries > maxTries) {
        clearInterval(timer);
        return;
      }
      router.refresh();
    }, everyMs);
    return () => clearInterval(timer);
  }, [router, everyMs, maxTries]);

  return (
    <p role="status" className="text-gray-500 text-sm mb-6">
      {label}
    </p>
  );
}
