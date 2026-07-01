# PriceLens — Multi-Product Price Comparison Platform

> **H0 Hackathon Submission** — Track 2: Monetizable B2B App  
> **AWS Database:** Amazon DynamoDB (On-Demand Capacity Mode)  
> **Frontend:** Next.js 16.2 on Vercel  
> **Stack:** DynamoDB + MCP (Model Context Protocol) + Next.js + TypeScript

---

## 🏆 What It Does

PriceLens is a **universal price comparison platform** that helps consumers and businesses find the best prices across multiple merchants, airlines, booking sites, and event platforms. Instead of manually checking 5+ websites, you ask PriceLens in plain English and get the best deal instantly.

**The Problem:** Prices vary wildly across sources — the same MacBook Pro costs SGD 2,799 on Amazon Singapore vs SGD 2,949 on Lazada. A flight from Singapore to London ranges from SGD 980 (Google Flights) to SGD 1,250 (Singapore Airlines). Finding the best deal means checking 5-10 websites manually.

**The Solution:** PriceLens aggregates prices across **14 sources** across **5 categories** and gives you:

- **Cross-source price comparisons** — instantly see who has the best price
- **Smart deal finding** — find the cheapest source for any product
- **Automated price alerts** — get notified when prices drop to your target
- **MCP-native integration** — query pricing directly from Claude, Cursor, or Cline

### Product Categories

| Category | What We Track | Example Sources |
|---|---|---|
| 📱 **Electronics** | Laptops, phones, headphones | Shopee SG, Lazada SG, Amazon SG, Amazon US, Best Buy US |
| ✈️ **Flights** | Round-trip airfare | Google Flights, Singapore Airlines, Emirates |
| 🏨 **Hotels** | Per-night room rates | Booking.com, Agoda, Expedia |
| 🎫 **Events** | Concert/sports/theme park tickets | Ticketmaster, Viator |

---

## 🛢️ AWS Database: Amazon DynamoDB

### Why DynamoDB?

| Requirement | DynamoDB ✅ |
|---|---|
| **Multi-source data** | Flexible schema for different product types |
| **Fast lookups by SKU** | Direct GetItem by partition key |
| **Query by source/merchant** | GSI on source field for merchant overviews |
| **Serverless pay-per-use** | On-Demand capacity — zero provisioning |
| **GSI/LSI flexibility** | Query by category, source, or price |

### Data Model (3 Tables)

```
Products (sku: HASH)
├── name, category, tags, baseSpecs
├── GSI: category-index (category: HASH)
└── 14 products × 5 categories

Prices (sku: HASH, source: RANGE)
├── pricePerUnit, unit, currency, timestamp, sourceType
├── GSI: source-index (source: HASH)
└── 60+ price records across 14 sources

Alerts (userId: HASH, alertId: RANGE)
├── sku, targetSource, targetPrice, createdAt
└── User-specific price drop notifications
```

### Provisioning

```bash
# Option 1: AWS CLI script (quick)
chmod +x scripts/provision-dynamodb.sh
./scripts/provision-dynamodb.sh

# Option 2: CloudFormation (infra as code)
aws cloudformation deploy \
  --template-file infra/dynamodb-template.yaml \
  --stack-name pricelens-dynamodb \
  --capabilities CAPABILITY_IAM
```

---

## 🧠 MCP Server (9 Tools)

PriceLens implements the **Model Context Protocol** — the industry standard for AI-tool integration.

Connect any MCP-compatible client (Claude Desktop, Cursor, Cline) and get:

| Tool | What It Does |
|---|---|
| `search_prices` | Search products by keyword/category across all sources |
| `compare_sources` | Full price comparison across merchants/airlines/sites |
| `find_best_price` | Find the cheapest source with savings percentage |
| `list_categories` | Browse product categories with counts |
| `list_products_by_category` | Products with specs in a category |
| `set_price_alert` | Create automated price drop alerts |
| `list_alerts` | View active alerts for any user |
| `delete_alert` | Remove a price alert |
| `get_source_overview` | Complete pricing summary per merchant/airline |

### Claude Desktop Configuration

```json
{
  "mcpServers": {
    "pricelens": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/pricelens/src/mcp-run.ts"],
      "env": {
        "AWS_ACCESS_KEY_ID": "your-key",
        "AWS_SECRET_ACCESS_KEY": "your-secret"
      }
    }
  }
}
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm 9+
- AWS account (optional — works with in-memory store without any setup)

### 1. Clone & Install

```bash
git clone https://github.com/LSUDOKO/PriceLens
cd PriceLens
npm install
```

### 2. Configure (Optional — skip for in-memory mode)

```bash
cp .env.example .env.local
# Edit .env.local with your AWS credentials (or skip — works without!)
```

### 3. Seed Pricing Data

```bash
# Seeds 14 products across 14 sources
curl -X POST http://localhost:3456/api/seed

# Or force re-seed:
curl -X POST "http://localhost:3456/api/seed?force=true"
```

### 4. Start

```bash
# Start the web dashboard
npm run dev
# → http://localhost:3456

