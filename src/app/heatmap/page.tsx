"use client";

import { useState, useEffect } from "react";
import { Globe, TrendingDown, TrendingUp, Minus, AlertCircle, RefreshCw, ShoppingCart } from "lucide-react";

interface SourceData {
  source: string;
  name: string;
  icon: string;
  avgPrice: number;
  productCount: number;
  cheapestCount: number;
  type: string;
}

export default function HeatmapPage() {
  const [sourceData, setSourceData] = useState<SourceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const res = await fetch("/api/prices?type=all");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const sources = data.sources || [];
        const products = data.products || [];

        // Calculate stats per source
        const sourceStats: Record<string, { prices: number[]; count: number; cheapestWin: number }> = {};

        for (const s of sources) {
          sourceStats[s.id] = { prices: [], count: 0, cheapestWin: 0 };
        }

        for (const item of products) {
          for (const p of item.prices) {
            const code = p.source as string;
            if (sourceStats[code]) {
              sourceStats[code].prices.push(p.pricePerUnit as number);
              sourceStats[code].count++;
            }
          }

          // Find cheapest source for this product
          if (item.prices.length > 0) {
            const sorted = [...item.prices].sort(
              (a: Record<string, unknown>, b: Record<string, unknown>) =>
                (a.pricePerUnit as number) - (b.pricePerUnit as number)
            );
            const cheapestSource = sorted[0].source as string;
            if (sourceStats[cheapestSource]) {
              sourceStats[cheapestSource].cheapestWin++;
            }
          }
        }

        const mapped: SourceData[] = sources.map((s: { id: string; name: string; icon: string; type: string }) => {
          const stats = sourceStats[s.id];
          const avg = stats.prices.length > 0
            ? stats.prices.reduce((a, b) => a + b, 0) / stats.prices.length
            : 0;
          return {
            source: s.id,
            name: s.name,
            icon: s.icon,
            type: s.type,
            avgPrice: avg,
            productCount: stats.count,
            cheapestCount: stats.cheapestWin,
          };
        });

        setSourceData(mapped.sort((a: SourceData, b: SourceData) => a.avgPrice - b.avgPrice));
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header skeleton */}
        <div className="space-y-2">
          <div className="h-8 w-48 rounded-lg bg-secondary animate-pulse" />
          <div className="h-4 w-80 rounded-lg bg-secondary animate-pulse" />
        </div>
        {/* Summary cards skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-3">
              <div className="h-3 w-24 rounded bg-secondary animate-pulse mb-2" />
              <div className="h-7 w-28 rounded bg-secondary animate-pulse" />
            </div>
          ))}
        </div>
        {/* Source cards skeleton */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-secondary animate-pulse" />
                <div className="space-y-1 flex-1">
                  <div className="h-4 w-24 rounded bg-secondary animate-pulse" />
                  <div className="h-3 w-32 rounded bg-secondary animate-pulse" />
                </div>
              </div>
              <div className="h-7 w-20 rounded bg-secondary animate-pulse" />
              <div className="h-2 w-full rounded-full bg-secondary animate-pulse" />
              <div className="flex justify-between">
                <div className="h-3 w-16 rounded bg-secondary animate-pulse" />
                <div className="h-3 w-20 rounded bg-secondary animate-pulse" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-2 py-4">
          <RefreshCw className="h-4 w-4 animate-spin text-primary" />
          <p className="text-xs text-muted">Loading price comparison data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <AlertCircle className="h-12 w-12 text-danger" />
        <h2 className="text-lg font-semibold">Error</h2>
        <p className="text-sm text-muted">{error}</p>
      </div>
    );
  }

  const globalAvg = sourceData.length > 0
    ? sourceData.reduce((s, r) => s + r.avgPrice, 0) / sourceData.length
    : 0;

  const typeColors: Record<string, string> = {
    merchant: "from-blue-500 to-indigo-500",
    airline: "from-purple-500 to-pink-500",
    booking: "from-teal-500 to-emerald-500",
    exchange: "from-orange-500 to-red-500",
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Source Comparison</h1>
        <p className="text-sm text-muted">
          Compare average pricing across merchants, airlines, and booking sites. See where you get the best deals.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted font-medium">Cheapest Source</p>
          <p className="text-lg font-bold mt-0.5 text-accent">
            {sourceData[0]?.icon} {sourceData[0]?.source}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted font-medium">Most Expensive</p>
          <p className="text-lg font-bold mt-0.5 text-danger">
            {sourceData[sourceData.length - 1]?.icon} {sourceData[sourceData.length - 1]?.source}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted font-medium">Price Spread</p>
          {sourceData.length >= 2 && (
            <p className="text-lg font-bold mt-0.5">
              {((sourceData[sourceData.length - 1].avgPrice - sourceData[0].avgPrice) / sourceData[0].avgPrice * 100).toFixed(0)}%
            </p>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted font-medium">Global Avg</p>
          <p className="text-lg font-bold mt-0.5">${globalAvg.toFixed(2)}</p>
        </div>
      </div>

      {/* Source Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {sourceData.map((s, i) => {
          const priceIndex = i / Math.max(sourceData.length - 1, 1);
          const isCheapest = i === 0;
          const isMostExpensive = i === sourceData.length - 1;
          const vsGlobal = ((s.avgPrice - globalAvg) / globalAvg * 100);

          const bgColor = `rgba(99, 102, 241, ${0.05 + priceIndex * 0.2})`;
          const borderColor = isCheapest
            ? "border-accent/50"
            : isMostExpensive
            ? "border-danger/50"
            : "border-border";

          return (
            <div
              key={s.source}
              className={`rounded-xl border-2 ${borderColor} bg-card p-4 transition-all hover:shadow-sm`}
              style={{ background: bgColor }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{s.icon}</span>
                  <div>
                    <p className="font-semibold text-sm">{s.source}</p>
                    <p className="text-[10px] text-muted truncate max-w-[140px]">{s.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {isCheapest && <TrendingDown className="h-4 w-4 text-accent" />}
                  {isMostExpensive && <TrendingUp className="h-4 w-4 text-danger" />}
                  {!isCheapest && !isMostExpensive && <Minus className="h-4 w-4 text-muted" />}
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <p className="text-xs text-muted">Average Price</p>
                  <p className="text-xl font-bold">${s.avgPrice.toFixed(2)}</p>
                </div>

                {/* Price bar */}
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min((s.avgPrice / (sourceData[sourceData.length - 1]?.avgPrice || 1)) * 100, 100)}%`,
                      background: `linear-gradient(90deg, rgb(34,197,94), rgb(99,102,241), rgb(239,68,68))`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">{s.productCount} products</span>
                  <span className={`font-medium ${vsGlobal < 0 ? 'text-accent' : vsGlobal > 0 ? 'text-danger' : 'text-muted'}`}>
                    {vsGlobal > 0 ? '+' : ''}{vsGlobal.toFixed(1)}% vs avg
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded bg-gradient-to-r ${typeColors[s.type] || "from-gray-500 to-gray-600"} text-white`}>
                    {s.type}
                  </span>
                  <span className="text-[10px] text-muted">· {s.cheapestCount} best deals</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
