import { NextRequest, NextResponse } from "next/server";
import {
  getAllProducts,
  getProductsByCategory,
  getPrices,
  getPrice,
  scanAllPrices,
} from "@/lib/db-adapter";
import { PRICE_SOURCES } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const sku = url.searchParams.get("sku");
    const source = url.searchParams.get("source");
    const category = url.searchParams.get("category");
    const type = url.searchParams.get("type") || "all";

    if (type === "products") {
      const products = category
        ? await getProductsByCategory(category)
        : await getAllProducts();
      return NextResponse.json({ products });
    }

    if (sku && source) {
      const price = await getPrice(sku, source);
      return NextResponse.json({ price });
    }

    if (sku) {
      const prices = await getPrices(sku);
      const product = (await getAllProducts()).find(
        (p: Record<string, unknown>) => p.sku === sku
      );
      return NextResponse.json({ product, prices });
    }

    if (type === "all") {
      const allPrices = await scanAllPrices();
      const products = await getAllProducts();

      // Group by product
      const grouped: Record<string, { product: Record<string, unknown>; prices: Record<string, unknown>[] }> = {};
      for (const p of allPrices) {
        const key = String(p.sku || "");
        if (!grouped[key]) {
          grouped[key] = { product: {}, prices: [] };
          const prod = products.find((pr) => String(pr.sku) === key);
          if (prod) grouped[key].product = prod;
        }
        grouped[key].prices.push(p);
      }

      return NextResponse.json({
        products: Object.values(grouped),
        sources: PRICE_SOURCES,
      });
    }

    return NextResponse.json({ prices: await scanAllPrices(), sources: PRICE_SOURCES });
  } catch (err) {
    console.error("API Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
