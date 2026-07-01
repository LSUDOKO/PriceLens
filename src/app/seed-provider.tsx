"use client";

import { useEffect } from "react";

/**
 * Auto-seeds pricing data on web startup.
 * This ensures the app works out of the box without manual seeding.
 */
export function SeedProvider() {
  useEffect(() => {
    let cancelled = false;

    async function autoSeed() {
      try {
        const healthRes = await fetch("/api/health");
        const health = await healthRes.json();

        // Only seed if no data exists yet
        if (health.products === 0) {
          console.log("[PriceLens] Auto-seeding pricing data...");
          const res = await fetch("/api/seed", { method: "POST" });
          const data = await res.json();
          if (!cancelled) {
            console.log(`[PriceLens] Seeded ${data.seeded?.products} products and ${data.seeded?.prices} prices`);
          }
        }
      } catch (err) {
        // Silently fail — server might not be ready yet
        console.warn("[PriceLens] Auto-seed skipped (server not ready):", (err as Error).message);
      }
    }

    autoSeed();

    return () => { cancelled = true; };
  }, []);

  return null; // This is a side-effect-only component
}
