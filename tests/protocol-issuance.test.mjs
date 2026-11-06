import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import createLoader from './load-typescript.mjs';

function configure(t) {
  const previous = process.env.DOWNLOAD_TOKEN_SECRET;
  process.env.DOWNLOAD_TOKEN_SECRET = 'synthetic-protocol-test-secret';
  t.after(() => {
    if (previous === undefined) delete process.env.DOWNLOAD_TOKEN_SECRET;
    else process.env.DOWNLOAD_TOKEN_SECRET = previous;
  });
  // Issuance and download must stay local; accidental external calls fail the test.
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected network call'); });
  return createLoader();
}

function request(body) {
  return new Request('http://localhost/api/protocol/free', {
    method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

async function savedText(response) {
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString(), '%PDF-');
  const pdf = await PDFDocument.load(bytes);
  return pdf.getPages().flatMap((page) => {
    const contents = page.node.Contents();
    const streams = contents instanceof PDFArray ? contents.asArray() : [contents];
    return streams.flatMap((ref) => {
      const stream = page.doc.context.lookup(ref, PDFRawStream);
      const operators = Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1');
      return [...operators.matchAll(/<([0-9a-f]+)>\s*Tj/gi)]
        .map((match) => Buffer.from(match[1], 'hex').toString('latin1'));
    });
  }).join(' ').replace(/\s+/g, ' ');
}

test('free issuance normalizes personalization and delivers the real starter PDF', async (t) => {
  const load = configure(t);
  const issued = await load('@/app/api/protocol/free/route').POST(request({
    task: '  Draft\n a   useful email workflow for testing.  ',
    operator: '  Test\t Operator  ', tierId: 'pro',
  }));
  assert.equal(issued.status, 200);
  const { downloadUrl } = await issued.json();
  assert.ok(downloadUrl.startsWith('/api/protocol/download?token='));
  const url = new URL(downloadUrl, 'http://localhost');
  const payload = load('@/lib/tokens').verifyDownloadToken(url.searchParams.get('token'));
  assert.equal(payload.tierId, 'free', 'public issuance cannot upgrade the tier');
  assert.equal(payload.task, 'Draft a useful email workflow for testing.');
  assert.equal(payload.operator, 'Test Operator');
  assert.ok(Math.abs(Date.now() - payload.issuedAt) < 5000);
  const response = await load('@/app/api/protocol/download/route').GET(new Request(url));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'application/pdf');
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store, max-age=0');
  assert.equal(response.headers.get('Content-Disposition'), 'attachment; filename="tokenmaxxerpro-free-protocol-manual.pdf"');
  const text = await savedText(response);
  assert.match(text, /Operator: Test Operator/);
  assert.match(text, /Mission: Draft a useful email workflow for testing\./);
  assert.match(text, /<tokenmaxxer_protocol tier="starter"/);
});

test('free issuance applies normalized task boundaries and operator limits', async (t) => {
  const load = configure(t);
  const post = load('@/app/api/protocol/free/route').POST;
  for (const task of ['', ' '.repeat(25), 'x'.repeat(17), ' '.repeat(30) + 'short']) {
    assert.equal((await post(request({ task }))).status, 400);
  }
  for (const task of ['x'.repeat(18), 'word '.repeat(200)]) {
    const response = await post(request({ task, operator: 'z'.repeat(200) }));
    assert.equal(response.status, 200);
    const { downloadUrl } = await response.json();
    const token = new URL(downloadUrl, 'http://localhost').searchParams.get('token');
    const payload = load('@/lib/tokens').verifyDownloadToken(token);
    assert.equal(payload.task.length, Math.min(task.trim().length, 420));
    assert.equal(payload.operator.length, 120);
  }
});

for (const [name, body] of [
  ['invalid JSON', '{'], ['null body', null], ['array body', []],
  ['string body', '"mission"'], ['numeric task', { task: 42 }],
  ['array task', { task: ['Draft a useful email workflow.'] }],
  ['object operator', { task: 'Draft a useful email workflow.', operator: {} }],
  ['null task', { task: null }],
]) {
  test(`free issuance returns a client error for ${name}`, async (t) => {
    const load = configure(t);
    const response = await load('@/app/api/protocol/free/route').POST(request(body));
    assert.equal(response.status, 400);
    assert.equal(typeof (await response.json()).error, 'string');
  });
}

test('missing and forged download tokens fail before protocol or PDF generation', async (t) => {
  configure(t);
  let renderCalls = 0;
  const load = createLoader({
    '@/lib/protocols': { buildProtocol: () => { renderCalls++; throw new Error('Unexpected protocol generation'); } },
    '@/lib/pdf': { generateProtocolPdf: () => { renderCalls++; throw new Error('Unexpected PDF generation'); } },
  });
  const get = load('@/app/api/protocol/download/route').GET;
  assert.equal((await get(new Request('http://localhost/api/protocol/download'))).status, 400);
  const signed = load('@/lib/tokens').signDownloadToken({ issuedAt: Date.now(), kind: 'protocol', tierId: 'free', task: 'Draft a useful workflow.' });
  const [encoded, signature] = signed.split('.');
  const changed = Buffer.from(JSON.stringify({ tierId: 'pro', task: 'Forged mission' })).toString('base64url');
  for (const token of ['invalid', `${encoded}.short`, `${changed}.${signature}`]) {
    assert.equal((await get(new Request(`http://localhost/api/protocol/download?token=${token}`))).status, 401);
  }
  assert.equal(renderCalls, 0);
});

for (const [tierId, marker] of [['sprint', 'sprint'], ['pro', 'continuous']]) {
  test(`${tierId} entitlement delivers its purchased protocol and capture filename`, async (t) => {
    const load = configure(t);
    const token = load('@/lib/tokens').signDownloadToken({
      issuedAt: Date.now(), kind: 'protocol', tierId, operator: 'Paid operator',
      orderId: 'SYNTHETICABC123', task: 'Draft a paid workflow for testing.',
    });
    const response = await load('@/app/api/protocol/download/route').GET(new Request(`http://localhost/api/protocol/download?token=${token}`));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Disposition'), `attachment; filename="tokenmaxxerpro-${tierId}-protocol-abc123.pdf"`);
    const text = await savedText(response);
    assert.ok(text.includes(`<tokenmaxxer_protocol tier="${marker}"`));
    assert.match(text, /Operator: Paid operator/);
    assert.match(text, /Mission: Draft a paid workflow for testing\./);
  });
}
