import { NextResponse } from "next/server";

import { createPayPalOrder } from "@/lib/paypal";
import { getTierById } from "@/lib/products";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { tierId?: string };

    if (!body.tierId) {
      return NextResponse.json(
        { error: "Missing tier ID." },
        { status: 400 },
      );
    }

    const tier = getTierById(body.tierId);

    if (!tier.paymentRequired) {
      return NextResponse.json(
        { error: "The free tier does not require checkout." },
        { status: 400 },
      );
    }

    const order = await createPayPalOrder(tier);

    return NextResponse.json(order);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create a PayPal order.",
      },
      { status: 500 },
    );
  }
}
