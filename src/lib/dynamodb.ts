import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

const REGION = process.env.AWS_REGION || "us-east-1";

const client = new DynamoDBClient({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const docClient = DynamoDBDocumentClient.from(client);

export const TABLES = {
  PRODUCTS: process.env.DYNAMODB_PRODUCTS_TABLE || "pricelens-products",
  PRICES: process.env.DYNAMODB_PRICES_TABLE || "pricelens-prices",
  ALERTS: process.env.DYNAMODB_ALERTS_TABLE || "pricelens-alerts",
};

// ─── Products ───────────────────────────────────────────────

export async function getProduct(sku: string) {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLES.PRODUCTS, Key: { sku } })
  );
  return result.Item;
}

export async function getAllProducts() {
  const result = await docClient.send(
    new ScanCommand({ TableName: TABLES.PRODUCTS })
  );
  return result.Items || [];
}

export async function getProductsByCategory(category: string) {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.PRODUCTS,
      IndexName: "category-index",
      KeyConditionExpression: "category = :cat",
      ExpressionAttributeValues: { ":cat": category },
    })
  );
  return result.Items || [];
}

export async function putProduct(product: Record<string, unknown>) {
  await docClient.send(
    new PutCommand({ TableName: TABLES.PRODUCTS, Item: product })
  );
}

// ─── Prices ─────────────────────────────────────────────────

export async function getPrices(sku: string) {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.PRICES,
      KeyConditionExpression: "sku = :sku",
      ExpressionAttributeValues: { ":sku": sku },
    })
  );
  return result.Items || [];
}

export async function getPrice(sku: string, source: string) {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLES.PRICES,
      Key: { sku, source },
    })
  );
  return result.Item;
}

export async function getPricesBySource(source: string) {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.PRICES,
      IndexName: "source-index",
      KeyConditionExpression: "#src = :src",
      ExpressionAttributeNames: { "#src": "source" },
      ExpressionAttributeValues: { ":src": source },
    })
  );
  return result.Items || [];
}

export async function putPrice(price: Record<string, unknown>) {
  await docClient.send(
    new PutCommand({ TableName: TABLES.PRICES, Item: price })
  );
}

// ─── Alerts ─────────────────────────────────────────────────

export async function getAlertsByUser(userId: string) {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.ALERTS,
      KeyConditionExpression: "userId = :uid",
      ExpressionAttributeValues: { ":uid": userId },
    })
  );
  return result.Items || [];
}

export async function putAlert(alert: Record<string, unknown>) {
  await docClient.send(
    new PutCommand({ TableName: TABLES.ALERTS, Item: alert })
  );
}

export async function deleteAlert(userId: string, alertId: string) {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLES.ALERTS,
      Key: { userId, alertId },
    })
  );
}

// ─── Scan all prices (for heatmap/summary) ──────────────────

export async function scanAllPrices() {
  const result = await docClient.send(
    new ScanCommand({ TableName: TABLES.PRICES })
  );
  return result.Items || [];
}

// ─── Seed data ──────────────────────────────────────────────

export async function seedInitialData(force?: boolean) {
  const existing = await getAllProducts();
  if (existing.length > 0) {
    if (force) {
      return {
        products: existing.length,
        prices: 0,
        skipped: true,
        message: `DynamoDB force re-seed: data already exists (${existing.length} products). Delete and re-create tables, then re-seed.`,
      };
    }
    return {
      products: existing.length,
      prices: 0,
      skipped: true,
      message: `Data already exists (${existing.length} products). Use ?force=true to re-seed.`,
    };
  }

  const products = getSeedProducts();
  const prices = getSeedPrices();

  for (const p of products) {
    await putProduct(p);
  }
  for (const p of prices) {
    await putPrice(p);
  }

  return { products: products.length, prices: prices.length, skipped: false };
}

