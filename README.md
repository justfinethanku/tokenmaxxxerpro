# TokenMaxxerPro

Single-page Next.js app for selling absurdly serious token burn protocols.

The product model is simple:

- `Free`: generate a starter PDF protocol
- `$10`: sell a 500K sprint protocol
- `$50`: sell the flagship recursive burn operating system

The app does **not** spend your tokens. It sells structured PDF prompt systems that the buyer runs on their own AI account.

## Stack

- Next.js App Router and React
- Tailwind CSS v4
- PayPal custom checkout via server-side Orders API calls
- PayPal webhook signature verification and order-event logging
- `pdf-lib` for PDF generation
- Optional Vercel Blob private storage for order-event logs

## Run locally

Use Node.js 20.9 or later and npm. This setup was checked with Node.js 22.22.2 and npm 10.9.7 on Linux ARM64. See the [Next.js system requirements](https://nextjs.org/docs/app/getting-started/installation#system-requirements).

1. From the repository root, install the locked dependencies:

   ```bash
   npm ci
   ```

2. Start the development server with a synthetic local signing key:

   ```bash
   DOWNLOAD_TOKEN_SECRET=local-demo-only-do-not-use-in-production npm run dev -- --hostname 127.0.0.1
   ```

   Open `http://127.0.0.1:3000`. This configuration supports the free PDF flow without PayPal credentials. The demo key is public and is only for local testing. There is no `.env.example` to copy. For configured environments, inject the values in the configuration table through your environment provisioning; Fleet-managed secrets come from Fleet.

3. Enter a mission of at least 18 characters and generate the free protocol. The download should return a PDF attachment named `tokenmaxxerpro-free-protocol-manual.pdf`. Operator names and missions can include emoji and Chinese text. Characters the vendored fonts cannot draw are rejected before a link is issued.

4. Stop the server with Ctrl+C before switching to a production build in the same checkout.

Without a signing key, the homepage still loads, but free issuance returns HTTP 500 with `Missing DOWNLOAD_TOKEN_SECRET or PAYPAL_CLIENT_SECRET.` A passing build alone does not verify fulfillment.

### Check delivery over HTTP

With the local server running, execute this from another terminal. It checks the real free-issuance and download routes without making a payment or saving a PDF:

```bash
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
const base = 'http://127.0.0.1:3000';
const issue = await fetch(`${base}/api/protocol/free`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ task: 'Write a local documentation verification plan.', operator: 'Local test' }),
});
assert.equal(issue.status, 200);
const { downloadUrl } = await issue.json();
const pdf = await fetch(new URL(downloadUrl, base));
assert.equal(pdf.status, 200);
assert.equal(pdf.headers.get('content-type'), 'application/pdf');
const bytes = Buffer.from(await pdf.arrayBuffer());
assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
console.log(`PDF delivery passed: ${bytes.length} bytes`);
JS
```

### Run checks and the production server

Run the checks from the repository root:

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

`npm test` runs the Node test runner with at most two test files concurrently. Tests use synthetic credentials and mocked PayPal requests; they do not charge an account. Run lint separately because a successful build does not establish that lint passed. The first development start or build generates the ignored Next.js TypeScript support files. The build fetches Google Fonts used by `app/layout.tsx`, so it needs network access to those font services.

After a successful build, start the production server with a local signing key:

```bash
DOWNLOAD_TOKEN_SECRET=local-demo-only-do-not-use-in-production npm start -- --hostname 127.0.0.1
```

Repeat the HTTP delivery check. Stop the server with Ctrl+C.

## Configuration

Supply real credentials through the environment provisioning for the target deployment. Keep server secrets out of the browser and source control.

| Variable | Used for | Requirement and behavior |
| --- | --- | --- |
| `DOWNLOAD_TOKEN_SECRET` | Signing and verifying every PDF link, including free links | Set a dedicated random production secret. The code falls back to `PAYPAL_CLIENT_SECRET` only when this variable is absent; an empty value does not fall back. |
| `PAYPAL_CLIENT_ID` | Server Orders API and webhook verification | Required for paid checkout and webhook verification; use the same app as the public client ID. |
| `PAYPAL_CLIENT_SECRET` | Server PayPal OAuth | Required for paid checkout and webhook verification. Keep server-side. |
| `PAYPAL_ENVIRONMENT` | Server API host | Exact value `live` selects live PayPal; absent or any other value selects sandbox. |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | Browser checkout SDK | Public by design. Without it, paid enrollment displays a configuration error. |
| `NEXT_PUBLIC_PAYPAL_ENVIRONMENT` | Browser SDK environment | Exact value `live` selects production; absent or any other value selects sandbox. Match the server environment. |
| `PAYPAL_WEBHOOK_ID` | Verification of the subscribed listener | Required for webhooks, not for free delivery or direct checkout capture. Missing value returns HTTP 503 at the webhook route. |
| `BLOB_READ_WRITE_TOKEN` | Private order-event JSON storage | Optional. Without it, records go to server logs. Storage errors are logged and do not block checkout fulfillment. |

Public `NEXT_PUBLIC_` values are included in the browser bundle at build time. Rebuild after changing them; restarting an existing production build does not replace them. See [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables).

Download tokens include the mission and operator as base64url JSON, signed with HMAC; signing does not encrypt them. Treat the full download URL as a bearer link. Tokens have an issuance timestamp but no enforced expiry. Changing the signing secret invalidates previously issued links, so preserve it across redeployments unless invalidation is intended.

## App flow

1. The user enters a task and selects a tier (`free`, `sprint`, or `pro`).
2. The free tier calls `POST /api/protocol/free` and receives a signed download URL.
3. Paid tiers call `POST /api/paypal/create-order`, then `POST /api/paypal/capture-order` after PayPal approval. The server checks the captured status, tier, USD currency and amount before signing a download URL.
4. `GET /api/protocol/download?token=...` verifies the signature and generates the PDF on demand with private, uncached attachment headers. The signed token stores the mission and operator. It does not store a rendered file, so a link that was issued before Unicode fonts were added is rendered by the current fonts when it is opened. Personalization those fonts cannot draw returns HTTP 400 with an explanation instead of failing inside the PDF font.
5. `POST /api/paypal/webhook` verifies notifications, attempts order enrichment and logs tracked events. It does not issue replacement links, email receipts or maintain buyer-facing fulfillment history.

Tasks are whitespace-normalized, trimmed and limited to 420 characters; operators are limited to 120. Free issuance requires a normalized task of at least 18 characters. The catalog and prices live in [lib/products.ts](lib/products.ts).

### Capture retries

For captures first attempted with this version, if a capture response is lost, an API caller can retry `POST /api/paypal/capture-order` with the **same order ID, tier, mission and operator**. The server derives a stable HMAC request ID from those normalized values and requests PayPal's full capture representation. A retry can recover the paid download while PayPal retains that request ID; it still checks the current captured status, tier, currency and amount before issuing a link. Supplying a request ID in the JSON body has no effect. Changing the mission, operator or tier uses a different request ID and cannot recover the original capture.

Keep the original inputs and signing secret available during recovery. Secret rotation changes the derived request ID. Do not create and approve a second order merely to recover a missing response: that is a separate payment. Simultaneous attempts may receive a provider conflict; retry the original request after it settles. See [PayPal idempotency](https://developer.paypal.com/api/rest/reference/idempotency/) for provider retention and concurrency limits. The browser does not automatically retry or retain this recovery request across a reload, and there is no durable receipt store or recovery after provider retention expires. These tests use a synthetic provider, not a live payment.

Each PayPal network operation, including OAuth and response-body reading, has a 15-second deadline. The server does not automatically repeat a PayPal operation after a timeout. A capture timeout does **not** prove the payment failed: recover using the same request above. OAuth and the subsequent API request have separate deadlines, so 15 seconds is not a total checkout limit. Optional private event uploads have a separate 5-second deadline; upload failures are logged and the signed receipt still returns. The deadline aborts the underlying request and returns control even if the transport ignores cancellation or the SDK is waiting to retry. A timed-out capture or upload may already have reached the provider. These deadlines do not bound local PDF work.

## Configure PayPal and deployment

For sandbox verification, provision sandbox app credentials, both client IDs, a signing secret, and both environment values as `sandbox` before building. Use a sandbox buyer to check order creation, approval, capture and the resulting PDF. The automated tests cover mocked payment boundaries; this documentation audit did not exercise a real sandbox or live payment.

For Vercel, import this repository and provision the variables for the intended deployment environment. For live checkout, use live app credentials and set both PayPal environment values to `live` before rebuilding and redeploying. Keep preview deployments on sandbox credentials. Optional private Vercel Blob storage provides persisted event records; console logs alone are not a fulfillment database.

Subscribe the deployed HTTPS listener in the PayPal dashboard for the same app and environment whose credentials the server uses:

```text
https://YOUR_DOMAIN/api/paypal/webhook
```

Replace `YOUR_DOMAIN` with the deployment's domain. Set the resulting listener ID as `PAYPAL_WEBHOOK_ID`. The route tracks these events:

- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.CAPTURE.PENDING`
- `PAYMENT.CAPTURE.DENIED`
- `CHECKOUT.ORDER.APPROVED`

PayPal subscriptions are app-specific; see the [PayPal webhooks overview](https://developer.paypal.com/api/rest/webhooks/). A plain unsigned POST is not a successful verification check. Inspect actual verified notifications and server records after a sandbox checkout before assessing payment readiness.

## Troubleshoot operations

| Symptom | Check |
| --- | --- |
| Free issuance returns HTTP 500 with a missing signing-secret error | Provision a nonempty `DOWNLOAD_TOKEN_SECRET` and restart the local server or redeploy. |
| Paid enrollment shows `PayPal client configuration is missing.` | Set `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, then rebuild the production bundle. |
| Orders return `Missing PayPal credentials.` | Check server client ID/secret provisioning. Confirm both server and browser use the same PayPal app/environment. |
| Webhook returns HTTP 503 | Provision the listener's `PAYPAL_WEBHOOK_ID`. Signature verification also needs server PayPal credentials. |
| Checkout succeeds but private event records are absent | Inspect `[tokenmaxxerpro][order-event-failed]` logs and Blob provisioning. Without a Blob token, inspect `[tokenmaxxerpro][order-event]` console records. |
| A previously working download stops validating | Check whether the signing secret changed. There is no implemented self-service reissue or receipt-email flow. |
| A signed download returns HTTP 400 because characters cannot be embedded | The mission or operator uses a character outside the vendored Noto fonts. Remove it and issue a new protocol. Previously issued links render on download, so this response replaces the old WinAnsi font error. |

Order-event records can contain payer email, operator and a task preview. Keep log and private Blob access appropriate for those records. Avoid pasting full signed download URLs into support logs.

## Known limitations

- Protocol PDFs draw ASCII with the standard PDF fonts and draw other supported characters with Noto Sans, Noto Sans SC, and Noto Emoji files vendored in `assets/fonts`. Those files are not downloaded when a protocol is requested. Text outside that coverage, such as Arabic, is rejected before a free link is issued and before PayPal capture. Paid download uses the same renderer.
- Receipt email, an admin search/reissue page and persistent buyer-facing fulfillment history are not implemented.
- Webhook logging is best-effort and does not recover a failed browser fulfillment. Live payment readiness requires configured end-to-end verification; a build and webhook subscription alone do not prove it.
