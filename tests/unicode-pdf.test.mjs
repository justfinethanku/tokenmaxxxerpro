import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  decodePDFRawStream,
} from 'pdf-lib';
import createLoader from './load-typescript.mjs';

const ASCII_TASK = 'Draft a useful email workflow for testing.';
const ASCII_OPERATOR = 'Test Operator';
const EMOJI_TASK = 'Launch the rocket 🚀 protocol.';
const CHINESE_OPERATOR = '张伟'.repeat(30);
const UNSUPPORTED_TASK = 'Draft a useful protocol ا now.';

function configure(t) {
  const previous = process.env.DOWNLOAD_TOKEN_SECRET;
  process.env.DOWNLOAD_TOKEN_SECRET = 'synthetic-protocol-test-secret';
  t.after(() => {
    if (previous === undefined) delete process.env.DOWNLOAD_TOKEN_SECRET;
    else process.env.DOWNLOAD_TOKEN_SECRET = previous;
  });
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    calls.push(String(url));
    throw new Error('Unexpected network call');
  });
  return { calls, load: createLoader() };
}

function streamBytes(page, ref) {
  const stream = page.doc.context.lookup(ref, PDFRawStream);
  return Buffer.from(decodePDFRawStream(stream).decode());
}

function decodeUtf16BE(hex) {
  const bytes = Buffer.from(hex, 'hex');
  let text = '';
  for (let index = 0; index + 1 < bytes.length; index += 2) {
    text += String.fromCharCode((bytes[index] << 8) | bytes[index + 1]);
  }
  return text;
}

function parseToUnicode(cmap) {
  const map = new Map();
  for (const block of cmap.split(/beginbfchar\s*/).slice(1)) {
    const body = block.split('endbfchar')[0];
    for (const match of body.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      map.set(match[1].toUpperCase().padStart(4, '0'), decodeUtf16BE(match[2]));
    }
  }
  return map;
}

function fontDecoders(page) {
  const decoders = new Map();
  const resources = page.node.Resources();
  const fontEntry = resources?.get(PDFName.of('Font'));
  if (!fontEntry) return decoders;
  const fonts = page.doc.context.lookup(fontEntry);
  if (!(fonts instanceof PDFDict)) return decoders;

  for (const [name, value] of fonts.entries()) {
    const font = page.doc.context.lookup(value);
    const bareName = name.decodeText().replace(/^\//, '');
    const toUnicode = font instanceof PDFDict ? font.get(PDFName.of('ToUnicode')) : undefined;
    if (!toUnicode) {
      decoders.set(bareName, (hex) => Buffer.from(hex, 'hex').toString('latin1'));
      continue;
    }
    const cmap = streamBytes(page, toUnicode).toString('latin1');
    const characters = parseToUnicode(cmap);
    decoders.set(bareName, (hex) => {
      const normalized = hex.replace(/\s+/g, '');
      let text = '';
      for (let index = 0; index < normalized.length; index += 4) {
        text += characters.get(normalized.slice(index, index + 4).toUpperCase().padStart(4, '0')) ?? '';
      }
      return text;
    });
  }
  return decoders;
}

function pageOperators(page) {
  const contents = page.node.Contents();
  const streams = contents instanceof PDFArray ? contents.asArray() : [contents];
  return streams.map((ref) => streamBytes(page, ref).toString('latin1')).join('\n');
}

async function extractPdfText(bytes) {
  const pdf = await PDFDocument.load(bytes);
  return pdf.getPages().map((page) => {
    const decoders = fontDecoders(page);
    let current = (hex) => Buffer.from(hex, 'hex').toString('latin1');
    let text = '';
    for (const match of pageOperators(page).matchAll(/\/([^\s/<>[\]()]+)\s+[0-9.]+\s+Tf|<([0-9A-Fa-f]+)>\s*Tj/g)) {
      if (match[1]) {
        current = decoders.get(match[1]) ?? current;
        continue;
      }
      text += current(match[2]);
    }
    return text;
  }).join('');
}

async function pdfFromDownload(load, token) {
  const response = await load('@/app/api/protocol/download/route').GET(
    new Request(`http://localhost/api/protocol/download?token=${encodeURIComponent(token)}`),
  );
  const bytes = Buffer.from(await response.arrayBuffer());
  return { response, bytes };
}

function setPayPalEnv(t) {
  for (const [key, value] of [
    ['PAYPAL_ENVIRONMENT', 'sandbox'],
    ['PAYPAL_CLIENT_ID', 'local-test-client'],
    ['PAYPAL_CLIENT_SECRET', 'local-test-secret'],
    ['DOWNLOAD_TOKEN_SECRET', 'synthetic-protocol-test-secret'],
  ]) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
}

const ORDER_ID = '5O190127TN364715T';

function payPalSetup(t) {
  setPayPalEnv(t);
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    const request = new Request(url, init);
    calls.push({ url: request.url, method: request.method });
    const captured = calls.length % 2;
    if (captured === 1) return Response.json({ access_token: 'local-test-access' });
    return Response.json({
      id: ORDER_ID,
      status: 'COMPLETED',
      purchase_units: [{
        custom_id: 'sprint',
        payments: { captures: [{ id: 'SYNTHETICCAPTURE', status: 'COMPLETED', amount: { currency_code: 'USD', value: '10.00' } }] },
      }],
    });
  });
  return {
    calls,
    load: createLoader({
      '@/lib/order-events': { safelyLogOrderEvent: async () => {}, summarizeTask: () => ({}) },
    }),
  };
}

