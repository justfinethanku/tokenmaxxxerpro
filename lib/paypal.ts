import { randomUUID } from "node:crypto";

import { getTierById, type Tier } from "@/lib/products";

const PAYPAL_API_BASE =
  process.env.PAYPAL_ENVIRONMENT === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

type PayPalOrder = {
  id: string;
  status?: string;
  payer?: {
    email_address?: string;
  };
  purchase_units?: Array<{
    amount?: {
      currency_code?: string;
      value?: string;
    };
    custom_id?: string;
    payments?: {
      captures?: Array<{
        amount?: {
          currency_code?: string;
          value?: string;
        };
        id?: string;
        status?: string;
      }>;
    };
  }>;
};

export type PayPalWebhookEvent = {
  id?: string;
  create_time?: string;
  event_type?: string;
  resource?: {
    amount?: {
      currency_code?: string;
      value?: string;
    };
    id?: string;
    status?: string;
    supplementary_data?: {
      related_ids?: {
        order_id?: string;
      };
    };
  };
  summary?: string;
};

type PayPalWebhookVerificationResponse = {
  verification_status?: "FAILURE" | "SUCCESS";
};

function getPayPalCredentials() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing PayPal credentials.");
  }

  return { clientId, clientSecret };
}

function formatOrderAmount(amount: number): string {
  return amount.toFixed(2);
}

async function getPayPalAccessToken(): Promise<string> {
  const { clientId, clientSecret } = getPayPalCredentials();
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );

  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const json = (await response.json()) as {
    access_token?: string;
    error_description?: string;
  };

  if (!response.ok || !json.access_token) {
    throw new Error(
      json.error_description ?? "Failed to retrieve PayPal access token.",
    );
  }

  return json.access_token;
}

async function paypalRequest<T>(
  path: string,
  init: RequestInit & { requestId?: string },
): Promise<T> {
  const accessToken = await getPayPalAccessToken();

  const response = await fetch(`${PAYPAL_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": init.requestId ?? randomUUID(),
      ...init.headers,
    },
  });

  const json = (await response.json()) as T & {
    details?: Array<{ description?: string }>;
    message?: string;
    name?: string;
  };

  if (!response.ok) {
    const detailMessage =
      json.details?.[0]?.description ?? json.message ?? json.name;

    throw new Error(detailMessage ?? "PayPal request failed.");
  }

  return json;
}

function readRequiredPayPalHeader(headers: Headers, headerName: string): string {
  const value = headers.get(headerName);

  if (!value) {
    throw new Error(`Missing PayPal header: ${headerName}`);
  }

  return value;
}

export async function createPayPalOrder(tier: Tier): Promise<{ orderId: string }> {
  const response = await paypalRequest<PayPalOrder>("/v2/checkout/orders", {
    method: "POST",
    body: JSON.stringify({
      intent: "CAPTURE",
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "TokenMaxxerPro",
            landing_page: "LOGIN",
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
          },
        },
      },
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: formatOrderAmount(tier.price),
          },
          custom_id: tier.id,
          description: `${tier.name} protocol PDF`,
          soft_descriptor: "TOKENMAXXER",
        },
      ],
    }),
  });

  return { orderId: response.id };
}

export function isPayPalOrderId(value: unknown): value is string {
  // Orders v2 accepts 1–36 uppercase ASCII letters/digits, never URL syntax.
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 36 &&
    !/[^A-Z0-9]/.test(value)
  );
}

function orderPath(orderId: string): string {
  if (!isPayPalOrderId(orderId)) {
    throw new Error("Invalid PayPal order ID.");
  }

  return `/v2/checkout/orders/${orderId}`;
}

export async function capturePayPalOrder(
  orderId: string,
  requestId?: string,
): Promise<PayPalOrder> {
  return paypalRequest<PayPalOrder>(`${orderPath(orderId)}/capture`, {
    method: "POST",
    requestId,
    headers: { Prefer: "return=representation" },
  });
}

export async function showPayPalOrder(orderId: string): Promise<PayPalOrder> {
  return paypalRequest<PayPalOrder>(orderPath(orderId), {
    method: "GET",
  });
}

export async function verifyPayPalWebhookSignature(args: {
  headers: Headers;
  webhookEvent: PayPalWebhookEvent;
  webhookId: string;
}): Promise<boolean> {
  const authAlgo = readRequiredPayPalHeader(args.headers, "paypal-auth-algo");
  const certUrl = readRequiredPayPalHeader(args.headers, "paypal-cert-url");
  const transmissionId = readRequiredPayPalHeader(
    args.headers,
    "paypal-transmission-id",
  );
  const transmissionSig = readRequiredPayPalHeader(
    args.headers,
    "paypal-transmission-sig",
  );
  const transmissionTime = readRequiredPayPalHeader(
    args.headers,
    "paypal-transmission-time",
  );

  const response = await paypalRequest<PayPalWebhookVerificationResponse>(
    "/v1/notifications/verify-webhook-signature",
    {
      method: "POST",
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_event: args.webhookEvent,
        webhook_id: args.webhookId,
      }),
    },
  );

  return response.verification_status === "SUCCESS";
}

export function resolveOrderIdFromWebhookEvent(
  event: PayPalWebhookEvent,
): string | undefined {
  const relatedOrderId =
    event.resource?.supplementary_data?.related_ids?.order_id;

  if (relatedOrderId) {
    return relatedOrderId;
  }

  if (event.event_type === "CHECKOUT.ORDER.APPROVED") {
    return event.resource?.id;
  }

  return undefined;
}

export function assertCapturedPayment(
  order: PayPalOrder,
  requestedTierId: string,
) {
  const tier = getTierById(requestedTierId);
  const purchaseUnit = order.purchase_units?.[0];
  const capture = purchaseUnit?.payments?.captures?.[0];
  const amountValue = capture?.amount?.value;
  const currencyCode = capture?.amount?.currency_code;

  if (order.status !== "COMPLETED" || capture?.status !== "COMPLETED") {
    throw new Error("PayPal order was not fully captured.");
  }

  if (purchaseUnit?.custom_id !== tier.id) {
    throw new Error("Captured order tier did not match the requested tier.");
  }

  if (currencyCode !== "USD" || amountValue !== formatOrderAmount(tier.price)) {
    throw new Error("Captured payment amount did not match the selected tier.");
  }

  return {
    amount: amountValue,
    captureId: capture.id ?? order.id,
    payerEmail: order.payer?.email_address,
    tier,
  };
}
