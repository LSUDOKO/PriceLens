## 🧪 Testing Instructions for Judges

> **Note:** PriceLens is designed to work **fully without any AWS account** using its in-memory store fallback. Judges can test 100% of the functionality in under 5 minutes with zero setup.

---

### 🚀 Quick Test (No AWS Required — 5 Minutes)

#### Prerequisites
- Node.js 18+ and npm installed
- Terminal access

#### Step 1: Clone & Install

```bash
git clone https://github.com/LSUDOKO/PriceLens
cd PriceLens
npm install
```

#### Step 2: Start the Server

```bash
npm run dev
```

> The app automatically uses **in-memory store** (no AWS needed). You'll see:
> ```
> ⚠️  AWS credentials not configured. Using in-memory store.
> 📦 Auto-seeding product data...
>    Seeded 14 products and 47 prices into memory store.
> ```

#### Step 3: Open the Web Dashboard

Open **http://localhost:3000** in your browser.

**Test these features:**
- [ ] **Price Explorer** (`/`) — Search "MacBook", filter by category, expand products to see source prices
- [ ] **Source Comparison** (`/heatmap`) — Color-coded view of merchants, sorted cheapest → most expensive
- [ ] **Price Alerts** (`/alerts`) — Create an alert, see it in the list, delete it

#### Step 4: Test API Routes (Optional — via terminal)

```bash
# Health check
curl http://localhost:3000/api/health

# Seed data
curl -X POST http://localhost:3000/api/seed

# List all products and prices
curl http://localhost:3000/api/prices?type=all

# Query a specific product
curl "http://localhost:3000/api/prices?sku=macbook-pro-m4"

# Create a price alert
curl -X POST http://localhost:3000/api/alerts \
  -H "Content-Type: application/json" \
  -d '{"sku":"macbook-pro-m4","targetPrice":2500,"region":"*"}'

# List alerts
curl "http://localhost:3000/api/alerts?userId=default-user"

# Delete an alert
curl -X DELETE http://localhost:3000/api/alerts \
  -H "Content-Type: application/json" \
  -d '{"alertId":"<alert-id-from-list>"}'
```

---

### 🤖 MCP Server Test (Claude Desktop)

#### Step 1: Start the MCP Server

```bash
npm run mcp
```

You'll see:
```
⚠️  AWS credentials not configured. Using in-memory store.
📦 Auto-seeding product data...
   Seeded 14 products and 47 prices into memory store.
🚀 PriceLens MCP Server starting...
   Store: memory
📋 Available tools:
   • search_prices         — Search products and compare prices
   • compare_sources       — Compare a product across sources
   • find_best_price       — Find the cheapest source
   • list_categories       — Browse product categories
   • list_products_by_category — List products in a category
   • set_price_alert       — Create a price drop alert
   • list_alerts           — View active alerts
   • delete_alert          — Delete a price alert
   • get_source_overview   — Pricing summary for a source
```

