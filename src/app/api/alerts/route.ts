import { NextRequest, NextResponse } from "next/server";
import {
  getAlertsByUser,
  putAlert,
  deleteAlert,
  getAllProducts,
} from "@/lib/db-adapter";
import { v4 as uuidv4 } from "uuid";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId") || "default-user";
    const alerts = await getAlertsByUser(userId);

    // Enrich alerts with product names
    const allProducts = await getAllProducts();
    const enriched = alerts.map((alert: Record<string, unknown>) => {
      const product = allProducts.find(
        (p: Record<string, unknown>) => p.sku === alert.sku
      );
      return {
        ...alert,
        productName: (product?.name as string) || (alert.sku as string),
      };
    });

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
    const { sku, targetPrice, region } = body;

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
      targetSource: region || "*",
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
        targetSource: region || "*",
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
