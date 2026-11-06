# Font packaging

Status: tested on 2026-11-06. Local: `npm test` 33/33, lint, `tsc --noEmit`, `npm run build`, and the trace script printed `trace proof passed` with 17 `@pdf-lib/fontkit` files on each of the four route traces. Preview HTTP on the branch alias is recorded below. That preview is not production acceptance. Production `dpl_3UVrvzQYzEuZAM9zhK7kZaD3THQe` still lacks this trace until this change is deployed there.

Date: 2026-11-06

Surface: `POST /api/protocol/free`, then `GET /api/protocol/download`. The same font engine is loaded by `POST /api/paypal/create-order` and `POST /api/paypal/capture-order`. Runtime under test is the Next.js Node.js function trace (`nodejs24.x` on Vercel). Production failure on deployment `dpl_3UVrvzQYzEuZAM9zhK7kZaD3THQe`: `Cannot find module '@pdf-lib/fontkit'`, require stack `/var/task/package.json`, request `nk2cp-1793996429369-296fb8fc1461`.

Purpose: prove `@pdf-lib/fontkit` is in the traced function output, unsupported text returns HTTP 400, and supported emoji or Chinese text still downloads a PDF. Fonts stay the vendored files in `assets/fonts`. No request-time font download.

Role/account: none. Free issuance uses `DOWNLOAD_TOKEN_SECRET` by name only. Do not print that value or any PayPal or Blob value.

Safe actions:

- `npm test`, lint, typecheck, and `npm run build` from a clean install.
- Read `.next/server/**/*.nft.json` and require `@pdf-lib/fontkit` from a copy of those traced files.
- `POST /api/protocol/free` and `GET /api/protocol/download` on localhost or a preview alias with the synthetic bodies below.
- Local server only, with `DOWNLOAD_TOKEN_SECRET` set to a non-production value.

Unsafe actions:

- Real PayPal payments, live capture, or webhook replay.
- Changing Vercel env vars, deployment protection, team settings, or project configuration.
- Printing secret values.
- Pushing to `main`.
- Treating a local trace or `next start` as production acceptance.

Checkpoint seed data:

- None. Bodies below are synthetic and stateless.
- Vendored fonts already in `assets/fonts`: `NotoSans-Regular.ttf`, `NotoSans-Bold.ttf`, `NotoSansSC-Regular.ttf`, `NotoEmoji-Regular.ttf`.

## Local behavior

From the repository root, after `npm ci`:

```bash
npm test
npm run lint
npx tsc --noEmit
```

`npm test` must stay green. It compiles `lib/pdf-fonts.ts` in-process and does not prove file tracing. A regression is any failure of those tests, an ASCII free PDF whose rendered bytes change, a network fetch while a protocol is built, or an unsupported character that is no longer HTTP 400.

## Local output-tracing proof

This is not preview or production evidence. `next start` still sees the full `node_modules` tree.

```bash
npm run build
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';

const project = process.cwd();
const routes = [
  '.next/server/app/api/protocol/free/route.js.nft.json',
  '.next/server/app/api/protocol/download/route.js.nft.json',
  '.next/server/app/api/paypal/create-order/route.js.nft.json',
  '.next/server/app/api/paypal/capture-order/route.js.nft.json',
];
const required = [
  'node_modules/@pdf-lib/fontkit/package.json',
  'node_modules/@pdf-lib/fontkit/dist/fontkit.umd.js',
  'assets/fonts/NotoSans-Regular.ttf',
  'assets/fonts/NotoSans-Bold.ttf',
  'assets/fonts/NotoSansSC-Regular.ttf',
  'assets/fonts/NotoEmoji-Regular.ttf',
];

const sandbox = mkdtempSync(join(tmpdir(), 'font-trace-'));
const freeNftDir = dirname(resolve(project, routes[0]));
const freeFiles = JSON.parse(readFileSync(resolve(project, routes[0]), 'utf8')).files;

for (const route of routes) {
  const nftDir = dirname(resolve(project, route));
  const files = JSON.parse(readFileSync(resolve(project, route), 'utf8')).files
    .map((file) => relative(project, resolve(nftDir, file)));
  for (const item of required) {
    assert.ok(files.includes(item), `${route} missing ${item}`);
  }
}

for (const file of freeFiles) {
  const abs = resolve(freeNftDir, file);
  const rel = relative(project, abs);
  if (rel.startsWith('..')) continue;
  const dest = join(sandbox, rel);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(abs, dest);
}
copyFileSync(join(project, 'package.json'), join(sandbox, 'package.json'));

const nodeRequire = createRequire(join(sandbox, 'package.json'));
const loaded = nodeRequire('@pdf-lib/fontkit');
const fontkit = typeof loaded.create === 'function' ? loaded : loaded.default;
assert.equal(typeof fontkit.create, 'function');
const emoji = fontkit.create(readFileSync(join(sandbox, 'assets/fonts/NotoEmoji-Regular.ttf')));
const sc = fontkit.create(readFileSync(join(sandbox, 'assets/fonts/NotoSansSC-Regular.ttf')));
assert.equal(emoji.hasGlyphForCodePoint(0x1f680), true);
assert.equal(sc.hasGlyphForCodePoint('张'.codePointAt(0)), true);
assert.equal(sc.hasGlyphForCodePoint('ا'.codePointAt(0)), false);
console.log(`trace proof passed: ${sandbox}`);
JS
```

