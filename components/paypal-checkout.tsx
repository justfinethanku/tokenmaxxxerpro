"use client";

import { useState } from "react";
import {
  PayPalOneTimePaymentButton,
  PayPalProvider,
} from "@paypal/react-paypal-js/sdk-v6";

import { getTierById, type TierId } from "@/lib/products";

export type PaidCheckoutSuccess = {
  amount: string;
  captureId: string;
  downloadUrl: string;
  payerEmail?: string;
  tierName: string;
};

type PayPalCheckoutProps = {
  disabled: boolean;
  operator: string;
  task: string;
  tierId: Exclude<TierId, "free">;
  onError: (message: string) => void;
  onSuccess: (result: PaidCheckoutSuccess) => void;
};

function readErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.length > 0) {
    return error;
  }

  return "PayPal checkout failed before the protocol could be issued.";
}

export function PayPalCheckout({
  disabled,
  operator,
  task,
  tierId,
  onError,
  onSuccess,
}: PayPalCheckoutProps) {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const environment =
    process.env.NEXT_PUBLIC_PAYPAL_ENVIRONMENT === "live"
      ? "production"
      : "sandbox";
  const tier = getTierById(tierId);
  const [isCapturing, setIsCapturing] = useState(false);

  if (!clientId) {
    return (
      <div className="rounded-[28px] border border-danger/40 bg-danger/10 p-5 text-sm text-foreground/80">
        PayPal client configuration is missing. Add
        {" "}
        <code className="font-mono text-[12px] text-accent">
          NEXT_PUBLIC_PAYPAL_CLIENT_ID
        </code>
        {" "}
        to render checkout.
      </div>
    );
  }

  return (
    <PayPalProvider
      clientId={clientId}
      components={["paypal-payments"]}
      environment={environment}
      pageType="checkout"
    >
      <div className="space-y-3 rounded-[28px] border border-line-strong bg-panel p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted">
              PayPal Checkout
            </p>
            <p className="mt-2 text-sm text-foreground/76">
              {tier.name}
              {" "}
              is fulfilled immediately after payment capture.
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-accent">{tier.priceLabel}</p>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted">
              PDF delivery
            </p>
          </div>
        </div>

        <div
          className={disabled ? "pointer-events-none opacity-45" : undefined}
        >
          <PayPalOneTimePaymentButton
            createOrder={async () => {
              const response = await fetch("/api/paypal/create-order", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ tierId }),
              });

              const json = (await response.json()) as {
                error?: string;
                orderId?: string;
              };

              if (!response.ok || !json.orderId) {
                throw new Error(
                  json.error ?? "Unable to create a PayPal order for this tier.",
                );
              }

              return { orderId: json.orderId };
            }}
            disabled={disabled || isCapturing}
            onApprove={async ({ orderId }) => {
              if (!orderId) {
                throw new Error("PayPal did not return an order ID.");
              }

              setIsCapturing(true);

              try {
                const response = await fetch("/api/paypal/capture-order", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    operator,
                    orderId,
                    task,
                    tierId,
                  }),
                });

                const json = (await response.json()) as {
                  amount?: string;
                  captureId?: string;
                  downloadUrl?: string;
                  error?: string;
                  payerEmail?: string;
                };

                if (
                  !response.ok ||
                  !json.amount ||
                  !json.captureId ||
                  !json.downloadUrl
                ) {
                  throw new Error(
                    json.error ?? "Payment captured, but fulfillment failed.",
                  );
                }

                onSuccess({
                  amount: json.amount,
                  captureId: json.captureId,
                  downloadUrl: json.downloadUrl,
                  payerEmail: json.payerEmail,
                  tierName: tier.name,
                });
              } catch (error) {
                onError(readErrorMessage(error));
              } finally {
                setIsCapturing(false);
              }
            }}
            onCancel={() => {
              setIsCapturing(false);
              onError(
                "Checkout was canceled before the token burn protocol could be sealed.",
              );
            }}
            onError={(error) => {
              setIsCapturing(false);
              onError(readErrorMessage(error));
            }}
            presentationMode="popup"
            type="checkout"
          />
        </div>

        <p className="text-xs leading-6 text-foreground/60">
          PayPal processes the payment. TokenMaxxerPro delivers the PDF. Any
          actual token destruction happens on your own AI account, as nature
          intended.
        </p>
      </div>
    </PayPalProvider>
  );
}
