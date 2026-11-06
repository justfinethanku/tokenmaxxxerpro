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

  return "Enrollment could not be completed before issuance.";
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
      <div role="alert" className="rounded-[24px] border border-danger/35 bg-danger/10 p-5 text-sm leading-6 text-foreground/82">
        PayPal client configuration is missing. Add
        {" "}
        <code className="font-mono text-[12px] text-accent-ember">
          NEXT_PUBLIC_PAYPAL_CLIENT_ID
        </code>
        {" "}
        to render enrollment.
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
      <div className="space-y-5 rounded-[28px] border border-line bg-black/16 p-5">
        <div className="flex items-start justify-between gap-4 border-b border-line pb-5">
          <div>
            <p className="eyebrow text-muted">PayPal Enrollment</p>
            <h3 className="mt-3 font-display text-[1.8rem] leading-none tracking-[-0.04em] text-foreground">
              {tier.name}
            </h3>
            <p className="mt-3 max-w-xs text-sm leading-6 text-foreground/66">
              Payment capture triggers immediate issuance of the dossier on this
              page.
            </p>
          </div>

          <div className="text-right">
            <p className="font-display text-[2rem] leading-none tracking-[-0.04em] text-accent-ember tabular-nums">
              {tier.priceLabel}
            </p>
            <p className="mt-2 eyebrow text-muted">Immediate delivery</p>
          </div>
        </div>

        <p role="status" className="sr-only">
          {isCapturing ? "Confirming payment and issuing dossier..." : ""}
        </p>

        <div className={disabled ? "pointer-events-none opacity-45" : undefined}>
          <PayPalOneTimePaymentButton
            createOrder={async () => {
              const response = await fetch("/api/paypal/create-order", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ operator, task, tierId }),
              });

              const json = (await response.json()) as {
                error?: string;
                orderId?: string;
              };

              if (!response.ok || !json.orderId) {
                throw new Error(
                  json.error ?? "Unable to create a PayPal order for this class.",
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
                    json.error ?? "Payment captured, but issuance failed.",
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
              onError("Enrollment was closed before payment capture.");
            }}
            onError={(error) => {
              setIsCapturing(false);
              onError(readErrorMessage(error));
            }}
            presentationMode="popup"
            type="checkout"
          />
        </div>

        <p className="text-xs leading-6 text-foreground/56">
          Payment is processed by PayPal. TokenMaxxerPro issues the protocol
          PDF. Compute usage remains entirely on the operator&apos;s account.
        </p>
      </div>
    </PayPalProvider>
  );
}
