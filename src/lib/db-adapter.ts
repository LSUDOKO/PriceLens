/**
 * Database Adapter — Seamlessly switches between DynamoDB and in-memory store.
 * 
 * - When AWS credentials are configured → uses DynamoDB (production)
 * - When no AWS credentials → uses in-memory store (development/demo)
 * - Auto-detection on first call, health check endpoint available
 */

import { memoryStore } from "./memory-store";

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
