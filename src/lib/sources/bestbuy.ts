/**
 * Best Buy API Adapter
 *
 * Simple REST API with API key authentication.
 * Returns product prices, availability, and details.
 *
 * Requires:
 *   BESTBUY_API_KEY — Get at https://developer.bestbuy.com/
 *
 * Rate limits: ~5 QPS, 50,000/day (free tier)
 * Docs: https://bestbuyapis.github.io/api-documentation/
 */

export interface BestBuyPriceResult {
  sku: number;
  name: string;
  regularPrice: number;
  salePrice: number;
  url: string;
  thumbnailImage?: string;
  onSale: boolean;
  inStock: boolean;
  timestamp: number;
}

// ─── Config ─────────────────────────────────────────────────────

const API_KEY = process.env.BESTBUY_API_KEY || "";
const BASE_URL = "https://api.bestbuy.com/v1";

export function isConfigured(): boolean {
  return !!API_KEY;
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Look up a product by Best Buy numeric SKU.
 */
export async function lookupBySku(sku: number | string): Promise<BestBuyPriceResult | null> {
  if (!isConfigured()) return null;

  try {
    const url = `${BASE_URL}/products/${sku}.json?show=sku,name,regularPrice,salePrice,url,thumbnailImage,onlineAvailability,onSale&apiKey=${API_KEY}`;
    const res = await fetch(url);

    if (!res.ok) {
      console.warn(`[bestbuy] API error for SKU ${sku}: ${res.status}`);
      return null;
    }

    const json = await res.json();
    if (!json || json.error) return null;

    return {
      sku: json.sku,
      name: json.name,
      regularPrice: json.regularPrice,
      salePrice: json.salePrice ?? json.regularPrice,
      url: json.url,
      thumbnailImage: json.thumbnailImage,
      onSale: json.onSale ?? false,
      inStock: json.onlineAvailability ?? true,
      timestamp: Date.now(),
    };
  } catch (err) {
    console.warn(`[bestbuy] Error looking up SKU ${sku}:`, (err as Error).message);
    return null;
  }
}

/**
 * Search products by keyword — returns up to 5 results.
 */
export async function searchByKeyword(keyword: string): Promise<BestBuyPriceResult[]> {
  if (!isConfigured()) return [];

  try {
    const encoded = encodeURIComponent(keyword);
    const url = `${BASE_URL}/products(longDescription=${encoded}*)?show=sku,name,regularPrice,salePrice,url,thumbnailImage,onlineAvailability,onSale&pageSize=5&apiKey=${API_KEY}`;
    const res = await fetch(url);

    if (!res.ok) {
      console.warn(`[bestbuy] search error: ${res.status}`);
      return [];
    }

    const json = await res.json();
    const products = json?.products || [];

    return products.map((p: Record<string, unknown>) => ({
      sku: p.sku as number,
      name: p.name as string,
      regularPrice: (p.regularPrice as number) ?? 0,
      salePrice: (p.salePrice as number) ?? (p.regularPrice as number) ?? 0,
      url: p.url as string,
      thumbnailImage: p.thumbnailImage as string | undefined,
      onSale: (p.onSale as boolean) ?? false,
      inStock: (p.onlineAvailability as boolean) ?? true,
      timestamp: Date.now(),
    }));
  } catch (err) {
    console.warn(`[bestbuy] Error searching "${keyword}":`, (err as Error).message);
    return [];
  }
}
