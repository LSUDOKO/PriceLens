# PriceLens — Mermaid Architecture Diagrams

---

## 1. 🏗️ High-Level System Architecture (C4 Container Diagram)

```mermaid
graph TB
    %% Client Layer
    subgraph "📱 Client Layer"
        CD[("🤖 Claude Desktop\nMCP Client")]
        WB[("🌐 Web Browser\nReact SPA")]
        CI[("💻 Cursor / Cline\nIDE MCP Client")]
    end

    %% Transport Layer
    subgraph "🔌 Transport"
        STDIO[("📡 stdio\nJSON-RPC 2.0")]
        HTTP[("🌍 HTTP\nREST API")]
    end

    %% MCP Layer
    subgraph "🧠 PriceLens Server"
        MCP[("🔧 MCP Server\n9 Tools + 3 Resources\n@modelcontextprotocol/sdk")]
        API[("⚡ Next.js API Routes\n/api/prices, /api/alerts\n/api/seed, /api/health")]
    end

    %% Adapter Layer
    subgraph "🔗 Database Adapter"
        ADAPTER[("db-adapter.ts\nAuto-detects DynamoDB\nFalls back to in-memory")]
    end

    %% Data Layer
    subgraph "💾 Data Layer"
        DYNAMODB[("🗄️ Amazon DynamoDB\nProduction Storage\nPAY_PER_REQUEST")]
        MEMORY[("🧠 In-Memory Store\nDevelopment / Demo\nAuto-seeded on startup")]
    end

    %% Frontend
    subgraph "📊 Frontend Pages"
        EXPLORER[("🔍 Price Explorer\nSearch, filter, sort")]
        HEATMAP[("🗺️ Source Comparison\nColor-coded merchants")]
        ALERTS[("🔔 Price Alerts\nCRUD with autocomplete")]
    end

    %% Connections
    CD -->|stdio| STDIO
    STDIO --> MCP
    MCP --> ADAPTER
    ADAPTER --> DYNAMODB
    ADAPTER --> MEMORY

    WB --> HTTP
    HTTP --> API
    API --> ADAPTER

    CI -->|stdio| STDIO

    WB --> EXPLORER
    WB --> HEATMAP
    WB --> ALERTS

    %% Styling
    classDef client fill:#1e1e2a,stroke:#818cf8,color:#e4e4e7
    classDef server fill:#1a2a1e,stroke:#22c55e,color:#e4e4e7
    classDef data fill:#1e1e2a,stroke:#f59e0b,color:#e4e4e7
    classDef frontend fill:#1e1e2a,stroke:#818cf8,color:#e4e4e7
    classDef transport fill:#18181b,stroke:#52525b,color:#a1a1aa
    classDef adapter fill:#1e1e2a,stroke:#818cf8,color:#e4e4e7

    class CD,WB,CI client
    class MCP,API server
    class DYNAMODB,MEMORY data
    class EXPLORER,HEATMAP,ALERTS frontend
    class STDIO,HTTP transport
    class ADAPTER adapter
```

---

## 2. 🗄️ DynamoDB Schema (Entity-Relationship Diagram)

```mermaid
erDiagram
    Products ||--o{ Prices : "has"
    Products ||--o{ Alerts : "monitored by"

    Products {
        string sku PK "Partition Key"
        string name "Product name"
        string category "GSI: category-index"
        list tags "Search keywords"
        map baseSpecs "Flexible attributes"
    }

    Prices {
        string sku PK "Partition Key"
        string source PK "Sort Key (merchant/airline/site)"
        number pricePerUnit "Price amount"
        string unit "Unit (unit, night, ticket, round-trip)"
        string currency "Currency code (SGD, USD, EUR)"
        number timestamp "Last updated epoch"
        string sourceType "GSI: source-index"
    }

    Alerts {
        string userId PK "Partition Key"
        string alertId SK "Sort Key (UUID)"
        string sku "Product SKU"
        string targetSource "Source or * for all"
        number targetPrice "Price threshold"
        number createdAt "Creation timestamp"
    }
```

---

## 3. 🔄 Data Flow Diagram