function getSeedProducts() {
  return [
    { sku: "macbook-pro-m4", name: "Apple MacBook Pro 14\" M4 (2025)", category: "electronics", tags: ["laptop", "apple", "macbook"], baseSpecs: { chip: "M4 Pro", ram: "24GB", storage: "512GB SSD", screen: "14.2\" Liquid Retina XDR" } },
    { sku: "thinkpad-x1-gen12", name: "Lenovo ThinkPad X1 Carbon Gen 12", category: "electronics", tags: ["laptop", "lenovo", "thinkpad"], baseSpecs: { chip: "Intel Core Ultra 7", ram: "32GB", storage: "1TB SSD", screen: "14\" OLED 2.8K" } },
    { sku: "iphone-16-pro", name: "Apple iPhone 16 Pro 256GB", category: "electronics", tags: ["phone", "apple", "iphone"], baseSpecs: { chip: "A18 Pro", storage: "256GB", screen: "6.3\" OLED", camera: "48MP Triple" } },
    { sku: "galaxy-s25-ultra", name: "Samsung Galaxy S25 Ultra 256GB", category: "electronics", tags: ["phone", "samsung", "android"], baseSpecs: { chip: "Snapdragon 8 Gen 4", storage: "256GB", screen: "6.9\" Dynamic AMOLED", camera: "200MP Quad" } },
    { sku: "sony-wh1000xm6", name: "Sony WH-1000XM6 Headphones", category: "electronics", tags: ["headphones", "sony", "noise-cancelling"], baseSpecs: { driver: "30mm", battery: "40 hours", noiseCancelling: "Adaptive ANC", codec: "LDAC" } },
    { sku: "flight-sin-lhr", name: "Singapore → London (Round Trip)", category: "flights", tags: ["singapore", "london", "long-haul", "economy"], baseSpecs: { departure: "SIN", arrival: "LHR", duration: "~13h", cabin: "Economy" } },
    { sku: "flight-sin-nrt", name: "Singapore → Tokyo (Round Trip)", category: "flights", tags: ["singapore", "tokyo", "short-haul", "economy"], baseSpecs: { departure: "SIN", arrival: "NRT", duration: "~7h", cabin: "Economy" } },
    { sku: "flight-sin-bkk", name: "Singapore → Bangkok (Round Trip)", category: "flights", tags: ["singapore", "bangkok", "regional", "economy"], baseSpecs: { departure: "SIN", arrival: "BKK", duration: "~2.5h", cabin: "Economy" } },
    { sku: "hotel-marina-bay-sands", name: "Marina Bay Sands Singapore", category: "hotels", tags: ["singapore", "luxury", "5-star"], baseSpecs: { stars: "5", location: "Marina Bay", pool: "Infinity SkyPool", rooms: "2561" } },
    { sku: "hotel-capella-sg", name: "Capella Singapore", category: "hotels", tags: ["singapore", "luxury", "resort"], baseSpecs: { stars: "5", location: "Sentosa Island", rooms: "112", beach: "Private" } },
    { sku: "hotel-ritz-paris", name: "Hôtel Ritz Paris", category: "hotels", tags: ["paris", "luxury", "heritage"], baseSpecs: { stars: "5", location: "Place Vendôme", rooms: "142", restaurant: "Michelin 3-star" } },
    { sku: "event-coldplay-sg", name: "Coldplay: Music of the Spheres Tour — Singapore", category: "events", tags: ["concert", "coldplay", "singapore", "music"], baseSpecs: { venue: "Singapore National Stadium", date: "Feb 2026", capacity: "55,000" } },
    { sku: "event-f1-sg", name: "Singapore Grand Prix 2026", category: "events", tags: ["f1", "racing", "singapore", "sports"], baseSpecs: { venue: "Marina Bay Street Circuit", date: "Sep 2026", laps: "62" } },
    { sku: "event-udtb-sg", name: "Universal Studios Singapore Ticket", category: "events", tags: ["theme-park", "singapore", "family", "entertainment"], baseSpecs: { venue: "Resorts World Sentosa", type: "1-Day Pass", ageGroup: "Adult" } },
  ];
}

