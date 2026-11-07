import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import createLoader from './load-typescript.mjs';

const ORDER_ID = '5O190127TN364715T';
const input = {
  orderId: ORDER_ID, tierId: 'sprint',
  task: 'Draft a useful email workflow for testing.', operator: 'Test Operator',
};
const paid = {
  id: ORDER_ID, status: 'COMPLETED', payer: { email_address: 'test@example.invalid' },
  purchase_units: [{ custom_id: 'sprint', payments: { captures: [{
    id: 'SYNTHETICCAPTURE', status: 'COMPLETED', amount: { currency_code: 'USD', value: '10.00' },
  }] } }],
};

function setup(t, testDelay = 40) {
  for (const [key, value] of Object.entries({
    PAYPAL_ENVIRONMENT: 'sandbox', PAYPAL_CLIENT_ID: 'synthetic-client',
    PAYPAL_CLIENT_SECRET: 'synthetic-secret', DOWNLOAD_TOKEN_SECRET: 'synthetic-signing',
    PAYPAL_WEBHOOK_ID: 'synthetic-webhook', BLOB_READ_WRITE_TOKEN: 'synthetic-blob',
  })) {
    const old = process.env[key];
    process.env[key] = value;
    t.after(() => { if (old === undefined) delete process.env[key]; else process.env[key] = old; });
  }
  t.mock.method(Date, 'now', () => 1_700_000_000_000);
  const errors = [];
  t.mock.method(console, 'error', (...args) => errors.push(args));
  const budgets = [];
  const timeout = globalThis.setTimeout;
  // Exercise real timers and abort events quickly; preserve test-runner timers.
  t.mock.method(globalThis, 'setTimeout', (callback, ms, ...args) => {
    if (ms === 15000 || ms === 5000) { budgets.push(ms); ms = testDelay; }
    return timeout(callback, ms, ...args);
  });
  return { budgets, errors };
}

