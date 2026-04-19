import { NextResponse } from "next/server";

import { safelyLogOrderEvent } from "@/lib/order-events";
import {
  resolveOrderIdFromWebhookEvent,
  showPayPalOrder,
  verifyPayPalWebhookSignature,
  type PayPalWebhookEvent,
} from "@/lib/paypal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRACKED_EVENT_TYPES = new Set([
  "CHECKOUT.ORDER.APPROVED",
  "PAYMENT.CAPTURE.COMPLETED",
  "PAYMENT.CAPTURE.DENIED",
  "PAYMENT.CAPTURE.PENDING",
]);

export async function POST(request: Request) {
  try {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;

    if (!webhookId) {
      return NextResponse.json(
        { error: "Missing PAYPAL_WEBHOOK_ID for webhook verification." },
        { status: 503 },
      );
    }

    const rawBody = await request.text();

    if (!rawBody) {
      return NextResponse.json(
        { error: "Webhook request body was empty." },
        { status: 400 },
      );
    }

    const webhookEvent = JSON.parse(rawBody) as PayPalWebhookEvent;
    const verified = await verifyPayPalWebhookSignature({
      headers: request.headers,
      webhookEvent,
      webhookId,
    });

    if (!verified) {
      return NextResponse.json(
        { error: "Webhook signature verification failed." },
        { status: 400 },
      );
    }

    const eventType = webhookEvent.event_type ?? "UNKNOWN";
    const orderId = resolveOrderIdFromWebhookEvent(webhookEvent);
    const captureId = webhookEvent.resource?.id;
    const amount = webhookEvent.resource?.amount?.value;
    const currencyCode = webhookEvent.resource?.amount?.currency_code;
    const status = webhookEvent.resource?.status;

    let payerEmail: string | undefined;
    let tierId: string | undefined;

    if (orderId) {
      try {
        const order = await showPayPalOrder(orderId);
        payerEmail = order.payer?.email_address;
        tierId = order.purchase_units?.[0]?.custom_id;
      } catch (error) {
        console.error("[tokenmaxxerpro][webhook-order-enrichment-failed]", {
          error:
            error instanceof Error
              ? error.message
              : "Unknown PayPal order enrichment error.",
          eventType,
          orderId,
        });
      }
    }

    if (TRACKED_EVENT_TYPES.has(eventType)) {
      await safelyLogOrderEvent({
        amount,
        captureId,
        currencyCode,
        eventId: webhookEvent.id,
        eventType,
        orderId,
        payerEmail,
        provider: "paypal",
        source: "paypal-webhook",
        status,
        summary: webhookEvent.summary,
        tierId,
        verified: true,
      });
    }

    return NextResponse.json({
      eventType,
      received: true,
      tracked: TRACKED_EVENT_TYPES.has(eventType),
      verified: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Webhook processing failed.",
      },
      { status: 500 },
    );
  }
}