#### Step 2: Configure Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pricelens": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/PriceLens/src/mcp-run.ts"]
    }
  }
}
```

#### Step 3: Test MCP Tools in Claude

Try these prompts:

| Prompt | What It Tests |
|---|---|
| "What products do you have in electronics?" | `list_products_by_category` |
| "Find me the best price for the Sony WH-1000XM6" | `find_best_price` |
| "Compare MacBook Pro prices across all sources" | `compare_sources` |
| "Show me an overview of Shopee pricing" | `get_source_overview` |
| "Set an alert for iPhone 16 Pro if it drops below SGD 1500" | `set_price_alert` |
| "Show my active alerts" | `list_alerts` |
| "Delete the iPhone alert" | `delete_alert` |

> **Expected behavior:** Claude calls the MCP tool, gets structured pricing data back, and presents it in a readable format with savings calculations.

---

### ✅ Full Test Checklist

#### Web Dashboard Tests

| Test | Expected Result | Status |
|---|---|---|
| Open `/` (Price Explorer) | Shows 14 products with stats cards | ⬜ |
| Search "MacBook" | Filters to show only MacBook Pro | ⬜ |
| Filter by "flights" category | Shows 3 flight products | ⬜ |
| Expand a product | Shows all source prices sorted cheapest-first | ⬜ |
| Open `/heatmap` (Source Comparison) | 14 sources color-coded by price tier | ⬜ |
| Hover/click a source card | Shows product count and cheapest deals badge | ⬜ |
| Open `/alerts` (Alerts) | Shows empty state or active alerts | ⬜ |
| Click "New Alert", search product | Autocomplete shows matching products | ⬜ |
| Create an alert | Alert appears in the list | ⬜ |
| Delete an alert | Alert removed from list | ⬜ |
| Resize browser window | Layout is responsive (mobile-friendly) | ⬜ |

#### API Tests

| Test | Expected Status Code | Status |
|---|---|---|
| `GET /api/health` | 200 — returns `store`, `products`, `prices` | ⬜ |
| `POST /api/seed` | 200 — returns `seeded.products: 14` | ⬜ |
| `GET /api/prices?type=all` | 200 — returns 14 grouped products | ⬜ |
| `GET /api/prices?sku=macbook-pro-m4` | 200 — returns product + prices | ⬜ |
| `POST /api/alerts` (valid) | 200 — returns `success: true` | ⬜ |
| `POST /api/alerts` (negative price) | 400 — `"targetPrice must be a positive number"` | ⬜ |
| `GET /api/alerts` | 200 — returns alerts array | ⬜ |
| `DELETE /api/alerts` (valid alertId) | 200 — returns `success: true` | ⬜ |

#### MCP Server Tests

| Test | Expected Result | Status |
|---|---|---|
| Server starts on stdio | Shows tool list, no errors | ⬜ |
| `search_prices` tool | Returns matching products with prices | ⬜ |
| `compare_sources` tool | Shows sorted price comparison with savings % | ⬜ |
| `find_best_price` tool | Returns cheapest source with $ amount | ⬜ |
| `list_categories` tool | Shows category list with product counts | ⬜ |
| `set_price_alert` tool | Creates alert, returns alert ID | ⬜ |
| `get_source_overview` tool | Shows products and prices for a source | ⬜ |

#### DynamoDB Tests (Optional — if AWS configured)

| Test | Expected Result | Status |
|---|---|---|
| Set AWS credentials in `.env.local` | App switches to `dynamodb` store | ⬜ |
| `GET /api/health` | `"store": "dynamodb"` | ⬜ |
| `POST /api/seed` | Seeds 14 products into DynamoDB | ⬜ |
| Restart server, check data persists | Products still present | ⬜ |
| AWS Console → DynamoDB → Tables | 3 tables with Active status + On-Demand | ⬜ |

---

### 🏗️ Architecture Verification

Open **http://localhost:3000/architecture.html** to view the interactive architecture diagram showing:
- **Client Layer** — Claude Desktop, Web Browser, Cursor/Cline
- **MCP Server Layer** — 9 tools + 3 resources via JSON-RPC 2.0 over stdio
- **API Layer** — Next.js 16.2 REST endpoints on Vercel
- **Database Adapter** — Auto-detects DynamoDB, falls back to in-memory
- **Data Layer** — Amazon DynamoDB (3 tables with GSIs) or in-memory store
- **Schema** — Products (sku PK, category GSI), Prices (sku+source PK/SK, source GSI), Alerts (userId+alertId PK/SK)

---

### 💡 What Makes This Impressive

1. **Zero-setup demo** — Works immediately without any AWS account, API keys, or database provisioning
2. **Three interfaces** — Same data accessible via AI (MCP), browser (Next.js), or terminal (REST API)
3. **Seamless DynamoDB upgrade** — Add AWS credentials → automatically upgrades from in-memory to persistent storage without code changes
4. **Realistic demo data** — 14 real products with actual source pricing showing 18–35% savings
5. **Production-ready architecture** — Full TypeScript, error handling, input validation, CloudFormation template, Vercel config
