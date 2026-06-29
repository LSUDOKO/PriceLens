export interface Product {
  sku: string;
  name: string;
  category: string;
  tags: string[];
  baseSpecs: Record<string, string>;
}

export interface PriceRecord {
  sku: string;
  source: string;       // merchant, airline, booking site, etc.
  pricePerUnit: number;
  unit: string;          // ticket, night, unit, etc.
  currency: string;
  timestamp: number;
  sourceType: string;    // "merchant" | "airline" | "booking" | "exchange" | "api"
}

export interface PriceAlert {
  userId: string;
  alertId: string;
  sku: string;
  targetSource: string;
  targetPrice: number;
  webhookUrl?: string;
  createdAt: number;
}

export interface MCPToolResponse {
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

export interface SourceInfo {
  id: string;
  name: string;
  type: string;       // "merchant" | "airline" | "exchange" | "booking"
  icon: string;
}

export const PRICE_SOURCES: SourceInfo[] = [
  // Electronics / General Shopping
  { id: "shopee-sg", name: "Shopee Singapore", type: "merchant", icon: "🛒" },
  { id: "lazada-sg", name: "Lazada Singapore", type: "merchant", icon: "🛍️" },
  { id: "amazon-sg", name: "Amazon Singapore", type: "merchant", icon: "📦" },
  { id: "amazon-us", name: "Amazon US", type: "merchant", icon: "🇺🇸" },
  { id: "bestbuy-us", name: "Best Buy US", type: "merchant", icon: "💻" },
  // Flights
  { id: "google-flights", name: "Google Flights", type: "airline", icon: "✈️" },
  { id: "singapore-air", name: "Singapore Airlines", type: "airline", icon: "🇸🇬" },
  { id: "emirates", name: "Emirates", type: "airline", icon: "🇦🇪" },
  // Hotels
  { id: "booking-com", name: "Booking.com", type: "booking", icon: "🏨" },
  { id: "agoda", name: "Agoda", type: "booking", icon: "🏠" },
  { id: "expedia", name: "Expedia", type: "booking", icon: "🌐" },
  // Events
  { id: "ticketmaster", name: "Ticketmaster", type: "exchange", icon: "🎫" },
  { id: "viator", name: "Viator", type: "exchange", icon: "🎟️" },
  // Finance
  { id: "google-finance", name: "Google Finance", type: "exchange", icon: "📈" },
];

export const PRODUCT_CATEGORIES = [
  "electronics",
  "flights",
  "hotels",
  "events",
  "finance",
];
