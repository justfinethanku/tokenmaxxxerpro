# TokenMaxxerPro

Single-page Next.js app for selling absurdly serious token burn protocols.

The product model is simple:

- `Free`: generate a starter PDF protocol
- `$10`: sell a 500K sprint protocol
- `$50`: sell the flagship recursive burn operating system

The app does **not** spend your tokens. It sells structured PDF prompt systems that the buyer runs on their own AI account.

## Stack

- Next.js App Router
- Tailwind CSS v4
- PayPal custom checkout via server-side Orders API calls
- PayPal webhook verification and reconciliation
- `pdf-lib` for PDF generation
- optional Vercel Blob private storage for order event logs

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy envs if needed:

```bash
cp .env.example .env.local
```

3. Start the dev server:

```bash
npm run dev
```

4. Build for verification:

```bash
npm run build
```

## Required Env Vars

```bash
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_WEBHOOK_ID=
NEXT_PUBLIC_PAYPAL_CLIENT_ID=
NEXT_PUBLIC_PAYPAL_ENVIRONMENT=sandbox
DOWNLOAD_TOKEN_SECRET=
BLOB_READ_WRITE_TOKEN=
```

Notes:

- `NEXT_PUBLIC_PAYPAL_CLIENT_ID` is intentionally public and used by the client checkout SDK.
- `PAYPAL_CLIENT_SECRET` stays server-side only.
- `PAYPAL_WEBHOOK_ID` is the webhook ID from the PayPal app settings for the exact listener URL you subscribe.
- `DOWNLOAD_TOKEN_SECRET` signs protocol download links. Use a dedicated random value in production.
- `BLOB_READ_WRITE_TOKEN` is optional but recommended. If set, the app stores private order-event JSON blobs for reconciliation. If not set, it falls back to server logs.
- Switch both PayPal environment vars to `live` when you move to production credentials.

## App Flow

1. User enters a tiny task.
2. User selects a tier.
3. Free tier calls `/api/protocol/free`.
4. Paid tiers call `/api/paypal/create-order` and `/api/paypal/capture-order`.
5. Successful fulfillment returns a signed download URL.
6. `/api/protocol/download` generates the tier-specific PDF on demand.
7. `/api/paypal/webhook` verifies PayPal webhooks and logs capture events for reconciliation.

## Deploying To Vercel

1. Create a Vercel project from this repo/folder.
2. Add the live PayPal env vars in Vercel project settings.
3. Add `PAYPAL_WEBHOOK_ID` from the live PayPal webhook you configure for `https://your-domain.com/api/paypal/webhook`.
4. Optional but recommended: connect Vercel Blob and add `BLOB_READ_WRITE_TOKEN`.
5. Set `PAYPAL_ENVIRONMENT=live` and `NEXT_PUBLIC_PAYPAL_ENVIRONMENT=live`.
6. Redeploy.

## PayPal Webhook Setup

Subscribe the listener URL below in the PayPal Developer Dashboard for the same app whose client ID/secret you use:

```text
https://your-domain.com/api/paypal/webhook
```

Recommended event subscriptions:

- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.CAPTURE.PENDING`
- `PAYMENT.CAPTURE.DENIED`
- `CHECKOUT.ORDER.APPROVED`

The webhook ID created for that listener goes into `PAYPAL_WEBHOOK_ID`.

## Remaining Hardening
- add emailed receipt delivery
- add a small admin page for order-event search and re-issue
- persist buyer-facing fulfillment history keyed by capture ID

The current version is ready for a real launch once live PayPal credentials and the live webhook ID are configured.
