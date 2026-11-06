import assert from 'node:assert/strict';
import { test } from 'node:test';
import createLoader from './load-typescript.mjs';

function setEnv(t, key, value) {
  const previous = process.env[key];
  process.env[key] = value;
  t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
}

const ORDER_ID = '5O190127TN364715T';
const attack = '../../payments/captures/SYNTHETICCAPTURE/refund?ignored=';
function capturedOrder() {
  return { id: ORDER_ID, status: 'COMPLETED', purchase_units: [{
    custom_id: 'sprint', payments: { captures: [{ id: 'SYNTHETICCAPTURE', status: 'COMPLETED', amount: { currency_code: 'USD', value: '10.00' } }] },
  }] };
}
function setup(t, result = capturedOrder()) {
  setEnv(t, 'PAYPAL_ENVIRONMENT', 'sandbox');
  setEnv(t, 'PAYPAL_CLIENT_ID', 'local-test-client');
  setEnv(t, 'PAYPAL_CLIENT_SECRET', 'local-test-secret');
  const calls = [];
  t.mock.method(global, 'fetch', async (url, init) => {
    const request = new Request(url, init);
    calls.push({ url: request.url, method: request.method });
    return Response.json(calls.length % 2 ? { access_token: 'local-test-access' } : result);
  });
  return { calls, load: createLoader({
    '@/lib/order-events': { safelyLogOrderEvent: async () => {}, summarizeTask: () => ({}) },
  }) };
}

test('capture route blocks refund traversal before any authenticated request', async (t) => {
  const { calls, load } = setup(t);
  const response = await load('@/app/api/paypal/capture-order/route').POST(new Request('http://localhost/api/paypal/capture-order', {
    method: 'POST', body: JSON.stringify({ orderId: attack, tierId: 'sprint', task: 'Draft a useful email workflow for testing.' }),
  }));
  assert.equal(response.status, 400);
  assert.deepEqual(calls, []);
});

test('capture and lookup reject nonidentifiers before OAuth', async (t) => {
  const { calls, load } = setup(t);
  const paypal = load('@/lib/paypal');
  for (const id of [attack, '../OTHER', 'ORDER?x=', 'ORDER#fragment', 'ORDER/capture', 'ORDER\\capture', '%2e%2e%2fOTHER', '', 'A'.repeat(37), 'lowercase', 'ID\n', 123, {}, null]) {
    await assert.rejects(paypal.capturePayPalOrder(id), /Invalid PayPal order ID/);
    await assert.rejects(paypal.showPayPalOrder(id), /Invalid PayPal order ID/);
  }
  assert.deepEqual(calls, []);
});

test('valid identifiers retain exact capture and lookup endpoints', async (t) => {
  const { calls, load } = setup(t);
  const paypal = load('@/lib/paypal');
  assert.equal((await paypal.capturePayPalOrder(ORDER_ID)).id, ORDER_ID);
  assert.equal((await paypal.showPayPalOrder(ORDER_ID)).id, ORDER_ID);
  assert.deepEqual(calls.filter((_, i) => i % 2), [
    { method: 'POST', url: `https://api-m.sandbox.paypal.com/v2/checkout/orders/${ORDER_ID}/capture` },
    { method: 'GET', url: `https://api-m.sandbox.paypal.com/v2/checkout/orders/${ORDER_ID}` },
  ]);
});

test('fulfillment rejects incomplete, cheaper, wrong-currency and wrong-tier captures', () => {
  const { assertCapturedPayment } = createLoader()('@/lib/paypal');
  assert.equal(assertCapturedPayment(capturedOrder(), 'sprint').captureId, 'SYNTHETICCAPTURE');
  for (const change of [
    (o) => { o.status = 'APPROVED'; },
    (o) => { o.purchase_units[0].payments.captures[0].status = 'PENDING'; },
    (o) => { o.purchase_units[0].payments.captures[0].amount.value = '1.00'; },
    (o) => { o.purchase_units[0].payments.captures[0].amount.currency_code = 'EUR'; },
    (o) => { o.purchase_units[0].custom_id = 'pro'; },
    (o) => { o.purchase_units = []; },
  ]) {
    const order = capturedOrder(); change(order);
    assert.throws(() => assertCapturedPayment(order, 'sprint'));
  }
});

test('download signatures reject paid-tier tampering', (t) => {
  setEnv(t, 'DOWNLOAD_TOKEN_SECRET', 'local-test-signing-secret');
  const { signDownloadToken, verifyDownloadToken } = createLoader()('@/lib/tokens');
  const payload = { issuedAt: Date.now(), kind: 'protocol', tierId: 'free', task: 'Draft a useful email workflow for testing.' };
  const token = signDownloadToken(payload);
  assert.deepEqual(verifyDownloadToken(token), payload);
  const [, signature] = token.split('.');
  const tampered = Buffer.from(JSON.stringify({ ...payload, tierId: 'pro' })).toString('base64url');
  assert.equal(verifyDownloadToken(`${tampered}.${signature}`), null);
  assert.equal(verifyDownloadToken('invalid'), null);
});

test('webhook trust uses PayPal verification and rejects FAILURE', async (t) => {
  const { load } = setup(t, { verification_status: 'FAILURE' });
  const { verifyPayPalWebhookSignature } = load('@/lib/paypal');
  const headers = new Headers(Object.fromEntries(['auth-algo', 'cert-url', 'transmission-id', 'transmission-sig', 'transmission-time'].map(name => [`paypal-${name}`, 'synthetic-value'])));
  assert.equal(await verifyPayPalWebhookSignature({ headers, webhookEvent: { id: 'SYNTHETICEVENT' }, webhookId: 'SYNTHETICWEBHOOK' }), false);
  await assert.rejects(verifyPayPalWebhookSignature({ headers: new Headers(), webhookEvent: {}, webhookId: 'SYNTHETICWEBHOOK' }), /Missing PayPal header/);
});

// The public route still fulfills a valid paid order after the ID check.
test('valid paid capture returns a signed entitlement for the purchased tier', async (t) => {
  const { load } = setup(t);
  setEnv(t, 'DOWNLOAD_TOKEN_SECRET', 'local-test-signing-secret');
  const response = await load('@/app/api/paypal/capture-order/route').POST(new Request('http://localhost/api/paypal/capture-order', {
    method: 'POST', body: JSON.stringify({ orderId: ORDER_ID, tierId: 'sprint', task: 'Draft a useful email workflow for testing.' }),
  }));
  assert.equal(response.status, 200);
  const result = await response.json();
  const token = new URL(result.downloadUrl, 'http://localhost').searchParams.get('token');
  const payload = load('@/lib/tokens').verifyDownloadToken(token);
  assert.equal(payload.tierId, 'sprint');
  assert.equal(payload.orderId, 'SYNTHETICCAPTURE');
  assert.equal(result.amount, '10.00');
});
