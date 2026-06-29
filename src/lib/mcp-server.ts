import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { v4 as uuidv4 } from "uuid";
import {
  getProduct,
  getAllProducts,
  getProductsByCategory,
  getPrices,
  getAlertsByUser,
  putAlert,
  deleteAlert,
  getPricesBySource,
} from "./db-adapter";
import { PRICE_SOURCES, PRODUCT_CATEGORIES } from "./types";

const MCP_SERVER_NAME = "io.pricelens/pricelens-mcp";
const MCP_SERVER_VERSION = "0.1.0";

const server = new Server(
  { name: "pricelens-mcp", version: MCP_SERVER_VERSION },
  { capabilities: { tools: {}, resources: {} } }
);

// ─── Tool definitions ─────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_prices",
      description:
        "Search for products and compare prices across multiple sources (Shopee, Lazada, Amazon, airlines, booking sites, etc.). " +
        "Returns matching products with pricing from each source. " +
        "Filter by category (electronics, flights, hotels, events) or search by keyword.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search keyword (product name, brand, or tag)" },
          category: {
            type: "string",
            enum: PRODUCT_CATEGORIES,
            description: "Filter by product category",
          },
          sources: {
            type: "array",
            items: { type: "string" },
            description: "Sources to include (e.g., shopee-sg, amazon-us, google-flights). Default: all",
          },
          sort_by: {
            type: "string",
            enum: ["price_asc", "price_desc", "name"],
            description: "Sort order for results",
            default: "name",
          },
        },
      },
    },
    {
      name: "compare_sources",
      description:
        "Compare pricing for a specific product across multiple sources/merchants. " +
        "Returns prices sorted from cheapest to most expensive, with savings percentage.",
      inputSchema: {
        type: "object",
        properties: {
          sku: { type: "string", description: "Product SKU (e.g., macbook-pro-m4, flight-sin-lhr)" },
          sources: {
            type: "array",
            items: { type: "string" },
            description: "Sources to compare. Default: all sources",
          },
        },
        required: ["sku"],
      },
    },
    {
      name: "find_best_price",
      description:
        "Find the cheapest source/merchant for a given product SKU. " +
        "Returns the source with the lowest price and the savings compared to the most expensive source.",
      inputSchema: {
        type: "object",
        properties: {
          sku: { type: "string", description: "Product SKU (e.g., macbook-pro-m4, hotel-marina-bay-sands)" },
        },
        required: ["sku"],
      },
    },
    {
      name: "list_categories",
      description:
        "List all product categories available in PriceLens. " +
        "Returns category names with product counts.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "list_products_by_category",
      description:
        "List all products within a specific category. " +
        "Returns product names, SKUs, and specifications.",
      inputSchema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: PRODUCT_CATEGORIES,
            description: "Product category to browse",
          },
        },
        required: ["category"],
      },
    },
    {
      name: "set_price_alert",
      description:
        "Set a price alert for a specific product and target price. " +
        "When the price drops below the target, the alert triggers. " +
        "Optionally specify a source, or * for all sources.",
      inputSchema: {
        type: "object",
        properties: {
          sku: { type: "string", description: "Product SKU to watch" },
          target_price: { type: "number", description: "Alert when price drops below this value" },
          source: {
            type: "string",
            description: "Specific source to watch, or '*' for all sources",
            default: "*",
          },
          user_id: { type: "string", description: "Your user/team identifier", default: "default-user" },
        },
        required: ["sku", "target_price"],
      },
    },
    {
      name: "list_alerts",
      description: "List all active price alerts for a user.",
      inputSchema: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "User identifier", default: "default-user" },
        },
      },
    },
    {
      name: "delete_alert",
      description: "Delete a price alert by its ID.",
      inputSchema: {
        type: "object",
        properties: {
          alert_id: { type: "string", description: "Alert ID to delete" },
          user_id: { type: "string", description: "User identifier", default: "default-user" },
        },
        required: ["alert_id"],
      },
    },
    {
      name: "get_source_overview",
      description:
        "Get an overview of pricing for all tracked products from a specific source/merchant. " +
        "Returns a summary with average prices and product counts.",
      inputSchema: {
        type: "object",
        properties: {
          source: {
            type: "string",
            enum: PRICE_SOURCES.map(s => s.id),
            description: "Source/merchant ID (e.g., shopee-sg, amazon-us, google-flights)",
          },
        },
        required: ["source"],
      },
    },
  ],
}));