```mermaid
sequenceDiagram
    participant User as 👤 User
    participant Claude as 🤖 Claude Desktop
    participant MCP as 🧠 MCP Server
    participant Adapter as 🔗 DB Adapter
    participant DB as 🗄️ DynamoDB / Memory

    Note over User,DB: 🔍 MCP Query Flow
    
    User->>Claude: "Find cheapest MacBook Pro"
    Claude->>MCP: JSON-RPC: find_best_price(sku)
    MCP->>MCP: Handle request
    MCP->>Adapter: getProduct(sku)
    Adapter->>DB: Query product
    DB-->>Adapter: Product data
    Adapter-->>MCP: Product record

    MCP->>Adapter: getPrices(sku)
    Adapter->>DB: Query prices by SKU
    DB-->>Adapter: Price records
    Adapter-->>MCP: Price array

    MCP->>MCP: Sort & calculate savings
    MCP-->>Claude: JSON-RPC: Best price result
    Claude-->>User: "🏆 BestBuy US: $329 USD"

    Note over User,DB: 🔔 Alert Flow

    User->>Claude: "Alert me when below $300"
    Claude->>MCP: JSON-RPC: set_price_alert(sku, 300)
    MCP->>Adapter: putAlert(alert)
    Adapter->>DB: Store alert
    DB-->>Adapter: OK
    MCP-->>Claude: ✅ Alert created
    Claude-->>User: "I'll notify you!"

    Note over User,DB: 🌐 Web Flow

    User->>User: Opens Browser /heatmap
    User->>WB: fetch(/api/prices?type=all)
    WB->>API: HTTP GET
    API->>Adapter: scanAllPrices()
    Adapter->>DB: Scan prices table
    DB-->>Adapter: All price records
    Adapter-->>API: Price data
    API-->>WB: JSON Response
    WB-->>User: Renders comparison chart
```

---

## 4. 🧩 MCP Tool Architecture

```mermaid
graph LR
    subgraph "MCP Server"
        direction TB
        LIST[("📋 ListTools\n9 tool schemas")]
        CALL[("📞 CallTool\nRoute to handler")]
        RES[("📚 ListResources\n3 resource URIs")]
        READ[("📖 ReadResource\nFetch data")]
    end

    subgraph "Tool Handlers"
        SP[("search_prices")]
        CS[("compare_sources")]
        FP[("find_best_price")]
        LC[("list_categories")]
        LP[("list_products_by_category")]
        SA[("set_price_alert")]
        LA[("list_alerts")]
        DA[("delete_alert")]
        SO[("get_source_overview")]
    end

    LIST --> CALL
    CALL --> SP
    CALL --> CS
    CALL --> FP
    CALL --> LC
    CALL --> LP
    CALL --> SA
    CALL --> LA
    CALL --> DA
    CALL --> SO

    SP --> Adapter[("🔗 db-adapter.ts\nDatabase Adapter")]
    CS --> Adapter
    FP --> Adapter
    LC --> Adapter
    LP --> Adapter
    SA --> Adapter
    LA --> Adapter
    DA --> Adapter
    SO --> Adapter

    RES --> READ
    READ --> Adapter

    Adapter --> DynamoDB[("🗄️ DynamoDB\nProduction")]
    Adapter --> Memory[("🧠 Memory Store\nDevelopment")]

    style SP fill:#1e1e2a,stroke:#818cf8
    style CS fill:#1e1e2a,stroke:#22c55e
    style FP fill:#1e1e2a,stroke:#f59e0b
```

---

## 5. 🗺️ Source/Merchant Map

```mermaid
mindmap
  root((PriceLens Sources))
    ::id1
    (Merchants)
      🛒 Shopee SG
      🛍️ Lazada SG
      📦 Amazon SG
      🇺🇸 Amazon US
      💻 Best Buy US
    (Airlines)
      ✈️ Google Flights
      🇸🇬 Singapore Airlines
      🇦🇪 Emirates
    (Booking Sites)
      🏨 Booking.com
      🏠 Agoda
      🌐 Expedia
    (Event Platforms)
      🎫 Ticketmaster
      🎟️ Viator
    (Financial)
      📈 Google Finance
```

---

## 6. 📊 Product Categories Breakdown

```mermaid
pie title Products by Category
    "Electronics" : 5
    "Flights" : 3
    "Hotels" : 3
    "Events" : 3
```

```mermaid
pie title Price Records by Source Type
    "Merchants" : 25
    "Airlines" : 7
    "Booking" : 9
    "Exchange" : 6
```

---

## How to Use These Diagrams

1. **GitHub renders Mermaid natively** — just push this file and GitHub will render the diagrams automatically.
2. **VS Code** — install the "Markdown Preview Mermaid Support" extension.
3. **Mermaid Live Editor** — paste any diagram into [mermaid.live](https://mermaid.live) to edit and export as SVG/PNG.
4. **For the hackathon submission** — take screenshots of these diagrams and include them in your submission.
