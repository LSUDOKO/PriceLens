/**
 * Product SKU → External ID Mapping
 *
 * Maps internal PriceLens SKUs to external product IDs used by each API.
 * If a product has no mapping for a given source, the live API won't be
 * queried and seed data will be used instead.
 */

export interface ExternalIds {
  /** Amazon Standard Identification Number (ASIN) */
  asin?: string;
  /** Best Buy SKU (numeric) */
  bestbuySku?: string;
  /** Ticketmaster event ID */
  ticketmasterId?: string;
  /** Amadeus IATA origin/destination codes (flights) */
  amadeusOrigin?: string;
  amadeusDestination?: string;
  /** Search keywords for APIs without direct SKU lookup */
  searchKeywords?: string;
}

/**
 * Maps internal PriceLens SKUs → external IDs for each source.
 * Add more mappings as you identify external IDs for your products.
 */
export const PRODUCT_EXTERNAL_IDS: Record<string, ExternalIds> = {
  // ─── Electronics ───────────────────────────────────────
  "macbook-pro-m4": {
    asin: "B0DSLNWHML",          // MacBook Pro 14" M4 Pro (2025)
    bestbuySku: "12345678",      // placeholder — replace with real SKU
    searchKeywords: "MacBook Pro 14 M4 2025",
  },
  "thinkpad-x1-gen12": {
    asin: "B0F2H3K4L5",          // placeholder ASIN
    bestbuySku: "87654321",      // placeholder
    searchKeywords: "Lenovo ThinkPad X1 Carbon Gen 12",
  },
  "iphone-16-pro": {
    asin: "B0DGLLWHML",          // iPhone 16 Pro 256GB
    bestbuySku: "12345679",
    searchKeywords: "iPhone 16 Pro 256GB",
  },
  "galaxy-s25-ultra": {
    asin: "B0FJ2K3L4M",          // placeholder
    bestbuySku: "12345680",
    searchKeywords: "Samsung Galaxy S25 Ultra 256GB",
  },
  "sony-wh1000xm6": {
    asin: "B0D5F2H3J4",          // placeholder
    bestbuySku: "12345681",
    searchKeywords: "Sony WH-1000XM6 Wireless Headphones",
  },

  // ─── Flights ───────────────────────────────────────────
  "flight-sin-lhr": {
    amadeusOrigin: "SIN",
    amadeusDestination: "LHR",
    searchKeywords: "flights Singapore to London round trip",
  },
  "flight-sin-nrt": {
    amadeusOrigin: "SIN",
    amadeusDestination: "NRT",
    searchKeywords: "flights Singapore to Tokyo round trip",
  },
  "flight-sin-bkk": {
    amadeusOrigin: "SIN",
    amadeusDestination: "BKK",
    searchKeywords: "flights Singapore to Bangkok round trip",
  },

  // ─── Hotels (no direct live API yet — seed only) ──────
  "hotel-marina-bay-sands": {
    searchKeywords: "Marina Bay Sands Singapore price per night",
  },
  "hotel-capella-sg": {
    searchKeywords: "Capella Singapore Sentosa price per night",
  },
  "hotel-ritz-paris": {
    searchKeywords: "Hôtel Ritz Paris price per night",
  },

  // ─── Events ───────────────────────────────────────────
  "event-coldplay-sg": {
    ticketmasterId: "G5diZf9kA7b1",  // placeholder — replace with real TM ID
    searchKeywords: "Coldplay Music of the Spheres Singapore",
  },
  "event-f1-sg": {
    ticketmasterId: "G5eR8hJ2mN4p",  // placeholder
    searchKeywords: "Singapore Grand Prix 2026 F1",
  },
  "event-udtb-sg": {
    ticketmasterId: "G5aB3cD6eF9g",  // placeholder
    searchKeywords: "Universal Studios Singapore ticket price",
  },
};

/**
 * Check whether a product has external IDs for a given source type.
 */
export function hasExternalId(sku: string, sourceType: string): boolean {
  const ids = PRODUCT_EXTERNAL_IDS[sku];
  if (!ids) return false;

  switch (sourceType) {
    case "amazon-us":
    case "amazon-sg":
      return !!ids.asin;
    case "bestbuy-us":
      return !!ids.bestbuySku;
    case "ticketmaster":
      return !!ids.ticketmasterId;
    case "google-flights":
    case "singapore-air":
    case "emirates":
      return !!ids.amadeusOrigin && !!ids.amadeusDestination;
    default:
      return false;
  }
}