// ─── Tool implementations ─────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      case "search_prices": return handleSearchPrices(args);
      case "compare_sources": return handleCompareSources(args);
      case "find_best_price": return handleFindBestPrice(args);
      case "list_categories": return handleListCategories();
      case "list_products_by_category": return handleListProductsByCategory(args);
      case "set_price_alert": return handleSetPriceAlert(args);
      case "list_alerts": return handleListAlerts(args);
      case "delete_alert": return handleDeleteAlert(args);
      case "get_source_overview": return handleGetSourceOverview(args);
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (err) {
    if (err instanceof McpError) throw err;
    return {
      content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
      isError: true,
    };
  }
});

// ─── Tool Handlers ─────────────────────────────────────────

async function handleSearchPrices(args: Record<string, unknown>) {
  const query = args.query as string | undefined;
  const category = args.category as string | undefined;
  const sources = args.sources as string[] | undefined;
  const sortBy = (args.sort_by as string) || "name";

  let products = category ? await getProductsByCategory(category) : await getAllProducts();

  if (query) {
    const q = query.toLowerCase();
    products = products.filter((p: Record<string, unknown>) =>
      (p.name as string)?.toLowerCase().includes(q) ||
      (p.sku as string)?.toLowerCase().includes(q) ||
      (p.tags as string[])?.some((t: string) => t.toLowerCase().includes(q))
    );
  }

  if (products.length === 0) {
    return { content: [{ type: "text", text: "No products found matching your criteria." }] };
  }

  const lines: string[] = [`Found ${products.length} product(s):\n`];

  for (const product of products as Record<string, unknown>[]) {
    const prices = await getPrices(product.sku as string);
    const filteredPrices = sources
      ? prices.filter((p: Record<string, unknown>) => sources.includes(p.source as string))
      : prices;

    const specs = product.baseSpecs as Record<string, string> || {};

    lines.push(`**${product.name}** (\`${product.sku}\`)`);
    lines.push(`  Category: ${product.category}`);

    if (Object.keys(specs).length > 0) {
      lines.push(`  Specs: ${Object.entries(specs).map(([k, v]) => `${k}: ${v}`).join(", ")}`);
    }

    if (filteredPrices.length > 0) {
      const sorted = [...filteredPrices] as Record<string, unknown>[];
      if (sortBy === "price_asc") sorted.sort((a, b) => (a.pricePerUnit as number) - (b.pricePerUnit as number));
      else if (sortBy === "price_desc") sorted.sort((a, b) => (b.pricePerUnit as number) - (a.pricePerUnit as number));

      lines.push(`  Prices:`);
      for (const p of sorted) {
        const sourceInfo = PRICE_SOURCES.find(s => s.id === p.source);
        const icon = sourceInfo?.icon || "";
        lines.push(`    ${icon} ${p.source}: $${(p.pricePerUnit as number).toFixed(2)} ${p.currency}`);
      }
    } else {
      lines.push(`  Pricing: No data available`);
    }
    lines.push("");
  }

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

async function handleCompareSources(args: Record<string, unknown>) {
  const sku = args.sku as string;
  const sources = args.sources as string[] | undefined;

  const product = await getProduct(sku);
  if (!product) {
    return { content: [{ type: "text", text: `Product not found: ${sku}` }], isError: true };
  }

  let prices = await getPrices(sku);
  if (sources) {
    prices = prices.filter((p: Record<string, unknown>) => sources.includes(p.source as string));
  }

  if (prices.length === 0) {
    return { content: [{ type: "text", text: `No pricing data found for ${sku}.` }] };
  }

  const sorted = [...prices] as Record<string, unknown>[];
  sorted.sort((a, b) => (a.pricePerUnit as number) - (b.pricePerUnit as number));

  const cheapest = sorted[0];
  const mostExpensive = sorted[sorted.length - 1];
  const savings = ((mostExpensive.pricePerUnit as number) - (cheapest.pricePerUnit as number));
  const savingsPercent = ((savings / (mostExpensive.pricePerUnit as number)) * 100).toFixed(1);

  const lines: string[] = [
    `**Price Comparison: ${product.name} (\`${sku}\`)**`,
    `Unit: ${(sorted[0] as Record<string, unknown>).unit}`,
    `\n**Cheapest:** ${cheapest.source} — **$${(cheapest.pricePerUnit as number).toFixed(2)} ${cheapest.currency}**`,
    `**Most Expensive:** ${mostExpensive.source} — **$${(mostExpensive.pricePerUnit as number).toFixed(2)} ${mostExpensive.currency}**`,
    `**Potential Savings:** $${savings.toFixed(2)} (${savingsPercent}%)\n`,
    `**All Sources (sorted cheapest → most expensive):**`,
  ];

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i] as Record<string, unknown>;
    const sourceInfo = PRICE_SOURCES.find(s => s.id === p.source);
    const icon = sourceInfo?.icon || "";
    lines.push(`  ${i + 1}. ${icon} ${p.source}: $${(p.pricePerUnit as number).toFixed(2)} ${p.currency}`);
  }

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