test('emoji mission downloads a PDF that preserves the rocket', async (t) => {
  const { calls, load } = configure(t);
  const issued = await load('@/app/api/protocol/free/route').POST(new Request('http://localhost/api/protocol/free', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: EMOJI_TASK, operator: ASCII_OPERATOR }),
  }));
  assert.equal(issued.status, 200);
  const { downloadUrl } = await issued.json();
  const token = new URL(downloadUrl, 'http://localhost').searchParams.get('token');
  const { response, bytes } = await pdfFromDownload(load, token);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'application/pdf');
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  const text = await extractPdfText(bytes);
  assert.ok(text.includes(`Operator: ${ASCII_OPERATOR}`), text.slice(0, 400));
  assert.ok(text.includes(`Mission: ${EMOJI_TASK}`), text);
  assert.ok(text.includes('🚀'), text);
  assert.deepEqual(calls, []);
});

test('Chinese operator name downloads a PDF that preserves the name', async (t) => {
  const { calls, load } = configure(t);
  const issued = await load('@/app/api/protocol/free/route').POST(new Request('http://localhost/api/protocol/free', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: ASCII_TASK, operator: CHINESE_OPERATOR }),
  }));
  assert.equal(issued.status, 200);
  const { downloadUrl } = await issued.json();
  const token = new URL(downloadUrl, 'http://localhost').searchParams.get('token');
  const { response, bytes } = await pdfFromDownload(load, token);
  assert.equal(response.status, 200);
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  const text = await extractPdfText(bytes);
  assert.ok(text.includes('Operator:'), text.slice(0, 80));
  assert.ok(text.includes(CHINESE_OPERATOR), text.slice(0, 200));
  assert.ok(text.includes(`Mission: ${ASCII_TASK}`), text);
  assert.ok(text.includes(`Current mission input: ${ASCII_TASK}`), text);
  assert.deepEqual(calls, []);
});

test('ASCII control still downloads the original protocol PDF', async (t) => {
  const { calls, load } = configure(t);
  const issued = await load('@/app/api/protocol/free/route').POST(new Request('http://localhost/api/protocol/free', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: `  ${ASCII_TASK}  `, operator: `  ${ASCII_OPERATOR}  ` }),
  }));
  assert.equal(issued.status, 200);
  const { downloadUrl } = await issued.json();
  const token = new URL(downloadUrl, 'http://localhost').searchParams.get('token');
  const { response, bytes } = await pdfFromDownload(load, token);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Disposition'), 'attachment; filename="tokenmaxxerpro-free-protocol-manual.pdf"');
  assert.equal(bytes.length, 11376);
  const text = await extractPdfText(bytes);
  assert.ok(text.includes(`Operator: ${ASCII_OPERATOR}`));
  assert.ok(text.includes(`Mission: ${ASCII_TASK}`));
  assert.ok(text.includes('<tokenmaxxer_protocol tier="starter"'));
  assert.deepEqual(calls, []);
});

