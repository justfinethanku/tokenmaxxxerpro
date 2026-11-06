import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';

const externalRequire = createRequire(import.meta.url);
const dirname = path.dirname(fileURLToPath(import.meta.url));

// Compile real application modules; isolate their caches and injected dependencies per test.
export default function createLoader(mocks = {}) {
  const cache = new Map();
  function load(specifier) {
    if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
    if (!specifier.startsWith('@/')) return externalRequire(specifier);
    const filename = path.join(dirname, '..', `${specifier.slice(2)}.ts`);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = { exports: {} };
    cache.set(filename, mod);
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
      fileName: filename,
    });
    new Function('require', 'module', 'exports', outputText)(load, mod, mod.exports);
    return mod.exports;
  }
  return load;
}
