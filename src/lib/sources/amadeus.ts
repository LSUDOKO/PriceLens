/**
 * Amadeus Self-Service API Adapter
 *
 * OAuth2-authenticated REST API for flight offers.
 * Uses test environment by default; switch host for production.
 *
 * Requires:
 *   AMADEUS_API_KEY     — Client ID from Amadeus for Developers
 *   AMADEUS_API_SECRET  — Client Secret
 *
 * Free tier: 2,000 calls/month (test environment, cached data)
 * Docs: https://developers.amadeus.com/self-service/apis-docs/guides
 *
 * Environments:
 *   Test:       test.api.amadeus.com
 *   Production: api.amadeus.com
 */

export interface AmadeusFlightPriceResult {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  /** Cheapest available fare for this route */
  priceAmount: number;
  currency: string;
  /** Number of seats available at this price */
  seatsAvailable: number;
  /** Airline(s) operating the flight */
  airlines: string[];
  /** Whether it's a round trip */
  roundTrip: boolean;
  timestamp: number;
}

// ─── Config ─────────────────────────────────────────────────────

const API_KEY = process.env.AMADEUS_API_KEY || "";
const API_SECRET = process.env.AMADEUS_API_SECRET || "";
const API_HOST = process.env.AMADEUS_API_HOST || "test.api.amadeus.com";

export function isConfigured(): boolean {
  return !!(API_KEY && API_SECRET);
}

// ─── Token cache ────────────────────────────────────────────────

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string | null> {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  try {
    const params = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: API_KEY,
      client_secret: API_SECRET,
    });

    const res = await fetch(`https://${API_HOST}/v1/security/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!res.ok) {
      console.warn(`[amadeus] Token error: ${res.status}`);
      return null;
    }

    const json = await res.json();
    cachedToken = json.access_token as string;
    tokenExpiresAt = Date.now() + (json.expires_in as number) * 1000;
    return cachedToken;
  } catch (err) {
    console.warn("[amadeus] Error getting access token:", (err as Error).message);
    return null;
  }
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Search for the cheapest flight offers on a given route.
 *
 * @param origin        IATA code (e.g., "SIN")
 * @param destination   IATA code (e.g., "LHR")
 * @param departDate    Departure date (YYYY-MM-DD)
 * @param returnDate    Optional return date for round trip
 */
export async function searchFlightOffers(
  origin: string,
  destination: string,
  departDate?: string,
  returnDate?: string,
): Promise<AmadeusFlightPriceResult[]> {
  if (!isConfigured()) return [];

  const token = await getAccessToken();
  if (!token) return [];

  const depart = departDate || getDateDaysFromNow(30);
  const returnD = returnDate || "";

  try {
    let url = `https://${API_HOST}/v2/shopping/flight-offers?originLocationCode=${origin}&destinationLocationCode=${destination}&departureDate=${depart}&adults=1&currencyCode=SGD&max=5`;

    if (returnD) {
      url += `&returnDate=${returnD}`;
    }

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn(`[amadeus] Flight offers error (${res.status}): ${text.slice(0, 200)}`);
      return [];
    }

    const json = await res.json();
    const offers = json?.data || [];
    const now = Date.now();

    return offers.map((offer: Record<string, unknown>) => {
      const firstItinerary = (offer as any).itineraries?.[0] || {};
      const segments = firstItinerary.segments || [];
      const price = (offer as any).price || {};
      const airlines = [...new Set(segments.map((s: Record<string, unknown>) => s.carrierCode as string))] as string[];

      return {
        origin,
        destination,
        departureDate: depart,
        returnDate: returnD || undefined,
        priceAmount: parseFloat(price.grandTotal || price.total || "0"),
        currency: price.currency || "SGD",
        seatsAvailable: (offer as any).numberOfBookableSeats || 0,
        airlines: airlines.length > 0 ? airlines : [offer.carrierCode as string].filter(Boolean),
        roundTrip: !!returnD,
        timestamp: now,
      };
    });
  } catch (err) {
    console.warn(`[amadeus] Error searching flights ${origin}→${destination}:`, (err as Error).message);
    return [];
  }
}

// ─── Internal helpers ───────────────────────────────────────────

function getDateDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
