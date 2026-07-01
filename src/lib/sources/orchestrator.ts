/**
 * Live Price Orchestrator
 *
 * Coordinates all 4 source adapters:
 *   1. Amazon PA-API      — consumer electronics via ASIN lookup
 *   2. Best Buy API        — electronics via numeric SKU lookup
 *   3. Ticketmaster API    — events via event ID or keyword search
 *   4. Amadeus API         — flights via IATA origin/destination
 *
 * Strategy:
 *   For a given product SKU, check if we have external IDs → query live
 *   adapter → return live prices merged with existing seed data.
 *   If no external IDs or adapter fails, seed data is used.
 */

import { isConfigured as amazonConfigured, lookupAsins } from "./amazon";
import { isConfigured as bestbuyConfigured, lookupBySku as bestbuyLookup, searchByKeyword as bestbuySearch } from "./bestbuy";
import { isConfigured as ticketmasterConfigured, lookupByEventId, searchByKeyword as ticketmasterSearch } from "./ticketmaster";
import { isConfigured as amadeusConfigured, searchFlightOffers } from "./amadeus";
import { PRODUCT_EXTERNAL_IDS, ExternalIds } from "./product-map";

// ─── Types ──────────────────────────────────────────────────────

export interface LivePriceResult {
  /** Whether this price came from a live API (vs seed/memory) */
  live: true;
  source: string;
  sourceType: string;
  sku: string;
  pricePerUnit: number;
  currency: string;
  unit: string;
  timestamp: number;
  /** Human-readable detail about the source */
  detail?: string;
  url?: string;
}

// ─── Source config ─────────────────────────────────────────────

interface SourceAdapter {
  id: string;           // matches PRICE_SOURCES id
  sourceType: string;
  label: string;
  isConfigured: () => boolean;
  fetch: (sku: string, ids: ExternalIds) => Promise<LivePriceResult[]>;
}

