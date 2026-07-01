"use client";

import { useState, useEffect } from "react";
import { Bell, Plus, Trash2, AlertCircle, RefreshCw, CheckCircle2, Search, ShoppingCart } from "lucide-react";

interface Alert {
  userId: string;
  alertId: string;
  sku: string;
  targetSource: string;
  targetPrice: number;
  createdAt: number;
  productName: string;
  triggered?: boolean;
  currentLowest?: number | null;
  currentCheapestSource?: string | null;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [skuSearch, setSkuSearch] = useState("");
  const [skuSuggestions, setSkuSuggestions] = useState<{ sku: string; name: string }[]>([]);
  const [formData, setFormData] = useState({ sku: "", targetPrice: "", source: "*" });
  const [creating, setCreating] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/alerts?userId=default-user");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAlerts(data.alerts || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAlerts(); }, []);

  const searchProducts = async (q: string) => {
    if (q.length < 1) { setSkuSuggestions([]); return; }
    try {
      const res = await fetch(`/api/prices?type=products`);
      const data = await res.json();
      const all = data.products || [];
      const filtered = all.filter((p: Record<string, unknown>) =>
        (p.sku as string).toLowerCase().includes(q.toLowerCase()) ||
        (p.name as string).toLowerCase().includes(q.toLowerCase())
      ).slice(0, 6);
      setSkuSuggestions(filtered.map((p: Record<string, unknown>) => ({ sku: p.sku as string, name: p.name as string })));
    } catch { /* ignore */ }
  };

  const createAlert = async () => {
    if (!formData.sku || !formData.targetPrice) return;
    setCreating(true);
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: formData.sku,
          targetPrice: parseFloat(formData.targetPrice),
          source: formData.source,
        }),
      });
      if (!res.ok) throw new Error("Failed to create alert");
      setSuccessMsg(`Alert created for ${formData.sku}!`);
      setFormData({ sku: "", targetPrice: "", source: "*" });
      setShowForm(false);
      setSkuSuggestions([]);
      setTimeout(() => setSuccessMsg(""), 3000);
      await fetchAlerts();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const deleteAlert = async (alertId: string) => {
    try {
      await fetch("/api/alerts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId }),
      });
      await fetchAlerts();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const sources = ["*", "shopee-sg", "lazada-sg", "amazon-sg", "amazon-us", "bestbuy-us", "google-flights", "singapore-air", "booking-com", "agoda", "expedia", "ticketmaster"];

  if (loading && alerts.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-40 rounded-lg bg-secondary animate-pulse" />
            <div className="h-4 w-72 rounded-lg bg-secondary animate-pulse" />
          </div>
          <div className="h-10 w-28 rounded-xl bg-secondary animate-pulse" />
        </div>
        {/* Alert cards skeleton */}
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-secondary animate-pulse" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-48 rounded bg-secondary animate-pulse" />
                  <div className="h-3 w-24 rounded bg-secondary animate-pulse" />
                  <div className="flex gap-2 mt-2">
                    <div className="h-5 w-16 rounded-full bg-secondary animate-pulse" />
                    <div className="h-5 w-20 rounded-full bg-secondary animate-pulse" />
                    <div className="h-5 w-24 rounded-full bg-secondary animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Price Alerts</h1>
          <p className="text-sm text-muted mt-1">
            Get notified when prices drop below your target. Monitor deals across merchants and booking sites.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-hover transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Alert
        </button>
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm">
          <CheckCircle2 className="h-4 w-4 text-accent" />
          {successMsg}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm">
          <AlertCircle className="h-4 w-4 text-danger" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-xs text-muted hover:text-foreground">Dismiss</button>
        </div>
      )}

      {/* Create alert form */}
      {showForm && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h3 className="font-semibold text-sm">Create Price Alert</h3>

          {/* Product search with autocomplete */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              type="text"
              placeholder="Search product (e.g., MacBook Pro, flight to London)..."
              value={skuSearch}
              onChange={(e) => { setSkuSearch(e.target.value); searchProducts(e.target.value); }}
              className="w-full rounded-lg border border-border bg-background pl-9 pr-4 py-2 text-sm outline-none focus:border-primary transition-colors"
            />
            {skuSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-border bg-card shadow-lg z-10 overflow-hidden">
                {skuSuggestions.map(s => (
                  <button
                    key={s.sku}
                    onClick={() => {
                      setFormData(f => ({ ...f, sku: s.sku }));
                      setSkuSearch(`${s.name} (${s.sku})`);
                      setSkuSuggestions([]);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-secondary transition-colors"
                  >
                    <span className="font-medium">{s.name}</span>
                    <span className="text-muted ml-2 font-mono text-xs">{s.sku}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Target Price ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="100"
                value={formData.targetPrice}
                onChange={(e) => setFormData(f => ({ ...f, targetPrice: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Source</label>
              <select
                value={formData.source}
                onChange={(e) => setFormData(f => ({ ...f, source: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
              >
                {sources.map(s => (
                  <option key={s} value={s}>{s === "*" ? "All Sources" : s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setShowForm(false); setSkuSuggestions([]); }}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={createAlert}
              disabled={creating || !formData.sku || !formData.targetPrice}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {creating ? "Creating..." : "Create Alert"}
            </button>
          </div>
        </div>
      )}

      {/* Alert list */}
      {alerts.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted">
          <Bell className="h-10 w-10" />
          <p className="text-sm font-medium">No price alerts yet</p>
          <p className="text-xs">Create an alert to get notified when prices drop.</p>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-colors mt-2"
          >
            <Plus className="h-4 w-4" /> Create Your First Alert
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.alertId}
              className="group rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="shrink-0 rounded-lg bg-primary/10 p-2">
                    <Bell className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm">{alert.productName}</h3>
                    <p className="text-xs text-muted font-mono">{alert.sku}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                        ↓ ${alert.targetPrice.toFixed(2)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted">
                        {alert.targetSource === "*" ? "🌍 All sources" : `📍 ${alert.targetSource}`}
                      {alert.triggered && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                          ⚡ Triggered — ${alert.currentLowest?.toFixed(2)}
                        </span>
                      )}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted">
                        🕐 {new Date(alert.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => deleteAlert(alert.alertId)}
                  className="shrink-0 rounded-lg p-2 text-muted hover:text-danger hover:bg-danger/10 transition-colors opacity-0 group-hover:opacity-100"
                  title="Delete alert"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
