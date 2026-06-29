/**
 * In-Memory Store — Fallback when DynamoDB is not available.
 * 
 * This allows PriceLens to work fully out of the box without AWS credentials.
 * When DynamoDB is configured, data syncs to AWS automatically.
 * When not configured, data persists in memory for the session.
 */

interface Product {
  sku: string;
  name: string;
  category: string;
  tags: string[];
  baseSpecs: Record<string, string>;
  [key: string]: unknown;
}

interface Price {
  sku: string;
  source: string;
  pricePerUnit: number;
  unit: string;
  currency: string;
  timestamp: number;
  sourceType: string;
  [key: string]: unknown;
}

interface Alert {
  userId: string;
  alertId: string;
  sku: string;
  targetSource: string;
  targetPrice: number;
  webhookUrl?: string;
  createdAt: number;
  productName?: string;
  [key: string]: unknown;
}

class MemoryStore {
  private products: Map<string, Product> = new Map();
  private prices: Map<string, Price> = new Map(); // key: "sku#source"
  private alerts: Map<string, Alert[]> = new Map(); // key: userId

  // ─── Products ───────────────────────────────────────────────

  getProduct(sku: string): Record<string, unknown> | undefined {
    return this.products.get(sku) as Record<string, unknown> | undefined;
  }

  getAllProducts(): Record<string, unknown>[] {
    return Array.from(this.products.values()) as Record<string, unknown>[];
  }

  getProductsByCategory(category: string): Record<string, unknown>[] {
    return this.getAllProducts().filter(p => p.category === category);
  }

  putProduct(product: Product): void {
    this.products.set(product.sku, product);
  }

  // ─── Prices ─────────────────────────────────────────────────

  getPrices(sku: string): Record<string, unknown>[] {
    return this.getAllPrices().filter(p => p.sku === sku);
  }

  getPrice(sku: string, source: string): Record<string, unknown> | undefined {
    return this.prices.get(`${sku}#${source}`) as Record<string, unknown> | undefined;
  }

  getPricesBySource(source: string): Record<string, unknown>[] {
    return this.getAllPrices().filter(p => p.source === source);
  }

  getAllPrices(): Record<string, unknown>[] {
    return Array.from(this.prices.values()) as Record<string, unknown>[];
  }

  putPrice(price: Price): void {
    this.prices.set(`${price.sku}#${price.source}`, price);
  }

  // ─── Alerts ─────────────────────────────────────────────────

  getAlertsByUser(userId: string): Record<string, unknown>[] {
    return (this.alerts.get(userId) || []) as Record<string, unknown>[];
  }

  putAlert(alert: Alert): void {
    const existing = this.alerts.get(alert.userId) || [];
    const idx = existing.findIndex(a => a.alertId === alert.alertId);
    if (idx >= 0) {
      existing[idx] = alert;
    } else {
      existing.push(alert);
    }
    this.alerts.set(alert.userId, existing);
  }

  deleteAlert(userId: string, alertId: string): void {
    const existing = this.alerts.get(userId) || [];
    this.alerts.set(userId, existing.filter(a => a.alertId !== alertId));
  }

  // ─── Seed ───────────────────────────────────────────────────

  seedInitialData(force?: boolean): { products: number; prices: number; skipped: boolean; message?: string } {
    if (force) {
      this.products.clear();
      this.prices.clear();
      this.alerts.clear();
    }
    if (this.products.size > 0) {
      return {
        products: this.products.size,
        prices: this.prices.size,
        skipped: true,
        message: `Data already exists (${this.products.size} products).`,
      };
    }

    const seedProducts = getSeedProducts();
    const seedPrices = getSeedPrices();

    for (const p of seedProducts) {
      this.putProduct(p);
    }
    for (const p of seedPrices) {
      this.putPrice(p);
    }

    return { products: seedProducts.length, prices: seedPrices.length, skipped: false };
  }
}

// Singleton instance
export const memoryStore = new MemoryStore();

// ─── Seed Data ────────────────────────────────────────────────

