"use client";

import { useEffect } from "react";
import { useCartStore } from "@/store/cart";

// Loads the saved cart after hydration, so the first client render matches
// the server's (empty cart) and React keeps the server HTML.
export default function CartHydrator() {
  useEffect(() => {
    void useCartStore.persist.rehydrate();
  }, []);
  return null;
}
