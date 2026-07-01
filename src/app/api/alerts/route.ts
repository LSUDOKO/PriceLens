import { NextRequest, NextResponse } from "next/server";
import {
  getAlertsByUser,
  putAlert,
  deleteAlert,
  getAllProducts,
  getPrices,
} from "@/lib/db-adapter";
import { v4 as uuidv4 } from "uuid";

// Enrich alerts with product names and current price status
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId") || "default-user";
    const alerts = await getAlertsByUser(userId);

    // Enrich alerts with product names + current price comparison
    const allProducts = await getAllProducts();
    const enriched = await Promise.all(alerts.map(async (alert: Record<string, unknown>) => {
      const product = allProducts.find(
        (p: Record<string, unknown>) => p.sku === alert.sku
      );

      // Check current prices vs alert target
      let currentLowest: number | null = null;
      let triggered = false;
      let currentCheapestSource: string | null = null;

      const prices = await getPrices(alert.sku as string);
      if (prices.length > 0) {
        const targetSource = alert.targetSource as string;
        const filtered = targetSource === "*"
          ? prices
          : prices.filter((p: Record<string, unknown>) => p.source === targetSource);

        if (filtered.length > 0) {
          const sorted = [...filtered].sort(
            (a: Record<string, unknown>, b: Record<string, unknown>) =>
              (a.pricePerUnit as number) - (b.pricePerUnit as number)
          );
          currentLowest = sorted[0].pricePerUnit as number;
          currentCheapestSource = sorted[0].source as string;
          triggered = currentLowest <= (alert.targetPrice as number);
        }
      }

      return {
        ...alert,
        productName: (product?.name as string) || (alert.sku as string),
        currentLowest,
        currentCheapestSource,
        triggered,
      };
    }));

    return NextResponse.json({ alerts: enriched });
  } catch (err) {
    console.error("API Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sku, targetPrice, source } = body;

    if (!sku) {
      return NextResponse.json(
        { error: "sku is required" },
        { status: 400 }
      );
    }

    // Validate targetPrice
    const price = Number(targetPrice);
    if (targetPrice === undefined || targetPrice === null || isNaN(price) || price <= 0) {
      return NextResponse.json(
        { error: "targetPrice must be a positive number" },
        { status: 400 }
      );
    }

    const alertId = uuidv4();
    await putAlert({
      userId: "default-user",
      alertId,
      sku,
      targetSource: source || "*",
      targetPrice: price,
      createdAt: Date.now(),
    });

    // Get product name
    const allProducts = await getAllProducts();
    const product = allProducts.find(
      (p: Record<string, unknown>) => p.sku === sku
    );

    return NextResponse.json({
      success: true,
      alert: {
        alertId,
        sku,
        targetSource: source || "*",
        targetPrice: price,
        productName: (product?.name as string) || sku,
      },
    });
  } catch (err) {
    console.error("API Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { alertId } = body;

    if (!alertId) {
      return NextResponse.json(
        { error: "alertId is required" },
        { status: 400 }
      );
    }

    await deleteAlert("default-user", alertId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("API Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
