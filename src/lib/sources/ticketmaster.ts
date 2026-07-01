/**
 * Ticketmaster Discovery API v2 Adapter
 *
 * REST API with API key authentication (query param).
 * Returns event details, price ranges, and venue info.
 *
 * Requires:
 *   TICKETMASTER_API_KEY — Get at https://developer.ticketmaster.com/
 *
 * Rate limits: 5,000 requests/day, 5 QPS (free tier)
 * Docs: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
 */

/**
 * Minimal price info we extract from Ticketmaster.
 * Note: priceRanges may not be available for all events.
 */
export interface TicketmasterPriceResult {
  eventId: string;
  name: string;
  url: string;
  /** Price range — may be undefined if not on sale yet */
  minPrice?: number;
  maxPrice?: number;
  currency?: string;
  /** Representative price for comparison: (min + max) / 2, or min if only one */
  representativePrice?: number;
  date: string;
  venue: string;
  timestamp: number;
}

// ─── Config ─────────────────────────────────────────────────────

const API_KEY = process.env.TICKETMASTER_API_KEY || "";
const BASE_URL = "https://app.ticketmaster.com/discovery/v2";

export function isConfigured(): boolean {
  return !!API_KEY;
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Look up an event by Ticketmaster event ID and return pricing.
 */
export async function lookupByEventId(eventId: string): Promise<TicketmasterPriceResult | null> {
  if (!isConfigured()) return null;

  try {
    const url = `${BASE_URL}/events/${eventId}.json?apikey=${API_KEY}`;
    const res = await fetch(url);

    if (!res.ok) {
      console.warn(`[ticketmaster] API error for event ${eventId}: ${res.status}`);
      return null;
    }

    const json = await res.json();
    if (!json || json.error) return null;

    return parseEvent(json);
  } catch (err) {
    console.warn(`[ticketmaster] Error looking up event ${eventId}:`, (err as Error).message);
    return null;
  }
}

/**
 * Search events by keyword — returns up to 5 results with pricing.
 */
export async function searchByKeyword(keyword: string, countryCode = "SG"): Promise<TicketmasterPriceResult[]> {
  if (!isConfigured()) return [];

  try {
    const encoded = encodeURIComponent(keyword);
    const url = `${BASE_URL}/events.json?apikey=${API_KEY}&keyword=${encoded}&countryCode=${countryCode}&size=5&sort=date,asc`;
    const res = await fetch(url);

    if (!res.ok) {
      console.warn(`[ticketmaster] search error: ${res.status}`);
      return [];
    }

    const json = await res.json();
    const events = json?._embedded?.events || [];

    return events.map(parseEvent).filter((e: TicketmasterPriceResult | null) => e !== null) as TicketmasterPriceResult[];
  } catch (err) {
    console.warn(`[ticketmaster] Error searching "${keyword}":`, (err as Error).message);
    return [];
  }
}

// ─── Internal helpers ───────────────────────────────────────────

function parseEvent(event: Record<string, unknown>): TicketmasterPriceResult | null {
  if (!event || !event.id) return null;

  const priceRanges = (event as any).priceRanges as Array<{ min: number; max: number; currency: string }> | undefined;
  const minPrice = priceRanges?.[0]?.min;
  const maxPrice = priceRanges?.[0]?.max;
  const currency = priceRanges?.[0]?.currency;
  const representativePrice = minPrice !== undefined
    ? maxPrice !== undefined
      ? (minPrice + maxPrice) / 2
      : minPrice
    : undefined;

  const venue = (event as any)?._embedded?.venues?.[0]?.name || "Unknown venue";
  const dates = (event as any)?.dates?.start?.localDate || "";

  return {
    eventId: event.id as string,
    name: event.name as string,
    url: event.url as string,
    minPrice,
    maxPrice,
    currency: currency || "USD",
    representativePrice: representativePrice ? Math.round(representativePrice * 100) / 100 : undefined,
    date: dates,
    venue,
    timestamp: Date.now(),
  };
}
