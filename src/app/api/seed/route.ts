import { NextRequest, NextResponse } from "next/server";
import { seedInitialData, getStoreType, healthCheck } from "@/lib/db-adapter";

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "true";

    // Check if already seeded
    const health = await healthCheck();

    if (health.productCount > 0 && !force) {
      return NextResponse.json({
        success: true,
        store: getStoreType(),
        status: health.status,
        message: `Data already exists (${health.productCount} products, ${health.priceCount} prices). Use ?force=true to re-seed.`,
        seeded: { products: health.productCount, prices: health.priceCount },
      });
    }

    const result = await seedInitialData(force);

    return NextResponse.json({
      success: true,
      store: getStoreType(),
      status: health.status,
      message: result.message || `Seeded ${result.products} products and ${result.prices} prices.`,
      seeded: {
        products: result.products,
        prices: result.prices,
        skipped: result.skipped,
      },
    });
  } catch (err) {
    console.error("Seed error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function GET() {
  const health = await healthCheck();
  return NextResponse.json({
    store: getStoreType(),
    status: health.status,
    products: health.productCount,
    prices: health.priceCount,
    needsSeeding: health.productCount === 0,
    seedEndpoint: "POST /api/seed",
  });
}
