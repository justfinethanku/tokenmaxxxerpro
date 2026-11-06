import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import createLoader from './load-typescript.mjs';

// Read the saved PDF, rather than mocking drawing calls: duplicate text is also
// duplicated in PDF readers' text selection and extraction.
function pageText(page) {
  const contents = page.node.Contents();
  const streams = contents instanceof PDFArray ? contents.asArray() : [contents];
  return streams.map((ref) => {
    const stream = page.doc.context.lookup(ref, PDFRawStream);
    const operators = Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1');
    return [...operators.matchAll(/<([0-9a-f]+)>\s*Tj/gi)]
      .map((match) => Buffer.from(match[1], 'hex').toString('latin1')).join('\n');
  }).join('\n');
}

async function assertPageFooters(protocol) {
  const { generateProtocolPdf } = createLoader()('@/lib/pdf');
  const saved = await PDFDocument.load(await generateProtocolPdf(protocol));
  const pages = saved.getPages();
  const text = pages.map(pageText);
  for (const [index, content] of text.entries()) {
    const footers = content.match(/TOKENMAXXERPRO \/ PAGE \d+/g) ?? [];
    assert.deepEqual(footers, [`TOKENMAXXERPRO / PAGE ${index + 1}`], `page ${index + 1} footer`);
  }
  return { pages, text: text.join('\n') };
}

test('a single-page document has one correctly numbered footer and its prompt', async () => {
  const { pages, text } = await assertPageFooters({
    artifacts: [], burnTarget: '50k', caution: 'Use your own account.', checklist: [],
    operator: 'Test operator', sections: [], subtitle: 'Test document', task: 'A small task.',
    tierName: 'Aperture', title: 'Compact protocol', finalPrompt: 'COMPACT_PROMPT_MARKER',
  });
  assert.equal(pages.length, 1);
  assert.match(text, /COMPACT_PROMPT_MARKER/);
});

for (const tierId of ['free', 'sprint', 'pro']) {
  test(`${tierId} protocol paginates with exactly one footer on every page`, async () => {
    const load = createLoader();
    const { buildProtocol } = load('@/lib/protocols');
    const { DEFAULT_TASK } = load('@/lib/products');
    const protocol = buildProtocol({ tierId, task: DEFAULT_TASK, operator: 'Test operator' });
    const { pages, text } = await assertPageFooters(protocol);
    assert.ok(pages.length > 1, 'exercise a real page break');
    assert.match(text, /<tokenmaxxer_protocol tier=/);
    assert.match(text, /<\/tokenmaxxer_protocol>/);
    assert.match(text, /Use your own AI account\.|fake consulting engagement|sustained burn/i);
  });
}
