/**
 * Amazon PA-API 5.0 Adapter (via Creators API / GetItems)
 *
 * Requires:
 *   AMAZON_ACCESS_KEY   — AWS IAM access key (from Amazon Associates)
 *   AMAZON_SECRET_KEY   — AWS IAM secret key
 *   AMAZON_ASSOCIATE_TAG — Your Associate tag (e.g., "pricelens-20")
 *   AMAZON_MARKETPLACE  — e.g., "www.amazon.com" or "www.amazon.sg"
 *
 * Rate limits: ~1 QPS per Associate tag (free)
 * Docs: https://webservices.amazon.com/paapi5/documentation/
 *
 * NOTE: PA-API 5.0 is being retired May 15, 2026 in favour of Creators API.
 *       This adapter uses the current GetItems operation.
 *       When Creators API stabilises, swap the endpoint + auth.
 */

/**
 * Minimal price info we extract from the PA-API response.
 */
export interface AmazonPriceResult {
  asin: string;
  title: string;
  priceAmount?: number;
  currency?: string;
  url: string;
  timestamp: number;
}

// ─── Config ─────────────────────────────────────────────────────

const ACCESS_KEY = process.env.AMAZON_ACCESS_KEY || "";
const SECRET_KEY = process.env.AMAZON_SECRET_KEY || "";
const PARTNER_TAG = process.env.AMAZON_ASSOCIATE_TAG || "";
const MARKETPLACE = process.env.AMAZON_MARKETPLACE || "www.amazon.com";
const HOST = "webservices.amazon.com";
const REGION = "us-east-1";
const SERVICE = "ProductAdvertisingAPI";
const TARGET = "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems";

/** Adapter is active when all required env vars are present. */
export function isConfigured(): boolean {
  return !!(ACCESS_KEY && SECRET_KEY && PARTNER_TAG);
}

// ─── Low-level helpers ─────────────────────────────────────────

/**
 * Create an ISO-8601 date/time for SigV4.
 */
function amzDate(): { date: string; datetime: string } {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const time = now.toISOString().slice(11, 19).replace(/:/g, "");
  return { date, datetime: `${date}T${time}Z` };
}

/**
 * Simplified AWS Signature V4 for PA-API.
 * Reference: https://docs.aws.amazon.com/general/latest/gr/sigv4_signing.html
 *
 * Uses raw Node.js/Web Crypto APIs with type-safe wrappers.
 */
async function signRequest(
  payload: string,
  { date, datetime }: { date: string; datetime: string },
): Promise<{ authorization: string }> {
  const payloadHash = await sha256Hex(payload);

  const canonicalUri = "/paapi5/getitems";
  const canonicalQuerystring = "";
  const canonicalHeaders =
    `content-encoding:amz-1.0\n` +
    `content-type:application/json; charset=utf-8\n` +
    `host:${HOST}\n` +
    `x-amz-date:${datetime}\n` +
    `x-amz-target:${TARGET}\n`;
  const signedHeaders = "content-encoding;content-type;host;x-amz-date;x-amz-target";
  const canonicalRequest =
    `POST\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${date}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign =
    `${algorithm}\n${datetime}\n${credentialScope}\n${await sha256Hex(canonicalRequest)}`;

  // Derive signing key: HMAC(HMAC(HMAC(HMAC("AWS4" + SecretKey, date), region), service), "aws4_request")
  const kDate = await hmacHex(`AWS4${SECRET_KEY}`, date);
  const kRegion = await hmacHex(kDate, REGION);
  const kService = await hmacHex(kRegion, SERVICE);
  const kSigning = await hmacHex(kService, "aws4_request");
  const signature = await hmacHex(kSigning, stringToSign);

  const authorization =
    `${algorithm} Credential=${ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { authorization };
}

/**
 * Compute SHA-256 hex digest of a string.
 */
async function sha256Hex(str: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(str));
  return hexFromBuffer(buf);
}

/**
 * Compute HMAC-SHA256 and return the hex-encoded signature.
 * key can be a string (first call) or an ArrayBuffer (subsequent chained calls).
 */
async function hmacHex(key: string | ArrayBuffer, data: string): Promise<string> {
  const enc = new TextEncoder();
  const keyBytes: ArrayBuffer =
    typeof key === "string" ? enc.encode(key).buffer : key;
  const dataBytes: ArrayBuffer = enc.encode(data).buffer;

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, dataBytes);
  return hexFromBuffer(sig);
}

/**
 * Convert ArrayBuffer to hex string.
 */
function hexFromBuffer(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Look up products by ASIN and return live prices.
 */
export async function lookupAsins(asins: string[]): Promise<AmazonPriceResult[]> {
  if (!isConfigured() || asins.length === 0) return [];

  const payload = JSON.stringify({
    PartnerTag: PARTNER_TAG,
    PartnerType: "Associates",
    Marketplace: MARKETPLACE,
    ItemIds: asins,
    Resources: [
      "ItemInfo.Title",
      "Offers.Listings.Price",
      "Offers.Listings.DeliveryInfo.IsFreeShippingEligible",
    ],
  });

  const dates = amzDate();
  const { authorization } = await signRequest(payload, dates);

  const response = await fetch(`https://${HOST}/paapi5/getitems`, {
    method: "POST",
    headers: {
      "Content-Encoding": "amz-1.0",
      "Content-Type": "application/json; charset=utf-8",
      "Host": HOST,
      "X-Amz-Date": dates.datetime,
      "X-Amz-Target": TARGET,
      "Authorization": authorization,
    },
    body: payload,
  });

  if (!response.ok) {
    const text = await response.text();
    console.warn(`[amazon] PA-API error (${response.status}): ${text.slice(0, 300)}`);
    return [];
  }

  const json = await response.json();
  const items = json?.ItemsResult?.Items || [];
  const now = Date.now();

  return items.map((item: Record<string, unknown>) => {
    const price = (item as any)?.Offers?.Listings?.[0]?.Price;
    return {
      asin: item.ASIN as string,
      title: (item as any)?.ItemInfo?.Title?.DisplayValue || (item.ASIN as string),
      priceAmount: price?.Amount ? Number(price.Amount) : undefined,
      currency: price?.Currency || undefined,
      url: item.DetailPageURL as string || `https://${MARKETPLACE}/dp/${item.ASIN}`,
      timestamp: now,
    };
  });
}

/**
 * Search Amazon by keyword (uses the SearchItems operation).
 * Currently limited — products are looked up via ASIN in product-map.ts.
 */
export async function searchByKeyword(_keyword: string): Promise<AmazonPriceResult[]> {
  if (!isConfigured()) return [];
  // SearchItems requires a separate SigV4-signed request with a different
  // x-amz-target header. For hackathon scope, products are looked up via
  // mapped ASINs in product-map.ts using GetItems.
  return [];
}
