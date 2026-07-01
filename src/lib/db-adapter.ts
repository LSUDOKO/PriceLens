/**
 * Database Adapter — Seamlessly switches between DynamoDB and in-memory store.
 * 
 * - When AWS credentials are configured → uses DynamoDB (production)
 * - When no AWS credentials → uses in-memory store (development/demo)
 * - Auto-detection on first call, health check endpoint available
 */

import { memoryStore } from "./memory-store";
import { fetchLivePrices, getConfiguredSourcesCount, getLiveCapableSources } from "./sources";
import type { LivePriceResult } from "./sources";

let useDynamoDB: boolean | null = null;
let dynamoModule: typeof import("./dynamodb") | null = null;

async function checkDynamoDBAvailable(): Promise<boolean> {
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    try {
      const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
      const client = new DynamoDBClient({
        region: process.env.AWS_REGION || "us-east-1",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });
      // Test connection by listing tables
      await client.send(
        new (await import("@aws-sdk/client-dynamodb")).ListTablesCommand({ Limit: 1 })
      );
      return true;
    } catch {
      console.warn("⚠️  AWS credentials configured but DynamoDB unreachable. Falling back to in-memory store.");
      return false;
    }
  }
  return false;
}

async function getDB() {
  if (useDynamoDB === null) {
    useDynamoDB = await checkDynamoDBAvailable();
    if (useDynamoDB) {
      dynamoModule = await import("./dynamodb");
    }
  }
  return useDynamoDB ? dynamoModule! : null;
}

export function getStoreType(): "dynamodb" | "memory" {
  return useDynamoDB ? "dynamodb" : "memory";
}

export async function healthCheck(): Promise<{
  status: "ok" | "degraded";
  store: "dynamodb" | "memory";
  tables?: string[];
  productCount: number;
  priceCount: number;
}> {
  const isDynamo = useDynamoDB;
  let productCount = 0;
  let priceCount = 0;
  let tables: string[] | undefined;

  if (isDynamo && dynamoModule) {
    try {
      const products = await dynamoModule.getAllProducts();
      const prices = await dynamoModule.scanAllPrices();
      productCount = products.length;
      priceCount = prices.length;
      tables = [dynamoModule.TABLES.PRODUCTS, dynamoModule.TABLES.PRICES, dynamoModule.TABLES.ALERTS];
    } catch {
      // Fall through to memory
    }
  }

  const memProducts = memoryStore.getAllProducts();
  const memPrices = memoryStore.getAllPrices();
  if (!isDynamo) {
    productCount = memProducts.length;
    priceCount = memPrices.length;
  }

  return {
    status: productCount > 0 ? "ok" : "degraded",
    store: useDynamoDB ? "dynamodb" : "memory",
    tables,
    productCount,
    priceCount,
  };
}

// ─── Products API ─────────────────────────────────────────────

export async function getProduct(sku: string) {
  const db = await getDB();
  if (db) return db.getProduct(sku);
  return memoryStore.getProduct(sku);
}

export async function getAllProducts() {
  const db = await getDB();
  if (db) return db.getAllProducts();
  return memoryStore.getAllProducts();
}

export async function getProductsByCategory(category: string) {
  const db = await getDB();
  if (db) return db.getProductsByCategory(category);
  return memoryStore.getProductsByCategory(category);
}

export async function putProduct(product: Record<string, unknown>) {
  const db = await getDB();
  if (db) await db.putProduct(product);
  else memoryStore.putProduct(product as any);
}

// ─── Live API Sources ─────────────────────────────────────────

export function getLiveSourcesInfo() {
  return {
    count: getConfiguredSourcesCount(),
    sources: getLiveCapableSources(),
  };
}

// ─── Prices API ───────────────────────────────────────────────

export async function getPrices(sku: string) {
  const db = await getDB();
  if (db) return db.getPrices(sku);
  return memoryStore.getPrices(sku);
}

export async function getPrice(sku: string, source: string) {
  const db = await getDB();
  if (db) return db.getPrice(sku, source);
  return memoryStore.getPrice(sku, source);
}

export async function getPricesBySource(source: string) {
  const db = await getDB();
  if (db) return db.getPricesBySource(source);
  return memoryStore.getPricesBySource(source);
}

/**
 * Get merged prices — seed/memory data enriched with live API results.
 * Live results override seed data for the same source.
 * Results include a `live` boolean flag.
 */
