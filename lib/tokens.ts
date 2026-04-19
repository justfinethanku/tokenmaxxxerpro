import { createHmac, timingSafeEqual } from "node:crypto";

import type { TierId } from "@/lib/products";

export type DownloadTokenPayload = {
  issuedAt: number;
  kind: "protocol";
  operator?: string;
  orderId?: string;
  tierId: TierId;
  task: string;
};

function getSigningSecret(): string {
  const secret =
    process.env.DOWNLOAD_TOKEN_SECRET ?? process.env.PAYPAL_CLIENT_SECRET;

  if (!secret) {
    throw new Error("Missing DOWNLOAD_TOKEN_SECRET or PAYPAL_CLIENT_SECRET.");
  }

  return secret;
}

function signValue(value: string): string {
  return createHmac("sha256", getSigningSecret())
    .update(value)
    .digest("base64url");
}

export function signDownloadToken(payload: DownloadTokenPayload): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  const signature = signValue(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifyDownloadToken(
  token: string,
): DownloadTokenPayload | null {
  const [encodedPayload, providedSignature] = token.split(".");

  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = signValue(encodedPayload);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (providedBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  try {
    return JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as DownloadTokenPayload;
  } catch {
    return null;
  }
}