Expected: the script prints `trace proof passed`. A regression is any required path missing from a route trace, or `Cannot find module '@pdf-lib/fontkit'` from that sandbox. Passing this script still does not prove the deployed function.

## Preview or production HTTP

Use the deployment's existing environment. Do not change it. Set only `DOWNLOAD_TOKEN_SECRET` when starting a local server, and never echo the value.

Unsupported body (Arabic, same shape as `tests/unicode-pdf.test.mjs`):

```json
{"task":"Draft a useful protocol ا now.","operator":"علي"}
```

Expected: HTTP 400, `content-type` contains `application/json`, JSON `error` matches `cannot be embedded` and includes `ا`, and there is no `downloadUrl`. HTTP 500, especially `Cannot find module '@pdf-lib/fontkit'`, is a failure.

Supported emoji body:

```json
{"task":"Launch the rocket 🚀 protocol.","operator":"Test Operator"}
```

Expected: HTTP 200 JSON with `downloadUrl`. `GET` that URL on the same origin. Expected: HTTP 200, `content-type` `application/pdf`, body starts with `%PDF-`.

Supported Chinese body:

```json
{"task":"Draft a useful email workflow for testing.","operator":"张伟"}
```

Expected: the same PDF response shape. A regression is a non-PDF body, a missing rocket or Chinese name in the extracted PDF text, or any font download during the request.

Local HTTP, only after `npm run build`, is behavior evidence. It is not tracing evidence:

```bash
DOWNLOAD_TOKEN_SECRET=local-demo-only-do-not-use-in-production npm start -- --hostname 127.0.0.1 --port 3000
```

Record the preview deployment id, public alias, status, content-type, and body or PDF header separately from the local trace result.

Unauthenticated requests to a protected preview alias return HTTP 401, `content-type: application/json`, and a body whose `error.message` is `Protected deployment`. Do not turn protection off to retest. Use the existing Vercel account access for that alias. Do not copy share tokens, cookies, or signed download URLs into this file.

### Preview check 2026-11-06

Deployment `dpl_FLQfbJKemkxRBv3NschNC5QYWB8W`, state `READY`, commit `dac6134ae37f0582f85a13a52ab4903a4afb7b66`.

Public alias: `https://tokenmaxxerpro-git-bruh-fontki-52c35d-jonathan-edwards-projects.vercel.app`

Unauthenticated `POST /api/protocol/free`: HTTP 401, `content-type: application/json`, `x-vercel-id: pdx1::ghm56-1793997036962-fd671667637c`.

Authenticated requests to that same alias, without changing protection:

- Unsupported Arabic body: HTTP 400, `content-type: application/json`, `x-vercel-id: pdx1::iad1::94xzh-1793997105155-c97d2a0ac3df`, `x-vercel-cache: MISS`. Body: `{"error":"These characters cannot be embedded in the protocol PDF: ع (U+0639), ل (U+0644), ي (U+064A), ا (U+0627). Remove them and try again."}`
- Emoji body: HTTP 200, `content-type: application/json`, `x-vercel-id: pdx1::iad1::tlkvj-1793997106083-6390cac0c8d8`. The JSON had a `downloadUrl`. `GET` of that URL: HTTP 200, `content-type: application/pdf`, `content-disposition: attachment; filename="tokenmaxxerpro-free-protocol-manual.pdf"`, 12981 bytes, prefix `%PDF-`, `x-vercel-id: pdx1::iad1::fnnrf-1793997106210-2edd3876d7f4`. Extracted text included `Mission: Launch the rocket 🚀 protocol.`
- Chinese operator `张伟`: HTTP 200, then HTTP 200 `application/pdf`, 12853 bytes, prefix `%PDF-`, `x-vercel-id: pdx1::iad1::bpphd-1793997106703-37c8e406d1ae`. Extracted text included `Operator: 张伟`.

Cleanup:

- Stop the local server. Do not delete vendored fonts or deployment env.

Known selector/flow lessons:

- `serverExternalPackages` does not trace `createRequire(join(process.cwd(), "package.json"))`.
- The traced CommonJS entry is `node_modules/@pdf-lib/fontkit/dist/fontkit.umd.js`. It does not need `pako` on disk.
- Arabic is outside the vendored fonts and must be rejected before a link is signed.
