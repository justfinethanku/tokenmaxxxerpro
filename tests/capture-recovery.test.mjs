import assert from 'node:assert/strict';
import { test } from 'node:test';
import createLoader from './load-typescript.mjs';

const ORDER_ID = '5O190127TN364715T';
const input = {
  orderId: ORDER_ID, tierId: 'sprint',
  task: 'Draft a useful email workflow for testing.', operator: 'Test Operator',
};

function env(t, key, value) {
  const previous = process.env[key];
  process.env[key] = value;
  t.after(() => {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  });
}

function capturedOrder() {
  return {
    id: ORDER_ID, status: 'COMPLETED',
    payer: { email_address: 'synthetic@example.invalid' },
    purchase_units: [{ custom_id: 'sprint', payments: { captures: [{
      id: 'SYNTHETICCAPTURE', status: 'COMPLETED',
      amount: { currency_code: 'USD', value: '10.00' },
    }] } }],
  };
}

function setup(t, { loseFirstResponse = false, minimalByDefault = false, logging = false, holdFirstResponse = false } = {}) {
  env(t, 'PAYPAL_ENVIRONMENT', 'sandbox');
  env(t, 'PAYPAL_CLIENT_ID', 'local-test-client');
  env(t, 'PAYPAL_CLIENT_SECRET', 'local-test-secret');
  env(t, 'DOWNLOAD_TOKEN_SECRET', 'local-test-signing-secret');
  const attempts = [];
  const logs = [];
  let committedKey;
  let captures = 0;
  let oauthUnavailable = false;
  let latestOrder = capturedOrder();
  let inFlight = false;
  let releaseFirst;
  let signalCapture;
  const responseGate = new Promise((resolve) => { releaseFirst = resolve; });
  const captureStarted = new Promise((resolve) => { signalCapture = resolve; });
  t.after(() => releaseFirst());
  // Model the provider contract: a committed capture is replayed only for its
  // original request ID. A different ID gets ORDER_ALREADY_CAPTURED.
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    const request = new Request(url, init);
    if (request.url === 'https://api-m.sandbox.paypal.com/v1/oauth2/token') {
      if (oauthUnavailable) return Response.json({ error_description: 'Synthetic OAuth outage' }, { status: 503 });
      return Response.json({ access_token: 'local-test-access' });
    }
    assert.equal(request.url, `https://api-m.sandbox.paypal.com/v2/checkout/orders/${ORDER_ID}/capture`);
    assert.equal(request.method, 'POST');
    const key = request.headers.get('PayPal-Request-Id');
    assert.ok(key);
    assert.ok(Buffer.byteLength(key) <= 38);
    attempts.push({ key, prefer: request.headers.get('Prefer') });
    if (committedKey && committedKey !== key) {
      return Response.json({ name: 'UNPROCESSABLE_ENTITY', details: [{ description: 'ORDER_ALREADY_CAPTURED' }] }, { status: 422 });
    }
    if (inFlight) {
      return Response.json({ details: [{ description: 'PREVIOUS_REQUEST_IN_PROGRESS' }] }, { status: 409 });
    }
    if (!committedKey) {
      captures += 1;
      committedKey = key;
      signalCapture();
      if (loseFirstResponse) throw new TypeError('Synthetic connection lost after capture committed');
      if (holdFirstResponse) {
        inFlight = true;
        await responseGate;
        inFlight = false;
      }
    }
    if (minimalByDefault && request.headers.get('Prefer') !== 'return=representation') {
      return Response.json({ id: ORDER_ID, status: latestOrder.status });
    }
    return Response.json(latestOrder);
  });
  const mocks = logging ? {} : {
    '@/lib/order-events': {
      safelyLogOrderEvent: async (record) => { logs.push(record); },
      summarizeTask: (task) => ({ taskLength: task.length }),
    },
  };
  return {
    attempts, logs, captureStarted, releaseFirst,
    freshLoader: () => createLoader(mocks),
    get captures() { return captures; },
    set oauthUnavailable(value) { oauthUnavailable = value; },
    set latestOrder(value) { latestOrder = value; },
  };
}

async function capture(load, body = input) {
  return load('@/app/api/paypal/capture-order/route').POST(new Request('http://localhost/api/paypal/capture-order', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));
}

function receipt(load, result) {
  const token = new URL(result.downloadUrl, 'http://localhost').searchParams.get('token');
  return { token, payload: load('@/lib/tokens').verifyDownloadToken(token) };
}

test('a lost committed capture response recovers across handlers with equivalent personalization', async (t) => {
  const provider = setup(t, { loseFirstResponse: true });
  const first = await capture(provider.freshLoader());
  assert.equal(first.status, 500);
  assert.equal((await first.json()).downloadUrl, undefined);
  assert.equal(provider.captures, 1);
  const load = provider.freshLoader();
  const retry = await capture(load, {
    ...input, task: `  ${input.task.replaceAll(' ', '\n  ')}  `, operator: '  Test\n Operator  ',
  });
  const result = await retry.json();
  assert.equal(retry.status, 200, JSON.stringify(result));
  assert.equal(provider.captures, 1);
  assert.equal(new Set(provider.attempts.map(({ key }) => key)).size, 1);
  const { token, payload } = receipt(load, result);
  assert.equal(payload.task, input.task);
  assert.equal(payload.operator, input.operator);
  assert.equal(payload.tierId, 'sprint');
  assert.equal(payload.orderId, 'SYNTHETICCAPTURE');
  assert.equal(result.amount, '10.00');
  const pdf = await load('@/app/api/protocol/download/route').GET(new Request(`http://localhost/api/protocol/download?token=${encodeURIComponent(token)}`));
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get('Cache-Control'), 'private, no-store, max-age=0');
  assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
  assert.equal(provider.logs.length, 1);
});

