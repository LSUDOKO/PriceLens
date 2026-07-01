import { NextRequest, NextResponse } from "next/server";
import {
  getAllProducts,
  getProductsByCategory,
  getPrices,
  getMergedPrices,
  getMergedAllPrices,
  getPrice,
  scanAllPrices,
  getLiveSourcesInfo,
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
      const [prices, product] = await Promise.all([
        getMergedPrices(sku),
        getAllProducts().then(products => products.find(
          (p: Record<string, unknown>) => p.sku === sku
        )),
      ]);
      return NextResponse.json({ product, prices });
    }

    if (type === "all") {
      const result = await getMergedAllPrices();
      return NextResponse.json({
        products: result.products,
        sources: result.sources,
        liveSourceCount: result.liveSourceCount,
        liveSources: result.liveSources,
      });
    }

    const [allPrices, liveInfo] = await Promise.all([
      scanAllPrices(),
      getLiveSourcesInfo(),
    ]);
    return NextResponse.json({ 
      prices: allPrices, 
      sources: PRICE_SOURCES,
      liveSourceCount: liveInfo.count,
      liveSources: liveInfo.sources,
    });
  } catch (err) {
    console.error("API Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
