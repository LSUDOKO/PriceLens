"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, TrendingDown, Globe, ArrowUpDown, RefreshCw, AlertCircle, ShoppingCart, Plane, Building2, Ticket, DollarSign } from "lucide-react";

interface Product {
  product: Record<string, unknown>;
  prices: Record<string, unknown>[];
}

interface Source {
  id: string;
  name: string;
  type: string;
  icon: string;
}

const categoryIcons: Record<string, React.ReactNode> = {
  electronics: <ShoppingCart className="h-4 w-4" />,
  flights: <Plane className="h-4 w-4" />,
  hotels: <Building2 className="h-4 w-4" />,
  events: <Ticket className="h-4 w-4" />,
  finance: <DollarSign className="h-4 w-4" />,
};

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("name");
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/prices?type=all");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProducts(data.products || []);
      setSources(data.sources || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const categories = [...new Set(products.map(p => p.product.category as string))];

  const filtered = products.filter(p => {
    const name = ((p.product.name as string) || "").toLowerCase();
    const sku = ((p.product.sku as string) || "").toLowerCase();
    const matchesSearch = !searchQuery || name.includes(searchQuery.toLowerCase()) || sku.includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || p.product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "name") return ((a.product.name as string) || "").localeCompare((b.product.name as string) || "");
    if (sortBy === "savings") {
      const aPrices = a.prices.map(p => p.pricePerUnit as number);
      const bPrices = b.prices.map(p => p.pricePerUnit as number);
      const aSpread = aPrices.length > 1 ? Math.max(...aPrices) - Math.min(...aPrices) : 0;
      const bSpread = bPrices.length > 1 ? Math.max(...bPrices) - Math.min(...bPrices) : 0;
      return bSpread - aSpread;
    }
    return 0;
  });

  const getLowestPrice = (prices: Record<string, unknown>[]) => {
    if (prices.length === 0) return null;
    return Math.min(...prices.map(p => p.pricePerUnit as number));
  };

  const getCheapestSource = (prices: Record<string, unknown>[]) => {
    if (prices.length === 0) return null;
    const sorted = [...prices].sort((a, b) => (a.pricePerUnit as number) - (b.pricePerUnit as number));
    return sorted[0].source as string;
  };

  const getHighestPrice = (prices: Record<string, unknown>[]) => {
    if (prices.length === 0) return null;
    return Math.max(...prices.map(p => p.pricePerUnit as number));
  };

  const getSavingsPercent = (prices: Record<string, unknown>[]) => {
    if (prices.length < 2) return 0;
    const min = getLowestPrice(prices)!;
    const max = getHighestPrice(prices)!;
    return ((max - min) / max * 100);
  };

  const getSourceInfo = (id: string) => {
    return sources.find(s => s.id === id);
  };

  const getCurrency = (prices: Record<string, unknown>[]) => {
    if (prices.length === 0) return "USD";
    return (prices[0].currency as string) || "USD";
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted">Loading pricing data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <AlertCircle className="h-12 w-12 text-danger" />
        <h2 className="text-lg font-semibold">Connection Error</h2>
        <p className="text-sm text-muted max-w-md text-center">
          {error.includes("fetch") || error.includes("Network")
            ? "Could not connect to the API. Make sure the server is running."
            : `Error: ${error}`}
        </p>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-colors"
        >
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
        <p className="text-xs text-muted mt-4">
          Tip: Run <code className="rounded bg-secondary px-1.5 py-0.5 font-mono">curl -X POST http://localhost:3000/api/seed</code> to seed data
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Price Explorer</h1>
        <p className="text-sm text-muted">
          Compare prices across {sources.length} sources — Shopee, Lazada, Amazon, airlines, booking sites, and more. Find the best deal every time.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted font-medium">Products</p>
          <p className="text-xl font-bold mt-0.5">{products.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted font-medium">Sources</p>
          <p className="text-xl font-bold mt-0.5">{sources.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted font-medium">Categories</p>
          <p className="text-xl font-bold mt-0.5">{categories.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted font-medium">Avg Savings</p>
          <p className="text-xl font-bold mt-0.5 text-accent">
            {products.length > 0
              ? `${Math.round(products.reduce((sum, p) => sum + getSavingsPercent(p.prices), 0) / products.length)}%`
              : "—"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            placeholder="Search products by name or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-border bg-card pl-9 pr-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
        >
          <option value="">All Categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
          ))}
        </select>
        <button
          onClick={() => setSortBy(sortBy === "savings" ? "name" : "savings")}
          className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-secondary transition-colors"
        >
          <ArrowUpDown className="h-4 w-4" />
          {sortBy === "savings" ? "By Savings" : "By Name"}
        </button>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-secondary transition-colors"
          title="Refresh data"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Product Grid */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted">
          <Search className="h-8 w-8" />
          <p className="text-sm">No products found matching your search.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((item) => {
            const prices = item.prices;
            const lowest = getLowestPrice(prices);
            const highest = getHighestPrice(prices);
            const savings = getSavingsPercent(prices);
            const cheapestSource = getCheapestSource(prices);
            const cheapestInfo = cheapestSource ? getSourceInfo(cheapestSource) : null;
            const product = item.product;
            const currency = getCurrency(prices);
            const categoryKey = (product.category as string) || "";

            return (
              <div
                key={product.sku as string}
                className="group rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-sm transition-all duration-200"
              >
                <div className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm truncate">{product.name as string}</h3>
                      <p className="text-xs text-muted font-mono">{product.sku as string}</p>
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted uppercase tracking-wider">
                      {categoryIcons[categoryKey]}
                      {product.category as string}
                    </span>
                  </div>

                  {/* Specs */}
                  {(product.baseSpecs as Record<string, string>) && (
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(product.baseSpecs as Record<string, string>).slice(0, 3).map(([k, v]) => (
                        <span key={k} className="rounded-md bg-secondary/50 px-1.5 py-0.5 text-[10px] text-muted font-mono">
                          {k}: {v}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Price Range */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted">Price range</span>
                      {prices.length > 1 && (
                        <span className="flex items-center gap-1 font-medium text-accent">
                          <TrendingDown className="h-3 w-3" />
                          Save {savings.toFixed(0)}%
                        </span>
                      )}
                    </div>
                    {lowest !== null && (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-lg font-bold">{currency} ${lowest.toFixed(2)}</span>
                        {highest !== lowest && (
                          <span className="text-xs text-muted">— ${highest?.toFixed(2)}</span>
                        )}
                        <span className="text-[10px] text-muted">/{(prices[0] as Record<string, unknown>)?.unit as string || "unit"}</span>
                      </div>
                    )}
                  </div>

                  {/* Cheapest Source */}
                  {cheapestInfo && (
                    <div className="flex items-center gap-1.5 rounded-lg bg-secondary/50 px-2.5 py-1.5 text-xs">
                      <ShoppingCart className="h-3 w-3 text-primary" />
                      <span className="text-muted">Best deal:</span>
                      <span className="font-medium">{cheapestInfo.icon} {cheapestSource}</span>
                    </div>
                  )}
                </div>

                {/* Expandable source prices */}
                <details className="border-t border-border group-open:border-primary/20">
                  <summary className="cursor-pointer px-4 py-2 text-xs font-medium text-muted hover:text-foreground transition-colors">
                    All sources ({prices.length})
                  </summary>
                  <div className="px-4 pb-3 space-y-1">
                    {(prices as { source: string; pricePerUnit: number; currency: string }[])
                      .sort((a, b) => a.pricePerUnit - b.pricePerUnit)
                      .map((p) => {
                        const info = getSourceInfo(p.source);
                        const icon = info?.icon || "";
                        const isCheapest = p.pricePerUnit === lowest;
                        return (
                          <div
                            key={p.source}
                            className={`flex items-center justify-between rounded-md px-2 py-1 text-xs ${
                              isCheapest ? "bg-accent/10 text-accent font-medium" : "text-muted"
                            }`}
                          >
                            <span>{icon} {p.source}</span>
                            <span className="font-mono">{p.currency} ${p.pricePerUnit.toFixed(2)}</span>
                          </div>
                        );
                      })}
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
