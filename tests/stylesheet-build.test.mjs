import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

// FLEET-858 / LEJ-730: an older plugin can reuse the previous stylesheet when
// Turbopack restores its disk cache. 4.3.3 rebuilds when its input CSS changes.
const floor = [4, 3, 3];
const atLeastFloor = (version) => {
  if (!/^\d+\.\d+\.\d+$/.test(version)) return false;
  const parts = version.split(".").map(Number);
  for (let i = 0; i < floor.length; i += 1) {
    if (parts[i] !== floor[i]) return parts[i] > floor[i];
  }
  return true;
};
const read = (file) => JSON.parse(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));

test("the locked Tailwind compiler and PostCSS plugin include the cached stylesheet fix", () => {
  for (const version of ["4.3.3", "4.10.0", "5.0.0"]) assert.ok(atLeastFloor(version));
  for (const version of ["4.2.2", "4.2.4", "4.3.2", "3.9.9", "4.3.3-beta.1"]) assert.equal(atLeastFloor(version), false);

  const lock = read("package-lock.json").packages;
  for (const name of ["@tailwindcss/postcss", "tailwindcss", "@tailwindcss/node"]) {
    const version = lock[`node_modules/${name}`]?.version;
    assert.ok(version && atLeastFloor(version), `${name} is locked at ${version}; FLEET-858 requires 4.3.3 or later`);
  }
});

test("package ranges cannot resolve Tailwind below the cached stylesheet fix", () => {
  const pkg = read("package.json");
  const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const name of ["@tailwindcss/postcss", "tailwindcss"]) {
    const range = dependencies[name];
    assert.match(range ?? "", /^\^?\d+\.\d+\.\d+$/, `${name} must name a full version floor`);
    assert.ok(atLeastFloor(range.replace(/^\^/, "")), `${name} must start at 4.3.3 or later`);
  }
});