function getSeedProducts(): Product[] {
  return [
    // Electronics
    { sku: "macbook-pro-m4", name: "Apple MacBook Pro 14\" M4 (2025)", category: "electronics", tags: ["laptop", "apple", "macbook"], baseSpecs: { chip: "M4 Pro", ram: "24GB", storage: "512GB SSD", screen: "14.2\" Liquid Retina XDR" } },
    { sku: "thinkpad-x1-gen12", name: "Lenovo ThinkPad X1 Carbon Gen 12", category: "electronics", tags: ["laptop", "lenovo", "thinkpad"], baseSpecs: { chip: "Intel Core Ultra 7", ram: "32GB", storage: "1TB SSD", screen: "14\" OLED 2.8K" } },
    { sku: "iphone-16-pro", name: "Apple iPhone 16 Pro 256GB", category: "electronics", tags: ["phone", "apple", "iphone"], baseSpecs: { chip: "A18 Pro", storage: "256GB", screen: "6.3\" OLED", camera: "48MP Triple" } },
    { sku: "galaxy-s25-ultra", name: "Samsung Galaxy S25 Ultra 256GB", category: "electronics", tags: ["phone", "samsung", "android"], baseSpecs: { chip: "Snapdragon 8 Gen 4", storage: "256GB", screen: "6.9\" Dynamic AMOLED", camera: "200MP Quad" } },
    { sku: "sony-wh1000xm6", name: "Sony WH-1000XM6 Headphones", category: "electronics", tags: ["headphones", "sony", "noise-cancelling"], baseSpecs: { driver: "30mm", battery: "40 hours", noiseCancelling: "Adaptive ANC", codec: "LDAC" } },
    // Flights
    { sku: "flight-sin-lhr", name: "Singapore → London (Round Trip)", category: "flights", tags: ["singapore", "london", "long-haul", "economy"], baseSpecs: { departure: "SIN", arrival: "LHR", duration: "~13h", cabin: "Economy" } },
    { sku: "flight-sin-nrt", name: "Singapore → Tokyo (Round Trip)", category: "flights", tags: ["singapore", "tokyo", "short-haul", "economy"], baseSpecs: { departure: "SIN", arrival: "NRT", duration: "~7h", cabin: "Economy" } },
    { sku: "flight-sin-bkk", name: "Singapore → Bangkok (Round Trip)", category: "flights", tags: ["singapore", "bangkok", "regional", "economy"], baseSpecs: { departure: "SIN", arrival: "BKK", duration: "~2.5h", cabin: "Economy" } },
    // Hotels
    { sku: "hotel-marina-bay-sands", name: "Marina Bay Sands Singapore", category: "hotels", tags: ["singapore", "luxury", "5-star"], baseSpecs: { stars: "5", location: "Marina Bay", pool: "Infinity SkyPool", rooms: "2561" } },
    { sku: "hotel-capella-sg", name: "Capella Singapore", category: "hotels", tags: ["singapore", "luxury", "resort"], baseSpecs: { stars: "5", location: "Sentosa Island", rooms: "112", beach: "Private" } },
    { sku: "hotel-ritz-paris", name: "Hôtel Ritz Paris", category: "hotels", tags: ["paris", "luxury", "heritage"], baseSpecs: { stars: "5", location: "Place Vendôme", rooms: "142", restaurant: "Michelin 3-star" } },
    // Events
    { sku: "event-coldplay-sg", name: "Coldplay: Music of the Spheres Tour — Singapore", category: "events", tags: ["concert", "coldplay", "singapore", "music"], baseSpecs: { venue: "Singapore National Stadium", date: "Feb 2026", capacity: "55,000" } },
    { sku: "event-f1-sg", name: "Singapore Grand Prix 2026", category: "events", tags: ["f1", "racing", "singapore", "sports"], baseSpecs: { venue: "Marina Bay Street Circuit", date: "Sep 2026", laps: "62" } },
    { sku: "event-udtb-sg", name: "Universal Studios Singapore Ticket", category: "events", tags: ["theme-park", "singapore", "family", "entertainment"], baseSpecs: { venue: "Resorts World Sentosa", type: "1-Day Pass", ageGroup: "Adult" } },
  ];
}

function getSeedPrices(): Price[] {
  const now = Date.now();

  // Pricing data: product SKU → source → price
  const pricing: Record<string, Record<string, { price: number; currency: string; unit: string; sourceType: string }>> = {
    // Electronics
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
    // Flights
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
    // Hotels
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
    // Events
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

  const prices: Price[] = [];
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