function stalled(signal) {
  assert.ok(signal instanceof AbortSignal, 'network operation needs a deadline signal');
  return new Promise((resolve, reject) => {
    if (signal.aborted) reject(signal.reason);
    else signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
}

function post(load, path = 'capture-order', body = input) {
  return load(`@/app/api/paypal/${path}/route`).POST(new Request(`http://localhost/api/paypal/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));
}

function expectedReceipt(load) {
  const token = load('@/lib/tokens').signDownloadToken({
    issuedAt: 1_700_000_000_000, kind: 'protocol', operator: input.operator,
    orderId: 'SYNTHETICCAPTURE', task: input.task, tierId: 'sprint',
  });
  return {
    amount: '10.00', captureId: 'SYNTHETICCAPTURE', payerEmail: 'test@example.invalid',
    downloadUrl: `/api/protocol/download?token=${encodeURIComponent(token)}`,
  };
}

for (const phase of ['headers', 'body']) {
  test(`stalled OAuth ${phase} fails before capture and a later request recovers`, { timeout: 5000 }, async (t) => {
    const { budgets } = setup(t);
    let unavailable = true;
    let captures = 0;
    t.mock.method(globalThis, 'fetch', async (url, init) => {
      if (url.endsWith('/v1/oauth2/token')) {
        if (unavailable) {
          if (phase === 'headers') return stalled(init.signal);
          return { ok: true, json: () => stalled(init.signal) };
        }
        return Response.json({ access_token: 'synthetic-access' });
      }
      captures++;
      return Response.json(paid);
    });
    const load = createLoader({ '@/lib/order-events': { summarizeTask: () => ({}), safelyLogOrderEvent: async () => {} } });
    const failed = await post(load);
    assert.equal(failed.status, 500);
    const result = await failed.json();
    assert.equal(result.downloadUrl, undefined);
    assert.match(result.error, /aborted|timed out|timeout/i);
    assert.equal(captures, 0);
    assert.deepEqual(budgets, [15000]);
    unavailable = false;
    const recovered = await post(load);
    assert.equal(recovered.status, 200);
    assert.deepEqual(await recovered.json(), expectedReceipt(load));
    assert.equal(captures, 1);
  });
}

test('a capture committed before its response body stalls recovers the identical signed receipt', { timeout: 5000 }, async (t) => {
  const { budgets } = setup(t);
  const keys = [];
  let captures = 0;
  const load = createLoader({ '@/lib/order-events': { summarizeTask: () => ({}), safelyLogOrderEvent: async () => {} } });
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    if (url.endsWith('/v1/oauth2/token')) return Response.json({ access_token: 'synthetic-access' });
    keys.push(init.headers['PayPal-Request-Id']);
    if (keys.length === 1) {
      captures++;
      return { ok: true, json: () => stalled(init.signal) };
    }
    assert.equal(keys[1], keys[0], 'retry must use the committed capture key');
    return Response.json(paid);
  });
  const failed = await post(load);
  assert.equal(failed.status, 500);
  assert.match((await failed.json()).error, /aborted|timed out|timeout/i);
  const recovered = await post(load);
  assert.equal(recovered.status, 200);
  const receipt = await recovered.json();
  assert.deepEqual(receipt, expectedReceipt(load));
  assert.equal(captures, 1);
  assert.deepEqual(budgets, [15000, 15000, 15000, 15000]);
  const token = new URL(receipt.downloadUrl, 'http://localhost').searchParams.get('token');
  const download = await load('@/app/api/protocol/download/route').GET(new Request(`http://localhost/api/protocol/download?token=${token}`));
  assert.equal(download.status, 200);
  assert.equal(Buffer.from(await download.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
});

test('a stalled optional Blob write aborts without changing the paid receipt', { timeout: 5000 }, async (t) => {
  const { budgets, errors } = setup(t);
  let aborted = false;
  const load = createLoader({ '@vercel/blob': { put: async (path, body, options) => {
    assert.equal(options.access, 'private');
    const record = JSON.parse(body);
    assert.equal(record.downloadIssued, true);
    assert.equal(record.captureId, 'SYNTHETICCAPTURE');
    try { await stalled(options.abortSignal); }
    catch (error) { aborted = options.abortSignal?.aborted === true; throw error; }
  } } });
  t.mock.method(globalThis, 'fetch', async (url) => url.endsWith('/v1/oauth2/token')
    ? Response.json({ access_token: 'synthetic-access' }) : Response.json(paid));
  const response = await post(load);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), expectedReceipt(load));
  assert.equal(aborted, true);
  assert.deepEqual(budgets, [15000, 15000, 5000]);
  assert.equal(errors.length, 1);
  assert.equal(errors[0][0], '[tokenmaxxerpro][order-event-failed]');
});

test('create-order shares the bounded transport without automatically repeating payment operations', { timeout: 5000 }, async (t) => {
  const { budgets } = setup(t);
  let orders = 0;
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    if (url.endsWith('/v1/oauth2/token')) return Response.json({ access_token: 'synthetic-access' });
    orders++;
    return stalled(init.signal);
  });
  const response = await post(createLoader(), 'create-order', input);
  assert.equal(response.status, 500);
  assert.match((await response.json()).error, /aborted|timed out|timeout/i);
  assert.equal(orders, 1);
  assert.deepEqual(budgets, [15000, 15000]);
});

function webhook(load) {
  return load('@/app/api/paypal/webhook/route').POST(new Request('http://localhost/api/paypal/webhook', {
    method: 'POST', headers: Object.fromEntries([
      'paypal-auth-algo', 'paypal-cert-url', 'paypal-transmission-id', 'paypal-transmission-sig', 'paypal-transmission-time',
    ].map((name) => [name, 'synthetic'])),
    body: JSON.stringify({ id: 'SYNTHETICEVENT', event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: { id: 'SYNTHETICCAPTURE', status: 'COMPLETED', supplementary_data: { related_ids: { order_id: ORDER_ID } } } }),
  }));
}

for (const phase of ['verification', 'enrichment']) {
  test(`webhook ${phase} stalls preserve the verification boundary`, { timeout: 5000 }, async (t) => {
    const { budgets, errors } = setup(t);
    const records = [];
    t.mock.method(globalThis, 'fetch', async (url, init) => {
      if (url.endsWith('/v1/oauth2/token')) return Response.json({ access_token: 'synthetic-access' });
      if (url.endsWith('/verify-webhook-signature') && phase === 'enrichment') return Response.json({ verification_status: 'SUCCESS' });
      return stalled(init.signal);
    });
    const load = createLoader({ '@/lib/order-events': { safelyLogOrderEvent: async (record) => records.push(record) } });
    const response = await webhook(load);
    if (phase === 'verification') {
      assert.equal(response.status, 500);
      assert.match((await response.json()).error, /aborted|timed out|timeout/i);
      assert.equal(records.length, 0);
      assert.deepEqual(budgets, [15000, 15000]);
    } else {
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { eventType: 'PAYMENT.CAPTURE.COMPLETED', received: true, tracked: true, verified: true });
      assert.equal(records.length, 1);
      assert.equal(records[0].verified, true);
      assert.equal(records[0].tierId, undefined);
      assert.equal(errors[0][0], '[tokenmaxxerpro][webhook-order-enrichment-failed]');
      assert.deepEqual(budgets, [15000, 15000, 15000, 15000]);
    }
  });
}