test('capture requests full representation instead of depending on minimal-response fields', async (t) => {
  const provider = setup(t, { minimalByDefault: true });
  const response = await capture(provider.freshLoader());
  assert.equal(response.status, 200, JSON.stringify(await response.json()));
  assert.equal(provider.attempts[0].prefer, 'return=representation');
});

for (const [field, value] of [
  ['task', 'Write a completely different personalized mission.'],
  ['operator', 'Different Operator'],
  ['tierId', 'pro'],
]) {
  test(`a completed order cannot replay fulfillment for a different ${field}`, async (t) => {
    const provider = setup(t);
    assert.equal((await capture(provider.freshLoader())).status, 200);
    const replay = await capture(provider.freshLoader(), {
      ...input, [field]: value, requestId: provider.attempts[0].key,
    });
    assert.equal(replay.status, 500);
    const result = await replay.json();
    assert.equal(result.downloadUrl, undefined);
    assert.match(result.error, /ORDER_ALREADY_CAPTURED/);
    assert.equal(provider.captures, 1);
    assert.notEqual(provider.attempts[0].key, provider.attempts[1].key);
    assert.equal(provider.logs.length, 1);
    // A rejected substitution must not prevent the original intent's recovery.
    assert.equal((await capture(provider.freshLoader())).status, 200);
    assert.equal(provider.captures, 1);
  });
}

test('provider outages fail closed, and the original capture can be retried', async (t) => {
  const provider = setup(t);
  provider.oauthUnavailable = true;
  const unavailable = await capture(provider.freshLoader());
  assert.equal(unavailable.status, 500);
  assert.equal((await unavailable.json()).downloadUrl, undefined);
  assert.equal(provider.captures, 0);
  provider.oauthUnavailable = false;
  assert.equal((await capture(provider.freshLoader())).status, 200);
  const replay = await capture(provider.freshLoader());
  assert.equal(replay.status, 200);
  assert.equal(provider.captures, 1);
});

test('concurrent capture conflict can recover without issuing a second payment', { timeout: 10000 }, async (t) => {
  const provider = setup(t, { holdFirstResponse: true });
  const first = capture(provider.freshLoader());
  await provider.captureStarted;
  try {
    const concurrent = await capture(provider.freshLoader());
    assert.equal(concurrent.status, 500);
    const result = await concurrent.json();
    assert.match(result.error, /PREVIOUS_REQUEST_IN_PROGRESS/);
    assert.equal(result.downloadUrl, undefined);
  } finally {
    provider.releaseFirst();
  }
  assert.equal((await first).status, 200);
  assert.equal((await capture(provider.freshLoader())).status, 200);
  assert.equal(provider.captures, 1);
  assert.equal(new Set(provider.attempts.map(({ key }) => key)).size, 1);
});

test('a replay must still validate the latest provider capture state', async (t) => {
  const provider = setup(t);
  assert.equal((await capture(provider.freshLoader())).status, 200);
  const latest = capturedOrder();
  latest.purchase_units[0].payments.captures[0].status = 'REFUNDED';
  provider.latestOrder = latest;
  const replay = await capture(provider.freshLoader());
  assert.equal(replay.status, 500);
  const result = await replay.json();
  assert.match(result.error, /not fully captured/);
  assert.equal(result.downloadUrl, undefined);
  assert.equal(provider.logs.length, 1);
});

test('an unusable signing configuration fails before capturing payment', async (t) => {
  const provider = setup(t);
  env(t, 'DOWNLOAD_TOKEN_SECRET', '');
  const response = await capture(provider.freshLoader());
  assert.equal(response.status, 500);
  assert.equal((await response.json()).downloadUrl, undefined);
  assert.equal(provider.captures, 0);
  assert.deepEqual(provider.attempts, []);
});

test('private event storage failure cannot consume a valid fulfillment receipt', async (t) => {
  const provider = setup(t, { logging: true });
  env(t, 'BLOB_READ_WRITE_TOKEN', 'synthetic-blob-write-token');
  const errors = [];
  t.mock.method(console, 'error', (...args) => { errors.push(args); });
  let writes = 0;
  const load = createLoader({ '@vercel/blob': { put: async () => {
    writes += 1;
    throw new Error('Synthetic private storage outage');
  } } });
  const response = await capture(load);
  assert.equal(response.status, 200);
  assert.equal(receipt(load, await response.json()).payload.orderId, 'SYNTHETICCAPTURE');
  assert.equal(provider.captures, 1);
  assert.equal(writes, 1);
  assert.equal(errors.length, 1);
  assert.equal(errors[0][0], '[tokenmaxxerpro][order-event-failed]');
});