export async function getMergedPrices(sku: string): Promise<Record<string, unknown>[]> {
  // Fetch seed and live in parallel
  const [seedPrices, livePrices] = await Promise.all([
    getPrices(sku),
    fetchLivePrices(sku),
  ]);

  if (livePrices.length === 0) {
    return seedPrices;
  }

  // Build map: source → live price
  const liveBySource = new Map<string, LivePriceResult>();
  for (const lp of livePrices) {
    liveBySource.set(lp.source, lp);
  }

  // Merge: live overrides seed for same source; preserve seed sources not in live
  const seenSources = new Set<string>();
  const merged: Record<string, unknown>[] = [];

  for (const sp of seedPrices) {
    const source = sp.source as string;
    seenSources.add(source);
    const live = liveBySource.get(source);
    if (live) {
      merged.push({
        ...sp,
        pricePerUnit: live.pricePerUnit,
        currency: live.currency,
        timestamp: live.timestamp,
        live: true,
        liveDetail: live.detail,
        liveUrl: live.url,
      });
    } else {
      merged.push({ ...sp, live: false });
    }
  }

  // Add any live-only sources (new sources not in seed data)
  for (const lp of livePrices) {
    if (!seenSources.has(lp.source)) {
      merged.push({
        sku: lp.sku,
        source: lp.source,
        sourceType: lp.sourceType,
        pricePerUnit: lp.pricePerUnit,
        currency: lp.currency,
        unit: lp.unit,
        timestamp: lp.timestamp,
        live: true,
        liveDetail: lp.detail,
        liveUrl: lp.url,
      });
    }
  }

  return merged;
}

/**
 * Get merged prices for all products — used for the main explorer view.
 * Fetches seed prices for all products, then enriches with live data.
 */
export async function getMergedAllPrices(): Promise<{
  products: { product: Record<string, unknown>; prices: Record<string, unknown>[] }[];
  sources: Record<string, unknown>[];
  liveSourceCount: number;
  liveSources: string[];
}> {
  const [allPrices, allProducts] = await Promise.all([
    scanAllPrices(),
    getAllProducts(),
  ]);

  // Group prices by SKU
  const grouped: Record<string, Record<string, unknown>[]> = {};
  for (const p of allPrices) {
    const key = String(p.sku || "");
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  }

  // Enrich each product with live prices
  const results = allProducts.map((prod) => ({
    product: prod,
    prices: grouped[prod.sku as string] || [],
  }));

  // Fetch live prices for all products in parallel
  const uniqueSkus = [...new Set(allProducts.map(p => p.sku as string))];
  const liveResults = await Promise.all(
    uniqueSkus.map(sku => fetchLivePrices(sku))
  );

  // Merge live into results
  for (let i = 0; i < results.length; i++) {
    const sku = results[i].product.sku as string;
    const skuIndex = uniqueSkus.indexOf(sku);
    const livePrices = skuIndex >= 0 ? liveResults[skuIndex] : [];

    if (livePrices.length > 0) {
      const merged = new Map<string, Record<string, unknown>>();
      
      // Existing seed prices (marked as not live)
      for (const p of results[i].prices) {
        merged.set(p.source as string, { ...p, live: false });
      }

      // Live prices override
      for (const lp of livePrices) {
        merged.set(lp.source, {
          sku: lp.sku,
          source: lp.source,
          sourceType: lp.sourceType,
          pricePerUnit: lp.pricePerUnit,
          currency: lp.currency,
          unit: lp.unit,
          timestamp: lp.timestamp,
          live: true,
          liveDetail: lp.detail,
          liveUrl: lp.url,
        });
      }

      results[i].prices = Array.from(merged.values());
    }
  }

  const { PRICE_SOURCES: sourceInfos } = await import("./types");

  return {
    products: results,
    sources: sourceInfos as unknown as Record<string, unknown>[],
    liveSourceCount: getConfiguredSourcesCount(),
    liveSources: getLiveCapableSources(),
  };
}

export async function scanAllPrices() {
  const db = await getDB();
  if (db) return db.scanAllPrices();
  return memoryStore.getAllPrices();
}

export async function putPrice(price: Record<string, unknown>) {
  const db = await getDB();
  if (db) await db.putPrice(price);
  else memoryStore.putPrice(price as any);
}

// ─── Alerts API ───────────────────────────────────────────────

export async function getAlertsByUser(userId: string) {
  const db = await getDB();
  if (db) return db.getAlertsByUser(userId);
  return memoryStore.getAlertsByUser(userId);
}

export async function putAlert(alert: Record<string, unknown>) {
  const db = await getDB();
  if (db) await db.putAlert(alert);
  else memoryStore.putAlert(alert as any);
}

export async function deleteAlert(userId: string, alertId: string) {
  const db = await getDB();
  if (db) await db.deleteAlert(userId, alertId);
  else memoryStore.deleteAlert(userId, alertId);
}

// ─── Seed ─────────────────────────────────────────────────────

export async function seedInitialData(force?: boolean) {
  const db = await getDB();
  if (db) return db.seedInitialData(force);
  return memoryStore.seedInitialData(force);
}