async function handleFindBestPrice(args: Record<string, unknown>) {
  const sku = args.sku as string;

  const product = await getProduct(sku);
  if (!product) {
    return { content: [{ type: "text", text: `Product not found: ${sku}` }], isError: true };
  }

  const prices = await getPrices(sku);
  if (prices.length === 0) {
    return { content: [{ type: "text", text: `No pricing data found for ${sku}.` }] };
  }

  const sorted = [...prices] as Record<string, unknown>[];
  sorted.sort((a, b) => (a.pricePerUnit as number) - (b.pricePerUnit as number));

  const cheapest = sorted[0];
  const mostExpensive = sorted[sorted.length - 1];
  const savingsPercent = ((mostExpensive.pricePerUnit as number) - (cheapest.pricePerUnit as number)) /
    (mostExpensive.pricePerUnit as number) * 100;

  const cheapestIcon = PRICE_SOURCES.find(s => s.id === cheapest.source)?.icon || "";
  const expensiveIcon = PRICE_SOURCES.find(s => s.id === mostExpensive.source)?.icon || "";

  return {
    content: [{
      type: "text",
      text: [
        `**Best Price for ${product.name} (\`${sku}\`)**`,
        ``,
        `🏆 **${cheapestIcon} ${cheapest.source}: $${(cheapest.pricePerUnit as number).toFixed(2)} ${cheapest.currency}**`,
        ``,
        `💡 Switching from ${expensiveIcon} ${mostExpensive.source} to ${cheapestIcon} ${cheapest.source} saves **${savingsPercent.toFixed(1)}%**`,
        `   ($${(mostExpensive.pricePerUnit as number).toFixed(2)} → $${(cheapest.pricePerUnit as number).toFixed(2)})`,
        ``,
        `**Top 3 Cheapest Sources:**`,
        ...(sorted.slice(0, 3).map((p, i) => {
          const icon = PRICE_SOURCES.find(s => s.id === (p as Record<string, unknown>).source)?.icon || "";
          return `  ${i + 1}. ${icon} ${(p as Record<string, unknown>).source}: $${((p as Record<string, unknown>).pricePerUnit as number).toFixed(2)} ${(p as Record<string, unknown>).currency}`;
        })),
      ].join("\n"),
    }],
  };
}