# Or start the MCP server (for Claude Desktop, Cursor, etc.)
npm run mcp
```

---

## 🖥️ Frontend Pages

### Price Explorer (`/`)
Search, filter, and sort products across 5 categories. See price ranges across sources, savings percentages, and the best deal for each product. Expand any product to see all source prices sorted cheapest-first with merchant icons.

### Source Comparison (`/heatmap`)
Visual overview of all 14 sources color-coded by average price. See which merchants are cheapest (green) vs most expensive (red). Sources are tagged by type — merchant, airline, booking, or exchange. Summary cards show the cheapest source, most expensive, and price spread.

### Price Alerts (`/alerts`)
Full CRUD interface for price alerts. Search products with autocomplete, set target prices, choose specific sources or track all. Alerts persist in memory (or DynamoDB) and are accessible via the MCP server.

---

## 🔌 API Routes

| Route | Method | Description |
|---|---|---|
| `/api/seed` | GET/POST | Seed pricing data into the store |
| `/api/health` | GET | Health check + store type + data counts |
| `/api/prices` | GET | Query products/prices by SKU, source, category |
| `/api/alerts` | GET/POST/DELETE | Full CRUD for price alerts |

---

## 🏗️ Architecture

> View the [interactive architecture diagram](/architecture.html) for a visual representation of the full stack.

```
┌─────────────────────────────────────────────────────┐
│                   Claude Desktop                     │
│              (or any MCP Client)                     │
└──────────────────────┬──────────────────────────────┘
                       │ stdio (JSON-RPC)
                       ▼
┌─────────────────────────────────────────────────────┐
│                 PriceLens MCP Server                  │
│               ┌─────────────────────────┐            │
│               │  9 Tools + 3 Resources  │            │
│               └──────────┬──────────────┘            │
└──────────────────────────┼───────────────────────────┘
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
┌────────────────┐ ┌──────────┐ ┌──────────────┐
│  Next.js API   │ │Memory    │ │  DynamoDB     │
│  Routes        │ │Store     │ │  (Optional)   │
│  (Vercel)      │ │(Dev)     │ │               │
└────────────────┘ └──────────┘ └──────────────┘
```

### Key Design Decisions

1. **Database Adapter Pattern:** `db-adapter.ts` auto-detects AWS credentials. With DynamoDB → persistent storage. Without it → in-memory store (zero setup, works immediately).

2. **In-Memory Fallback:** The app runs fully without any AWS account. All 14 products × 14 sources are pre-loaded. Perfect for demos, development, and judging.

3. **MCP First:** The MCP server is the primary interface. The web UI is built on top of the same `db-adapter` layer. Every feature accessible via API is also available as an MCP tool.

4. **Seed on Startup:** The MCP server auto-seeds data on startup. The web UI seeds via `GET /api/seed`. No manual setup needed.

---

## 📹 Demo Video Plan

1. **Problem (30s):** Show how prices for the same product vary across sources — e.g., MacBook Pro M4 costs more on Lazada than Amazon
2. **Solution (60s):** Walk through Price Explorer, Source Comparison heatmap, and ask Claude "What's the cheapest source for a MacBook Pro?"
3. **Technical (60s):** Show DynamoDB schema (3 tables), MCP server code, and the db-adapter pattern that switches seamlessly between in-memory and DynamoDB
4. **Impact (30s):** Show real savings — e.g., buying a Sony WH-1000XM6 from Best Buy US (USD 329) vs Shopee SG (SGD 399) saves ~20%

---

## 🔧 Deploy to Production

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables
vercel env add AWS_ACCESS_KEY_ID
vercel env add AWS_SECRET_ACCESS_KEY
vercel env add AWS_REGION us-east-1
```

### AWS DynamoDB (Production)

```bash
# Provision tables
./scripts/provision-dynamodb.sh

# Verify
aws dynamodb list-tables --region us-east-1
# → pricelens-products, pricelens-prices, pricelens-alerts
```

---

## 📊 Demo Data

| Product | Best Source | Price | Most Expensive Source | Price | Savings |
|---|---|---|---|---|---|
| MacBook Pro M4 | Amazon US | USD 1,999 | Lazada SG | SGD 2,949 | **~32%** |
| iPhone 16 Pro | Best Buy US | USD 1,099 | Shopee SG | SGD 1,699 | **~35%** |
| Sony WH-1000XM6 | Best Buy US | USD 329 | Shopee SG | SGD 399 | **~18%** |
| Singapore → London | Google Flights | SGD 980 | Singapore Airlines | SGD 1,250 | **~22%** |
| Marina Bay Sands | Agoda | SGD 520/night | Booking.com | SGD 550/night | **~5%** |
| Coldplay SG Concert | Ticketmaster | SGD 168 | Viator | SGD 198 | **~15%** |

---

## 📝 License

MIT

---

## 🙏 Acknowledgments

- Built for the **H0 Hackathon** (AWS Databases × Vercel v0)
- Uses **Amazon DynamoDB** for persistent storage
- Uses **Next.js 16.2** + **Vercel** for frontend deployment
- Uses **@modelcontextprotocol/sdk** for MCP compliance
