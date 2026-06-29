import { NextResponse } from "next/server";
import { healthCheck } from "@/lib/db-adapter";

export async function GET() {
  try {
    const health = await healthCheck();
    return NextResponse.json({
      status: health.status,
      store: health.store,
      tables: health.tables || null,
      products: health.productCount,
      prices: health.priceCount,
      recommendation:
        health.store === "memory"
          ? "Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to enable DynamoDB persistence"
          : "All systems operational",
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        message: (err as Error).message,
      },
      { status: 500 }
    );
  }
}