async function handleListCategories() {
  const allProducts = await getAllProducts() as Record<string, unknown>[];
  const counts: Record<string, number> = {};
  for (const p of allProducts) {
    const cat = p.category as string;
    counts[cat] = (counts[cat] || 0) + 1;
  }

  const lines: string[] = ["**Available Categories:**\n"];
  for (const cat of PRODUCT_CATEGORIES) {
    const count = counts[cat] || 0;
    lines.push(`  • **${cat}** — ${count} product(s)`);
  }

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

async function handleListProductsByCategory(args: Record<string, unknown>) {
  const category = args.category as string;
  const products = await getProductsByCategory(category) as Record<string, unknown>[];

  if (products.length === 0) {
    return { content: [{ type: "text", text: `No products found in category: ${category}` }] };
  }

  const lines: string[] = [`**Products in category: ${category}**\n`];
  for (const p of products) {
    const specs = p.baseSpecs as Record<string, string> || {};
    const specStr = Object.entries(specs).map(([k, v]) => `${k}: ${v}`).join(", ");
    lines.push(`  • **${p.name}** (\`${p.sku}\`) — ${specStr}`);
  }

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

async function handleSetPriceAlert(args: Record<string, unknown>) {
  const sku = args.sku as string;
  const targetPrice = args.target_price as number;
  const source = (args.source as string) || "*";
  const userId = (args.user_id as string) || "default-user";

  const product = await getProduct(sku);
  if (!product) {
    return { content: [{ type: "text", text: `Product not found: ${sku}` }], isError: true };
  }

  const alertId = uuidv4();
  await putAlert({
    userId,
    alertId,
    sku,
    targetSource: source,
    targetPrice,
    createdAt: Date.now(),
  });

  const sourceText = source === "*" ? "all sources" : source;

  return {
    content: [{
      type: "text",
      text: [
        `✅ **Price Alert Created!**`,
        ``,
        `  Product: ${product.name} (\`${sku}\`)`,
        `  Target: $${targetPrice.toFixed(2)} or below`,
        `  Source: ${sourceText}`,
        `  Alert ID: \`${alertId}\``,
        ``,
        `You'll be notified when the price drops to or below your target.`,
      ].join("\n"),
    }],
  };
}

async function handleListAlerts(args: Record<string, unknown>) {
  const userId = (args.user_id as string) || "default-user";
  const alerts = await getAlertsByUser(userId) as Record<string, unknown>[];

  if (alerts.length === 0) {
    return { content: [{ type: "text", text: "No active price alerts. Use `set_price_alert` to create one." }] };
  }

  const lines: string[] = [`**Active Price Alerts (${alerts.length}):**\n`];
  for (const alert of alerts) {
    const sourceText = alert.targetSource === "*" ? "All sources" : alert.targetSource;
    const product = await getProduct(alert.sku as string);
    const productName = product?.name || alert.sku;
    lines.push(
      `  • **${productName}** — Notify when $${(alert.targetPrice as number).toFixed(2)} or below`,
      `    Source: ${sourceText} | ID: \`${alert.alertId}\``,
      `    Created: ${new Date(alert.createdAt as number).toLocaleDateString()}`,
      ""
    );
  }

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

async function handleDeleteAlert(args: Record<string, unknown>) {
  const alertId = args.alert_id as string;
  const userId = (args.user_id as string) || "default-user";

  await deleteAlert(userId, alertId);

  return {
    content: [{ type: "text", text: `✅ Alert \`${alertId}\` deleted successfully.` }],
  };
}

async function handleGetSourceOverview(args: Record<string, unknown>) {
  const source = args.source as string;
  const prices = await getPricesBySource(source) as Record<string, unknown>[];

  if (prices.length === 0) {
    return { content: [{ type: "text", text: `No pricing data found for source: ${source}` }] };
  }

  const sourceInfo = PRICE_SOURCES.find(s => s.id === source);
  const icon = sourceInfo?.icon || "";
  const avgPrice = prices.reduce((sum, p) => sum + (p.pricePerUnit as number), 0) / prices.length;
  const minPrice = Math.min(...prices.map(p => p.pricePerUnit as number));
  const maxPrice = Math.max(...prices.map(p => p.pricePerUnit as number));

  const lines: string[] = [
    `**${icon} Source Overview: ${source}**`,
    `  Products tracked: ${prices.length}`,
    `  Average price: $${avgPrice.toFixed(2)}`,
    `  Price range: $${minPrice.toFixed(2)} — $${maxPrice.toFixed(2)}`,
    `\n**Products & Prices:**`,
  ];

  // Group by category
  const byCategory: Record<string, Record<string, unknown>[]> = {};
  const productCache: Record<string, Record<string, unknown> | undefined> = {};
  for (const p of prices) {
    const sku = p.sku as string;
    if (!productCache[sku]) productCache[sku] = await getProduct(sku);
    const product = productCache[sku];
    const cat = (product?.category as string) || "other";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push({ ...p, category: cat });
  }

  for (const [cat, items] of Object.entries(byCategory)) {
    lines.push(`\n  ${cat}:`);
    for (const item of items) {
      const product = await getProduct(item.sku as string);
      lines.push(`    • ${product?.name || item.sku}: $${(item.pricePerUnit as number).toFixed(2)} ${item.currency}/${item.unit}`);
    }
  }

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

// ─── Resources ─────────────────────────────────────────────

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: "pricelens://sources",
      name: "Supported Price Sources",
      description: "List all merchants, airlines, and booking sites tracked by PriceLens",
      mimeType: "application/json",
    },
    {
      uri: "pricelens://categories",
      name: "Product Categories",
      description: "Available product categories with product counts",
      mimeType: "application/json",
    },
    {
      uri: "pricelens://products/electronics",
      name: "Electronics Products",
      description: "All electronics products",
      mimeType: "application/json",
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (uri === "pricelens://sources") {
    return {
      contents: [{
        uri,
        mimeType: "application/json",
        text: JSON.stringify(PRICE_SOURCES, null, 2),
      }],
    };
  }

  if (uri === "pricelens://categories") {
    const allProducts = await getAllProducts() as Record<string, unknown>[];
    const counts: Record<string, number> = {};
    for (const p of allProducts) {
      const cat = p.category as string;
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return {
      contents: [{
        uri,
        mimeType: "application/json",
        text: JSON.stringify({ categories: PRODUCT_CATEGORIES, productCounts: counts }, null, 2),
      }],
    };
  }

  const productsMatch = uri.match(/^pricelens:\/\/products\/(.+)$/);
  if (productsMatch) {
    const category = productsMatch[1];
    const products = await getProductsByCategory(category);
    return {
      contents: [{
        uri,
        mimeType: "application/json",
        text: JSON.stringify({ category, products }, null, 2),
      }],
    };
  }

  throw new McpError(ErrorCode.InvalidRequest, `Unknown resource URI: ${uri}`);
});

// ─── Main entry ────────────────────────────────────────────

export async function startMcpServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("PriceLens MCP server running on stdio");
}

export { server };
