import { NextResponse } from "next/server";

import { safelyLogOrderEvent, summarizeTask } from "@/lib/order-events";
import { assertPdfTextSupported, UnsupportedPdfTextError } from "@/lib/pdf-fonts";
import {
  assertCapturedPayment,
  capturePayPalOrder,
  isPayPalOrderId,
} from "@/lib/paypal";
import {
  getTierById,
  normalizeOperator,
  normalizeTask,
} from "@/lib/products";
import { signDownloadToken } from "@/lib/tokens";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      operator?: string;
      orderId?: string;
      task?: string;
      tierId?: string;
    };

    if (!body.orderId || !body.tierId || !body.task) {
      return NextResponse.json(
        { error: "Missing order, tier, or task information." },
        { status: 400 },
      );
    }

    if (!isPayPalOrderId(body.orderId)) {
      return NextResponse.json(
        { error: "Invalid PayPal order ID." },
        { status: 400 },
      );
    }

    const tier = getTierById(body.tierId);

    if (!tier.paymentRequired) {
      return NextResponse.json(
        { error: "This tier should not be routed through checkout." },
        { status: 400 },
      );
    }

    const normalizedTask = normalizeTask(body.task);

    if (normalizedTask.length < 18) {
      return NextResponse.json(
        { error: "Mission input is too short to compile into a paid protocol." },
        { status: 400 },
      );
    }

    const normalizedOperator = normalizeOperator(body.operator ?? "");
    await assertPdfTextSupported(`${normalizedOperator}\n${normalizedTask}`);
    const capturedOrder = await capturePayPalOrder(body.orderId);
    const capture = assertCapturedPayment(capturedOrder, tier.id);
    const taskSummary = summarizeTask(normalizedTask);

    const token = signDownloadToken({
      issuedAt: Date.now(),
      kind: "protocol",
      operator: normalizedOperator,
      orderId: capture.captureId,
      task: normalizedTask,
      tierId: tier.id,
    });

    await safelyLogOrderEvent({
      amount: capture.amount,
      captureId: capture.captureId,
      currencyCode: "USD",
      downloadIssued: true,
      eventId: capture.captureId,
      eventType: "PAYMENT.CAPTURE.COMPLETED",
      operator: normalizedOperator || undefined,
      orderId: body.orderId,
      payerEmail: capture.payerEmail,
      provider: "paypal",
      source: "capture-route",
      status: "COMPLETED",
      summary: `${tier.name} fulfilled immediately after browser capture.`,
      ...taskSummary,
      tierId: tier.id,
      verified: true,
    });

    return NextResponse.json({
      amount: capture.amount,
      captureId: capture.captureId,
      downloadUrl: `/api/protocol/download?token=${encodeURIComponent(token)}`,
      payerEmail: capture.payerEmail,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "PayPal payment capture failed.",
      },
      { status: error instanceof UnsupportedPdfTextError ? 400 : 500 },
    );
  }
}