const ADAPTERS: SourceAdapter[] = [
  {
    id: "amazon-us",
    sourceType: "merchant",
    label: "Amazon US",
    isConfigured: amazonConfigured,
    fetch: async (sku, ids) => {
      if (!ids.asin) return [];
      const results = await lookupAsins([ids.asin]);
      return results
        .filter(r => r.priceAmount !== undefined)
        .map(r => ({
          live: true as const,
          source: "amazon-us",
          sourceType: "merchant",
          sku,
          pricePerUnit: r.priceAmount!,
          currency: r.currency || "USD",
          unit: "unit",
          timestamp: r.timestamp,
          detail: `Amazon US (ASIN: ${r.asin})`,
          url: r.url,
        }));
    },
  },
  {
    id: "amazon-sg",
    sourceType: "merchant",
    label: "Amazon Singapore",
    isConfigured: amazonConfigured,
    fetch: async (sku, ids) => {
      if (!ids.asin) return [];
      // For Amazon SG we use the same ASIN lookup but with SG marketplace
      const results = await lookupAsins([ids.asin]);
      return results
        .filter(r => r.priceAmount !== undefined)
        .map(r => ({
          live: true as const,
          source: "amazon-sg",
          sourceType: "merchant",
          sku,
          pricePerUnit: r.priceAmount!,
          currency: "SGD",
          unit: "unit",
          timestamp: r.timestamp,
          detail: `Amazon SG (ASIN: ${r.asin})`,
          url: r.url,
        }));
    },
  },
  {
    id: "bestbuy-us",
    sourceType: "merchant",
    label: "Best Buy US",
    isConfigured: bestbuyConfigured,
    fetch: async (sku, ids) => {
      if (!ids.bestbuySku) return [];
      const result = await bestbuyLookup(ids.bestbuySku);
      if (!result) return [];
      return [{
        live: true as const,
        source: "bestbuy-us",
        sourceType: "merchant",
        sku,
        pricePerUnit: result.salePrice,
        currency: "USD",
        unit: "unit",
        timestamp: result.timestamp,
        detail: `Best Buy — ${result.onSale ? "on sale" : "regular price"}`,
        url: result.url,
      }];
    },
  },
  {
    id: "ticketmaster",
    sourceType: "exchange",
    label: "Ticketmaster",
    isConfigured: ticketmasterConfigured,
    fetch: async (sku, ids) => {
      const result = ids.ticketmasterId
        ? await lookupByEventId(ids.ticketmasterId)
        : null;

      // Fallback: search by keyword if no direct ID match
      const events = result
        ? [result]
        : ids.searchKeywords
          ? await ticketmasterSearch(ids.searchKeywords)
          : [];

      return events
        .filter(e => e.representativePrice !== undefined)
        .map(e => ({
          live: true as const,
          source: "ticketmaster" as const,
          sourceType: "exchange" as const,
          sku,
          pricePerUnit: e.representativePrice!,
          currency: e.currency || "SGD",
          unit: "ticket",
          timestamp: e.timestamp,
          detail: `Ticketmaster — ${e.venue}`,
          url: e.url,
        }));
    },
  },
  {
    id: "singapore-air",
    sourceType: "airline",
    label: "Singapore Airlines",
    isConfigured: amadeusConfigured,
    fetch: async (sku, ids) => {
      if (!ids.amadeusOrigin || !ids.amadeusDestination) return [];
      const offers = await searchFlightOffers(ids.amadeusOrigin, ids.amadeusDestination);
      // Filter for SQ (Singapore Airlines) offers
      const sqOffers = offers.filter(o => o.airlines.includes("SQ"));
      if (sqOffers.length === 0) return [];
      const cheapest = sqOffers.reduce((a, b) => a.priceAmount < b.priceAmount ? a : b);
      return [{
        live: true as const,
        source: "singapore-air" as const,
        sourceType: "airline" as const,
        sku,
        pricePerUnit: cheapest.priceAmount,
        currency: cheapest.currency,
        unit: cheapest.roundTrip ? "round-trip" : "one-way",
        timestamp: cheapest.timestamp,
        detail: `Singapore Airlines — ${ids.amadeusOrigin}→${ids.amadeusDestination}`,
      }];
    },
  },
  {
    id: "emirates",
    sourceType: "airline",
    label: "Emirates",
    isConfigured: amadeusConfigured,
    fetch: async (sku, ids) => {
      if (!ids.amadeusOrigin || !ids.amadeusDestination) return [];
      const offers = await searchFlightOffers(ids.amadeusOrigin, ids.amadeusDestination);
      // Filter for EK (Emirates) offers
      const ekOffers = offers.filter(o => o.airlines.includes("EK"));
      if (ekOffers.length === 0) return [];
      const cheapest = ekOffers.reduce((a, b) => a.priceAmount < b.priceAmount ? a : b);
      return [{
        live: true as const,
        source: "emirates" as const,
        sourceType: "airline" as const,
        sku,
        pricePerUnit: cheapest.priceAmount,
        currency: cheapest.currency,
        unit: cheapest.roundTrip ? "round-trip" : "one-way",
        timestamp: cheapest.timestamp,
        detail: `Emirates — ${ids.amadeusOrigin}→${ids.amadeusDestination}`,
      }];
    },
  },
  {
    id: "google-flights",
    sourceType: "airline",
    label: "Google Flights",
    isConfigured: amadeusConfigured,
    fetch: async (sku, ids) => {
      if (!ids.amadeusOrigin || !ids.amadeusDestination) return [];
      const offers = await searchFlightOffers(ids.amadeusOrigin, ids.amadeusDestination);
      if (offers.length === 0) return [];
      const cheapest = offers.reduce((a, b) => a.priceAmount < b.priceAmount ? a : b);
      return [{
        live: true as const,
        source: "google-flights" as const,
        sourceType: "airline" as const,
        sku,
        pricePerUnit: cheapest.priceAmount,
        currency: cheapest.currency,
        unit: cheapest.roundTrip ? "round-trip" : "one-way",
        timestamp: cheapest.timestamp,
        detail: `Cheapest Amadeus offer — ${ids.amadeusOrigin}→${ids.amadeusDestination}`,
      }];
    },
  },
];

// ─── Orchestrator ───────────────────────────────────────────────

/**
 * Fetch live prices for a given product SKU across all configured adapters.
 * Returns only results from adapters that have credentials AND external IDs mapped.
 * Returns empty array if no live adapters are configured.
 */
export async function fetchLivePrices(sku: string): Promise<LivePriceResult[]> {
  if (typeof globalThis === "undefined") return [];
  // During SSR/build, skip live API calls
  if (typeof process === "undefined" || process.env.NEXT_PHASE === "phase-production-build") return [];

  const ids = PRODUCT_EXTERNAL_IDS[sku];
  if (!ids) return [];

  const results: LivePriceResult[] = [];
  const errors: string[] = [];

  await Promise.all(
    ADAPTERS.map(async (adapter) => {
      if (!adapter.isConfigured()) return;
      try {
        const prices = await adapter.fetch(sku, ids);
        results.push(...prices);
      } catch (err) {
        errors.push(`[${adapter.id}] ${(err as Error).message}`);
      }
    }),
  );

  if (errors.length > 0) {
    console.warn(`[orchestrator] ${errors.length} adapter(s) failed for ${sku}:`, errors.join("; "));
  }

  return results;
}

/**
 * Check how many live sources are currently configured with API keys.
 */
export function getConfiguredSourcesCount(): number {
  return ADAPTERS.filter(a => a.isConfigured()).length;
}

/**
 * Get the list of sources that have live API capabilities.
 */
export function getLiveCapableSources(): string[] {
  return ADAPTERS.filter(a => a.isConfigured()).map(a => a.id);
}