test('a previously issued unicode token renders on download', async (t) => {
  const { calls, load } = configure(t);
  const token = load('@/lib/tokens').signDownloadToken({
    issuedAt: Date.now(),
    kind: 'protocol',
    operator: '张伟',
    task: EMOJI_TASK,
    tierId: 'sprint',
    orderId: 'ALREADYISSUED1',
  });
  const { response, bytes } = await pdfFromDownload(load, token);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Disposition'), 'attachment; filename="tokenmaxxerpro-sprint-protocol-ssued1.pdf"');
  const text = await extractPdfText(bytes);
  assert.ok(text.includes('Operator: 张伟'), text);
  assert.ok(text.includes(EMOJI_TASK), text);
  assert.ok(text.includes('<tokenmaxxer_protocol tier="sprint"'));
  assert.deepEqual(calls, []);
});

test('a previously issued unsupported token is rejected at download', async (t) => {
  const { calls, load } = configure(t);
  const token = load('@/lib/tokens').signDownloadToken({
    issuedAt: Date.now(),
    kind: 'protocol',
    operator: 'علي',
    task: UNSUPPORTED_TASK,
    tierId: 'free',
  });
  const { response, bytes } = await pdfFromDownload(load, token);
  assert.equal(response.status, 400);
  assert.equal(bytes.subarray(0, 5).toString() === '%PDF-', false);
  const body = JSON.parse(bytes.toString('utf8'));
  assert.match(body.error, /cannot be embedded/);
  assert.match(body.error, /ع/);
  assert.deepEqual(calls, []);
});

test('free issuance rejects unsupported characters before signing a link', async (t) => {
  const { calls, load } = configure(t);
  const response = await load('@/app/api/protocol/free/route').POST(new Request('http://localhost/api/protocol/free', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: UNSUPPORTED_TASK, operator: 'علي' }),
  }));
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.downloadUrl, undefined);
  assert.match(body.error, /cannot be embedded/);
  assert.match(body.error, /ا/);
  assert.deepEqual(calls, []);
});

test('paid capture rejects unsupported personalization before PayPal', async (t) => {
  const { calls, load } = payPalSetup(t);
  const response = await load('@/app/api/paypal/capture-order/route').POST(new Request('http://localhost/api/paypal/capture-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: ORDER_ID, tierId: 'sprint', task: UNSUPPORTED_TASK, operator: 'علي' }),
  }));
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.error, /cannot be embedded/);
  assert.equal(body.downloadUrl, undefined);
  assert.deepEqual(calls, []);
});

test('order creation rejects unsupported personalization before PayPal', async (t) => {
  const { calls, load } = payPalSetup(t);
  const response = await load('@/app/api/paypal/create-order/route').POST(new Request('http://localhost/api/paypal/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tierId: 'sprint', task: UNSUPPORTED_TASK, operator: 'علي' }),
  }));
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.error, /cannot be embedded/);
  assert.equal(body.orderId, undefined);
  assert.deepEqual(calls, []);
});

test('supported unicode still captures and downloads the paid protocol', async (t) => {
  const { calls, load } = payPalSetup(t);
  const response = await load('@/app/api/paypal/capture-order/route').POST(new Request('http://localhost/api/paypal/capture-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: ORDER_ID, tierId: 'sprint', task: EMOJI_TASK, operator: '张伟' }),
  }));
  assert.equal(response.status, 200);
  assert.ok(calls.some((call) => call.method === 'POST' && call.url.endsWith(`/v2/checkout/orders/${ORDER_ID}/capture`)));
  const { downloadUrl } = await response.json();
  const token = new URL(downloadUrl, 'http://localhost').searchParams.get('token');
  const downloaded = await pdfFromDownload(load, token);
  assert.equal(downloaded.response.status, 200);
  const text = await extractPdfText(downloaded.bytes);
  assert.ok(text.includes('Operator: 张伟'), text);
  assert.ok(text.includes(EMOJI_TASK), text);
  assert.ok(text.includes('<tokenmaxxer_protocol tier="sprint"'));
});