function getSeedPrices() {
  const now = Date.now();

  const pricing: Record<string, Record<string, { price: number; currency: string; unit: string; sourceType: string }>> = {
    "macbook-pro-m4": {
      "shopee-sg": { price: 2899, currency: "SGD", unit: "unit", sourceType: "merchant" },
      "lazada-sg": { price: 2949, currency: "SGD", unit: "unit", sourceType: "merchant" },
      "amazon-sg": { price: 2799, currency: "SGD", unit: "unit", sourceType: "merchant" },
      "amazon-us": { price: 1999, currency: "USD", unit: "unit", sourceType: "merchant" },
      "bestbuy-us": { price: 1999, currency: "USD", unit: "unit", sourceType: "merchant" },
    },
    "thinkpad-x1-gen12": {
      "shopee-sg": { price: 2499, currency: "SGD", unit: "unit", sourceType: "merchant" },
      "lazada-sg": { price: 2599, currency: "SGD", unit: "unit", sourceType: "merchant" },
      "amazon-sg": { price: 2399, currency: "SGD", unit: "unit", sourceType: "merchant" },
      "amazon-us": { price: 1749, currency: "USD", unit: "unit", sourceType: "merchant" },
      "bestbuy-us": { price: 1699, currency: "USD", unit: "unit", sourceType: "merchant" },
    },
    "iphone-16-pro": {
      "shopee-sg": { price: 1699, currency: "SGD", unit: "unit", sourceType: "merchant" },
      "lazada-sg": { price: 1649, currency: "SGD", unit: "unit", sourceType: "merchant" },
      "amazon-sg": { price: 1599, currency: "SGD", unit: "unit", sourceType: "merchant" },
      "amazon-us": { price: 1099, currency: "USD", unit: "unit", sourceType: "merchant" },
      "bestbuy-us": { price: 1099, currency: "USD", unit: "unit", sourceType: "merchant" },
    },
    "galaxy-s25-ultra": {
      "shopee-sg": { price: 1599, currency: "SGD", unit: "unit", sourceType: "merchant" },
      "lazada-sg": { price: 1549, currency: "SGD", unit: "unit", sourceType: "merchant" },
      "amazon-sg": { price: 1499, currency: "SGD", unit: "unit", sourceType: "merchant" },
      "amazon-us": { price: 999, currency: "USD", unit: "unit", sourceType: "merchant" },
      "bestbuy-us": { price: 979, currency: "USD", unit: "unit", sourceType: "merchant" },
    },
    "sony-wh1000xm6": {
      "shopee-sg": { price: 399, currency: "SGD", unit: "unit", sourceType: "merchant" },
      "lazada-sg": { price: 379, currency: "SGD", unit: "unit", sourceType: "merchant" },
      "amazon-sg": { price: 359, currency: "SGD", unit: "unit", sourceType: "merchant" },
      "amazon-us": { price: 349, currency: "USD", unit: "unit", sourceType: "merchant" },
      "bestbuy-us": { price: 329, currency: "USD", unit: "unit", sourceType: "merchant" },
    },
    "flight-sin-lhr": {
      "google-flights": { price: 980, currency: "SGD", unit: "round-trip", sourceType: "airline" },
      "singapore-air": { price: 1250, currency: "SGD", unit: "round-trip", sourceType: "airline" },
      "emirates": { price: 1050, currency: "SGD", unit: "round-trip", sourceType: "airline" },
    },
    "flight-sin-nrt": {
      "google-flights": { price: 520, currency: "SGD", unit: "round-trip", sourceType: "airline" },
      "singapore-air": { price: 680, currency: "SGD", unit: "round-trip", sourceType: "airline" },
    },
    "flight-sin-bkk": {
      "google-flights": { price: 180, currency: "SGD", unit: "round-trip", sourceType: "airline" },
      "singapore-air": { price: 260, currency: "SGD", unit: "round-trip", sourceType: "airline" },
    },
    "hotel-marina-bay-sands": {
      "booking-com": { price: 550, currency: "SGD", unit: "night", sourceType: "booking" },
      "agoda": { price: 520, currency: "SGD", unit: "night", sourceType: "booking" },
      "expedia": { price: 540, currency: "SGD", unit: "night", sourceType: "booking" },
    },
    "hotel-capella-sg": {
      "booking-com": { price: 780, currency: "SGD", unit: "night", sourceType: "booking" },
      "agoda": { price: 750, currency: "SGD", unit: "night", sourceType: "booking" },
      "expedia": { price: 770, currency: "SGD", unit: "night", sourceType: "booking" },
    },
    "hotel-ritz-paris": {
      "booking-com": { price: 1200, currency: "EUR", unit: "night", sourceType: "booking" },
      "agoda": { price: 1150, currency: "EUR", unit: "night", sourceType: "booking" },
      "expedia": { price: 1180, currency: "EUR", unit: "night", sourceType: "booking" },
    },
    "event-coldplay-sg": {
      "ticketmaster": { price: 168, currency: "SGD", unit: "ticket", sourceType: "exchange" },
      "viator": { price: 198, currency: "SGD", unit: "ticket", sourceType: "exchange" },
    },
    "event-f1-sg": {
      "ticketmaster": { price: 388, currency: "SGD", unit: "ticket", sourceType: "exchange" },
      "viator": { price: 420, currency: "SGD", unit: "ticket", sourceType: "exchange" },
    },
    "event-udtb-sg": {
      "ticketmaster": { price: 83, currency: "SGD", unit: "ticket", sourceType: "exchange" },
      "viator": { price: 92, currency: "SGD", unit: "ticket", sourceType: "exchange" },
    },
  };

  const prices: Record<string, unknown>[] = [];
  for (const sku of Object.keys(pricing)) {
    for (const [source, data] of Object.entries(pricing[sku])) {
      prices.push({
        sku,
        source,
        pricePerUnit: data.price,
        unit: data.unit,
        currency: data.currency,
        timestamp: now - Math.floor(Math.random() * 86400000),
        sourceType: data.sourceType,
      });
    }
  }
  return prices;
}