test('native fetch aborts a stalled response body from a synthetic loopback provider', { timeout: 5000 }, async (t) => {
  const { budgets } = setup(t, 200);
  const nativeFetch = globalThis.fetch;
  const server = createServer((request, response) => {
    if (request.url.endsWith('/v1/oauth2/token')) {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ access_token: 'synthetic-access' }));
    } else {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.write('{"id":'); // Headers arrive, JSON never completes.
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  t.mock.method(globalThis, 'fetch', (url, init) => {
    assert.ok(init.signal instanceof AbortSignal);
    return nativeFetch(`http://127.0.0.1:${server.address().port}${new URL(url).pathname}`, init);
  });
  const response = await post(createLoader());
  assert.equal(response.status, 500);
  assert.match((await response.json()).error, /aborted|timed out|timeout/i);
  assert.deepEqual(budgets, [15000, 15000]);
});

test('a transport that ignores abort cannot keep optional storage on the fulfillment path', { timeout: 5000 }, async (t) => {
  const { budgets, errors } = setup(t);
  let signal;
  let rejectStorage;
  const load = createLoader({ '@vercel/blob': { put: (path, body, options) => {
    signal = options.abortSignal;
    return new Promise((resolve, reject) => { rejectStorage = reject; });
  } } });
  t.mock.method(globalThis, 'fetch', async (url) => url.endsWith('/v1/oauth2/token')
    ? Response.json({ access_token: 'synthetic-access' }) : Response.json(paid));
  const response = await post(load);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), expectedReceipt(load));
  assert.equal(signal.aborted, true);
  assert.deepEqual(budgets, [15000, 15000, 5000]);
  assert.equal(errors.length, 1);
  // A transport may settle after the caller has returned. Promise.race must
  // consume that late rejection rather than create an unhandled rejection.
  rejectStorage(new Error('Synthetic late storage failure'));
  await new Promise((resolve) => setImmediate(resolve));
});

test('deadline ownership clears its timer after success and synchronous failure', async (t) => {
  const timers = [];
  const cleared = [];
  t.mock.method(globalThis, 'setTimeout', () => { const timer = {}; timers.push(timer); return timer; });
  t.mock.method(globalThis, 'clearTimeout', (timer) => cleared.push(timer));
  const run = createLoader()('@/lib/network-deadline').withNetworkDeadline;
  let signal;
  assert.equal(await run(15000, async (value) => { signal = value; return 'fixture'; }), 'fixture');
  assert.equal(signal.aborted, false);
  await assert.rejects(run(5000, () => { throw new Error('Synthetic synchronous failure'); }), /synchronous failure/);
  assert.deepEqual(cleared, timers);
  assert.equal(timers.length, 2);
});

test('the installed Blob SDK aborts a stalled synthetic upload response', { timeout: 5000 }, async (t) => {
  const { budgets, errors } = setup(t, 200);
  let requests = 0;
  const server = createServer((request, response) => {
    requests++;
    assert.equal(request.method, 'PUT');
    request.resume();
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.write('{"url":');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const oldUrl = process.env.VERCEL_BLOB_API_URL;
  process.env.VERCEL_BLOB_API_URL = `http://127.0.0.1:${server.address().port}`;
  t.after(() => {
    server.closeAllConnections(); server.close();
    if (oldUrl === undefined) delete process.env.VERCEL_BLOB_API_URL;
    else process.env.VERCEL_BLOB_API_URL = oldUrl;
  });
  await createLoader()('@/lib/order-events').safelyLogOrderEvent({
    provider: 'paypal', source: 'capture-route', eventType: 'PAYMENT.CAPTURE.COMPLETED',
    orderId: ORDER_ID, verified: true,
  });
  assert.equal(requests, 1);
  assert.deepEqual(budgets, [5000]);
  assert.equal(errors.length, 1);
  assert.equal(errors[0][0], '[tokenmaxxerpro][order-event-failed]');
});
