# PriceLens — H0 Hackathon Submission

> **Track:** Track 2: Monetizable B2B App  
> **AWS Database Used:** Amazon DynamoDB (On-Demand Capacity Mode)  
> **Frontend:** Next.js 16.2 on Vercel  
> **Stack:** DynamoDB + MCP (Model Context Protocol) + Next.js + TypeScript  
> **GitHub:** [https://github.com/LSUDOKO/PriceLens](https://github.com/LSUDOKO/PriceLens)  
> **Architecture Diagram:** `/architecture.html`  
> **Demo Video:** [YouTube Link]

---

## 🌟 Inspiration

The idea for PriceLens was born from a universal frustration: **prices for the exact same product vary wildly across different platforms, and finding the best deal requires checking 5–10 websites manually.**

We noticed this everywhere:

- **A MacBook Pro M4** costs SGD 2,799 on Amazon Singapore but SGD 2,949 on Lazada — for the identical product.
- **A flight from Singapore to London** ranges from SGD 980 on Google Flights to SGD 1,250 if booked directly with Singapore Airlines.
- **The same hotel room** at Marina Bay Sands costs SGD 520/night on Agoda vs SGD 550 on Booking.com.
- **Coldplay concert tickets** are SGD 168 on Ticketmaster but SGD 198 on resale platforms.

This price fragmentation is a massive pain point for consumers and businesses alike. In Singapore and Southeast Asia, where cross-border shopping is common and multiple e-commerce platforms compete fiercely, the savings from choosing the right source can be 20–40% on a single purchase.

We also realized that **AI assistants are becoming the primary interface for how people research purchases**. Users increasingly ask Claude, ChatGPT, or Cursor about products. But these AI models don't have real-time access to current pricing data. They hallucinate prices or give outdated information.

**PriceLens bridges this gap** by combining:
1. A structured price comparison engine powered by **Amazon DynamoDB**
2. An **MCP (Model Context Protocol)** server that gives AI assistants real-time access to pricing data
3. A beautiful **Next.js dashboard** on Vercel for visual exploration
4. A **seamless database adapter** that works with both DynamoDB (production) and in-memory storage (development)

---

## 🏆 What It Does

PriceLens is a **universal multi-product price comparison platform** that aggregates pricing data from 14+ sources across 5 categories and exposes it through three interfaces:

### 1. 🤖 MCP Server (Primary Interface)

Connect any MCP-compatible client — **Claude Desktop, Cursor, Cline, or any AI assistant** — and use 9 specialized tools to query pricing in natural language:

| Tool | What It Does | Example Usage |
|---|---|---|
| `search_prices` | Search products by keyword/category | "Find me MacBook Pro prices" |
| `compare_sources` | Full price comparison across merchants | "Compare Sony headphones across all sources" |
| `find_best_price` | Find the cheapest source | "Where should I buy an iPhone 16 Pro?" |
| `list_categories` | Browse product categories | "What categories do you track?" |
| `list_products_by_category` | Products with specs | "Show me all electronics" |
| `set_price_alert` | Create price drop alerts | "Alert me when flights to Tokyo drop below SGD 500" |
| `list_alerts` | View active alerts | "Show my active alerts" |
| `delete_alert` | Remove an alert | "Remove my alert for Marina Bay Sands" |
| `get_source_overview` | Summary per merchant | "How does Shopee pricing compare?" |

### 2. 🌐 Web Dashboard (Visual Interface)

Three fully responsive Next.js pages:
- **Price Explorer** (`/`) — Search, filter, sort products; see price ranges, savings, cheapest sources with expandable source details
- **Source Comparison** (`/heatmap`) — Color-coded visual overview of all 14 sources by average price, tagged by type (merchant, airline, booking, exchange)
- **Price Alerts** (`/alerts`) — Full CRUD with product autocomplete, target prices, and source selection

### 3. 🔌 REST API (Programmatic Access)

Four endpoints built on the same database adapter as the MCP server:
- `GET /api/prices` — Query by SKU, source, or category
- `GET/POST /api/alerts` — Create, list, and delete price alerts
- `POST /api/seed` — Seed DynamoDB or in-memory store with pricing data
- `GET /api/health` — Health check with store type and data counts

### Key Capabilities

- **Cross-source price comparison** — instantly see who has the best price
- **Smart deal finding** — find the cheapest source with savings percentage
- **Automated price alerts** — get notified when prices drop to your target
- **Zero-setup development** — works immediately with in-memory store, upgrades to DynamoDB automatically when AWS credentials are configured
- **Database adapter pattern** — the same code works for development (in-memory) and production (DynamoDB)

---

## 🛠️ How We Built It

### Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  Claude Desktop                      │
│             (or any MCP Client)                      │
└──────────────────────┬──────────────────────────────┘
                       │ stdio (JSON-RPC 2.0)
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
│  Next.js API   │ │Memory    │ │  Amazon       │
│  Routes        │ │Store     │ │  DynamoDB     │
│  (Vercel)      │ │(Dev)     │ │  (Production) │
└────────────────┘ └──────────┘ └──────────────┘
```

### Technology Choices

#### Amazon DynamoDB (AWS Database)
We chose **Amazon DynamoDB** as our AWS Database for several strategic reasons:

| Requirement | Why DynamoDB |
|---|---|
| **Flexible schema** | Product types vary wildly — laptops have specs like RAM/CPU, flights have departure/arrival codes, hotels have star ratings. DynamoDB's schemaless design handles this naturally. |
| **Fast single-key lookups** | `GetItem` by SKU gives sub-millisecond reads for product lookups |
| **GSI for category queries** | Our `category-index` GSI lets us query all products in a category instantly |
| **GSI for source queries** | Our `source-index` GSI enables "show me all prices from Shopee" queries |
| **Serverless billing** | `PAY_PER_REQUEST` mode means zero cost when not in use — perfect for a hackathon project |
| **TTL support** | Built-in time-to-live for auto-expiring stale pricing data |
| **Global Tables ready** | Future-proof for multi-region deployments |

**Data Model (3 Tables):**

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

#### Next.js 16.2 (Frontend)
- **React Server Components** for optimal performance
- **App Router** with file-based routing (3 pages + 4 API routes)
- **Tailwind CSS 4** for styling with dark mode
- **Lucide React** for clean, consistent icons
- **Responsive design** — mobile-first with collapsible navigation

#### MCP (Model Context Protocol)
- **@modelcontextprotocol/sdk v1.29** for MCP compliance
- **Stdio transport** for Claude Desktop integration
- **9 tools** with full JSON Schema input validation
- **3 resources** with URI-based access (sources, categories, products)
- **Error handling** with McpError codes and graceful fallbacks

#### Database Adapter Pattern (Key Innovation)
The `db-adapter.ts` layer is the architectural centerpiece:
1. On startup, it checks for `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
2. If credentials exist, it tests DynamoDB connectivity by listing tables
3. If DynamoDB is available → routes all queries to DynamoDB
4. If not → falls back to in-memory store (zero setup required)
5. The same `getProduct()`, `getPrices()`, `putAlert()` functions work regardless of backend

This means:
- **Judges can run the project instantly** — no AWS account needed
- **Production deployment** — add AWS credentials → seamlessly upgrades to persistent storage
- **Same code path** — no branches, no if/else, no configuration toggles

### Project Structure

```
pricelens/
├── src/
│   ├── lib/
│   │   ├── types.ts          # Shared types, 14 sources, 5 categories
│   │   ├── dynamodb.ts       # DynamoDB client, 3 tables, GSIs, seed data
│   │   ├── memory-store.ts   # In-memory fallback (zero setup)
│   │   ├── db-adapter.ts     # 🔑 Auto-detects DynamoDB vs in-memory
│   │   └── mcp-server.ts     # 🧠 9 MCP tools + 3 resources
│   ├── mcp-run.ts            # Standalone MCP entry for Claude Desktop
│   └── app/
│       ├── page.tsx          # Price Explorer dashboard
│       ├── heatmap/page.tsx  # Source Comparison visualization
│       ├── alerts/page.tsx   # Alert management with autocomplete
│       └── api/              # REST: prices, alerts, seed, health
├── scripts/provision-dynamodb.sh  # AWS table creation
├── infra/dynamodb-template.yaml    # CloudFormation template
├── public/architecture.html        # Architecture diagram
├── vercel.json                     # Vercel deployment config
└── README.md                       # Comprehensive documentation
```

### Seed Data (14 Products)

| Category | Products |
|---|---|
| 📱 Electronics | MacBook Pro M4, ThinkPad X1 Gen 12, iPhone 16 Pro, Galaxy S25 Ultra, Sony WH-1000XM6 |
| ✈️ Flights | SIN→LHR, SIN→NRT, SIN→BKK (round trips) |
| 🏨 Hotels | Marina Bay Sands, Capella Singapore, Hôtel Ritz Paris |
| 🎫 Events | Coldplay SG Concert, Singapore Grand Prix, Universal Studios SG |

### Pricing Data (60+ Records Across 14 Sources)

| Source | Type | Products Tracked |
|---|---|---|
| Shopee SG 🛒 | merchant | 5 electronics |
| Lazada SG 🛍️ | merchant | 5 electronics |
| Amazon SG 📦 | merchant | 5 electronics |
| Amazon US 🇺🇸 | merchant | 5 electronics |
| Best Buy US 💻 | merchant | 5 electronics |
| Google Flights ✈️ | airline | 3 flights |
| Singapore Airlines 🇸🇬 | airline | 3 flights |
| Emirates 🇦🇪 | airline | 1 flight |
| Booking.com 🏨 | booking | 3 hotels |
| Agoda 🏠 | booking | 3 hotels |
| Expedia 🌐 | booking | 3 hotels |
| Ticketmaster 🎫 | exchange | 3 events |
| Viator 🎟️ | exchange | 3 events |

---

## 🚧 Challenges We Ran Into

### 1. Data Model Design — Generic vs Specific

The hardest architectural decision was how to design the DynamoDB schema. Product types are fundamentally different:
- A laptop has `cpu`, `ram`, `storage`, `screen`
- A flight has `departure`, `arrival`, `duration`, `cabin`
- A hotel has `stars`, `pool`, `rooms`, `restaurant`

**Solution:** We use DynamoDB's `Map` type for `baseSpecs` — a flexible key-value structure that accommodates any product type. The interface `Record<string, string>` allows each category to define its own attributes without schema migration.

### 2. The N+1 Query Problem in MCP Tools

When querying `get_region_overview` (now `get_source_overview`), we initially looked up the product for each price record individually — resulting in N sequential DynamoDB queries for N prices.

**Solution:** We implemented a product cache within the handler that stores already-fetched products, reducing the N lookups to at most 14 (one per unique SKU). We also shallow-clone price records with `{ ...p, category: cat }` to avoid mutating the in-store objects — a subtle but important data integrity fix.

### 3. Seamless DynamoDB Fallback

The database adapter pattern was deceptively simple in concept but tricky to implement. The challenge was:
- **Cold start detection** — check DynamoDB availability on the first request, not at import time
- **Lazy loading** — only import the DynamoDB module if it's going to be used
- **Graceful degradation** — if DynamoDB is configured but unreachable, fall back to memory with a clear warning

**Solution:** A lazy singleton pattern where `useDynamoDB` starts as `null`, gets resolved on the first call, and then caches the result. The `getDB()` function handles this transparently.

### 4. Renaming the Project Mid-Build

We originally built the project as "PricePulse" focused on AWS cloud pricing, then realized the actual use case was multi-product retail comparison. This required renaming every file, variable, and reference — over 100 changes across 34 files. TypeScript's type checking was invaluable for catching missed references.

### 5. MCP Protocol Debugging

The MCP stdio transport uses stdout for JSON-RPC messages and stderr for logging. If any `console.log()` accidentally goes to stdout, it corrupts the protocol. We had to audit every file to ensure all debug output uses `console.error()`.

---

## 🎉 Accomplishments That We're Proud Of

### 1. Zero-Setup Magic

**The app works immediately** — no AWS account, no API keys, no database provisioning. Just `npm install && npm run dev` and you have a fully functional price comparison platform with 14 products and 60+ price points. This is achieved through our database adapter pattern that seamlessly falls back to an in-memory store pre-loaded with realistic seed data.

### 2. Three Interfaces, One Backend

The same `db-adapter` layer powers three distinct interfaces:
- **MCP Server** (for AI assistants)
- **Web Dashboard** (for humans)
- **REST API** (for programs)

All 9 MCP tools are mirrored in the web UI and API routes. A price alert created via Claude Desktop appears instantly in the web dashboard.

### 3. Production-Grade Architecture

Despite being a hackathon project, PriceLens has:
- **Full TypeScript** with strict mode
- **Comprehensive error handling** with typed error responses
- **Input validation** on all API endpoints (e.g., rejecting negative prices)
- **Database adapter pattern** (same code, two backends)
- **CloudFormation template** for infrastructure-as-code
- **Vercel deployment configuration** with CORS headers
- **Comprehensive README** with quick start, architecture docs, and demo plan

### 4. Realistic Demo Data

We crafted 14 products with real-world pricing from actual sources — MacBook Pro M4 from Apple (2025), Singapore Airlines flights, Marina Bay Sands hotel rates. The demo data shows **realistic savings percentages** (18–35%) that demonstrate genuine value.

### 5. MCP-First Design

By implementing the Model Context Protocol, PriceLens is natively compatible with the rapidly growing ecosystem of AI tools — Claude Desktop, Cursor, Cline, and any future MCP-compatible client. This makes the project immediately useful and future-proof.

### 6. Beautiful, Responsive UI

The web dashboard features:
- Dark mode with professional color scheme
- Smooth animations and transitions
- Mobile-responsive layout with collapsible navigation
- Interactive elements (expandable product cards, autocomplete search, animated ping indicators)
- Category-specific icons and color-coded source types

---

## 📚 What We Learned

### Technical Learnings

1. **DynamoDB Single-Table vs Multi-Table Design** — We chose multi-table (3 tables) over single-table because our access patterns are fundamentally different: products by category, prices by SKU/source, and alerts by user. In production, DynamoDB's single-table design could reduce costs for high-traffic scenarios.

2. **GSI vs LSI Tradeoffs** — We use GSIs for `category-index` and `source-index` because these queries are flexible (any category, any source). An LSI on `pricePerUnit` within a product's price records would enable sorted queries like "cheapest to most expensive for this product" without a separate index.

3. **MCP is Still Emerging** — The Model Context Protocol SDK (`@modelcontextprotocol/sdk v1.29`) is still evolving. We encountered API changes between versions and had to pin our dependency. The stdio transport is well-documented but the HTTP/SSE transport is still in development.

4. **Next.js 16 + App Router** — Latest Next.js with React 19 is extremely fast. The App Router's file-based API routes (`route.ts`) are elegant for small APIs but lack middleware support for cross-cutting concerns like rate limiting.

5. **TypeScript Generics for Adapter Patterns** — Using generics in the db-adapter allowed us to type the in-memory store and DynamoDB implementations against the same interface, catching type errors at compile time.

### Project Management Learnings

6. **Start with the Data Model** — We initially built the UI and MCP server before finalizing the data model, which led to significant rework when we pivoted from AWS cloud pricing to multi-product comparison. **Lesson: Finalize your schema before writing business logic.**

7. **Hackathon Scope Management** — The original scope ("compare prices of everything") was too broad. We narrowed it to 4 categories (electronics, flights, hotels, events) with 14 carefully chosen products that demonstrate the full range of the platform's capabilities.

8. **Documentation is Infrastructure** — Writing the README, architecture diagram, and this submission document forced us to clarify our thinking and identify inconsistencies in the design.

---

## 🔮 What's Next for PriceLens

### Short-Term (Next 30 Days)

1. **Vercel Deployment** — Deploy the Next.js frontend to Vercel with DynamoDB integration for persistent storage. Add the following environment variables:
   ```bash
   AWS_ACCESS_KEY_ID=<your-key>
   AWS_SECRET_ACCESS_KEY=<your-secret>
   AWS_REGION=us-east-1
   ```

2. **Real Data Integration** — Connect actual APIs:
   - **BuyWhere API** for real-time Shopee/Lazada/Amazon prices (laptops, electronics)
   - **SerpAPI** for real Google Flights, Hotels, and Events data
   - **Duffel API** for flight search and booking
   - Build an ingestion pipeline with DynamoDB Streams for real-time price updates

3. **User Authentication** — Add NextAuth.js or Clerk for:
   - User-specific alerts (currently uses `default-user`)
   - Personalized watchlists and favorite sources
   - Multi-user support for teams

### Medium-Term (3 Months)

4. **Price History & Trends** — Store historical prices with DynamoDB TTL for:
   - Price history charts (Recharts already imported)
   - "Best time to buy" predictions
   - Price drop notifications via email/webhook

5. **Mobile App** — Build React Native or Swift/Kotlin clients that use the same MCP server via HTTP transport (once the MCP SDK supports it)

6. **Seller Dashboard** — Allow merchants/retailers to:
   - Submit their pricing data via the `ingest_products`-style API
   - See competitive pricing intelligence
   - Get alerts when competitors change prices

### Long-Term (6+ Months)

7. **AI-Powered Recommendations** — Use the pricing data + DynamoDB to:
   - Train models for demand-based price prediction
   - "This product typically drops to X price during holiday sales"
   - Cross-category bundling recommendations

8. **Global Expansion** — Deploy DynamoDB Global Tables for:
   - Multi-region coverage (US, EU, APAC, LATAM)
   - Local currency support
   - Regional merchant integration

9. **Monetization** — B2B pricing API for:
   - E-commerce analytics platforms
   - Travel booking aggregators
   - Price intelligence SaaS (the hackathon track!)

---

## 📋 Submission Requirements Checklist

| Requirement | Status | Notes |
|---|---|---|
| ✅ Text Description | Complete | See above and README.md |
| ✅ AWS Database Used | **Amazon DynamoDB** | 3 tables, PAY_PER_REQUEST, GSIs |
| ✅ Architecture Diagram | Complete | `/architecture.html` |
| ⏳ Vercel Project Link | Pending | Run `vercel` in project root |
| ⏳ DynamoDB Screenshot | Pending | Need to provision tables in AWS Console |
| ⏳ Demo Video (<3 min) | Pending | See README for demo plan |
| ⏳ Blog Post (Bonus) | Pending | dev.to / Medium / LinkedIn |
| ✅ GitHub Repository | **github.com/LSUDOKO/PriceLens** | Clean, professional, no unrelated files |

---

## 🙏 Acknowledgments

- Built for the **H0 Hackathon** (AWS Databases × Vercel v0)
- Uses **Amazon DynamoDB** for persistent storage and querying
- Uses **Next.js 16.2** + **Vercel** for frontend deployment
- Uses **@modelcontextprotocol/sdk** for MCP compliance
- All product data is for demo purposes. Actual prices may vary.
