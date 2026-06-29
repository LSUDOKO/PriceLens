#!/usr/bin/env node
/**
 * Standalone MCP Server Entry Point
 * 
 * Run with: npm run mcp
 * Or: npx tsx src/mcp-run.ts
 * 
 * This starts the PriceLens MCP server on stdio for use with Claude Desktop,
 * Cursor, Cline, or any MCP-compatible client.
 * 
 * Environment variables:
 *   AWS_ACCESS_KEY_ID       (optional) — AWS access key for DynamoDB persistence
 *   AWS_SECRET_ACCESS_KEY   (optional) — AWS secret key
 *   AWS_REGION              (optional) — AWS region, default: us-east-1
 *   DYNAMODB_PRODUCTS_TABLE (optional) — Products table name
 *   DYNAMODB_PRICES_TABLE   (optional) — Prices table name
 *   DYNAMODB_ALERTS_TABLE   (optional) — Alerts table name
 * 
 * Without AWS credentials, PriceLens runs with an in-memory store
 * and auto-seeds pricing data on startup. Everything works out of the box.
 */

import { startMcpServer } from "./lib/mcp-server";
import { seedInitialData, getStoreType } from "./lib/db-adapter";

async function main() {
  const hasAwsCreds = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

  if (!hasAwsCreds) {
    console.error("⚠️  AWS credentials not configured. Using in-memory store (data resets on restart).");
    console.error("   Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to use DynamoDB.");
  }

  // Auto-seed pricing data on startup
  console.error("📦 Auto-seeding product data...");
  try {
    const result = await seedInitialData();
    const store = getStoreType();
    if (result.skipped) {
      console.error(`   Using existing data (${result.products} products, ${result.prices} prices) from ${store} store.`);
    } else {
      console.error(`   Seeded ${result.products} products and ${result.prices} prices into ${store} store.`);
    }
  } catch (err) {
    console.error(`   ⚠️  Seed warning: ${(err as Error).message}`);
  }

  console.error("");
  console.error("🚀 PriceLens MCP Server starting...");
  console.error(`   Store: ${getStoreType()}`);
  console.error(`   AWS Region: ${process.env.AWS_REGION || "us-east-1"}`);
  console.error("");
  console.error("📋 Available tools:");
  console.error("   • search_prices        — Search products and compare prices across sources");
  console.error("   • compare_sources      — Compare a product's price across all sources/merchants");
  console.error("   • find_best_price      — Find the cheapest source for any product");
  console.error("   • list_categories      — Browse product categories");
  console.error("   • list_products_by_category — List products in a category");
  console.error("   • set_price_alert      — Create a price drop alert");
  console.error("   • list_alerts          — View your active alerts");
  console.error("   • delete_alert         — Delete a price alert");
  console.error("   • get_source_overview  — Full pricing summary for a source/merchant");
  console.error("");

  try {
    await startMcpServer();
  } catch (err) {
    console.error(`Fatal: ${err}`);
    process.exit(1);
  }
}

main();
