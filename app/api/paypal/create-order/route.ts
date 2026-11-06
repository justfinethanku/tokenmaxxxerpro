import { NextResponse } from "next/server";

import { assertPdfTextSupported, UnsupportedPdfTextError } from "@/lib/pdf-fonts";
import { createPayPalOrder } from "@/lib/paypal";
import { getTierById, normalizeOperator, normalizeTask } from "@/lib/products";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      operator?: unknown;
      task?: unknown;
      tierId?: string;
    };

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

    if (body.task != null && typeof body.task !== "string") {
      return NextResponse.json(
        { error: "Provide a mission string." },
        { status: 400 },
      );
    }

    if (body.operator != null && typeof body.operator !== "string") {
      return NextResponse.json(
        { error: "Provide an optional operator string." },
        { status: 400 },
      );
    }

    await assertPdfTextSupported(
      `${normalizeOperator(typeof body.operator === "string" ? body.operator : "")}\n${normalizeTask(typeof body.task === "string" ? body.task : "")}`,
    );

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
      { status: error instanceof UnsupportedPdfTextError ? 400 : 500 },
    );
  }
}
