import assert from "node:assert/strict";
import test from "node:test";
import createLoader from "./load-typescript.mjs";
const { assessReadiness, simulatedBurn, INITIAL_BURN } = createLoader()(
  "@/lib/burn-readiness",
);

test("all 27 complete assessments give bounded scores and consistent certification bands", () => {
  const ranks = new Set();
  for (let a = 0; a < 3; a++)
    for (let b = 0; b < 3; b++)
      for (let c = 0; c < 3; c++) {
        const result = assessReadiness([a, b, c]);
        assert.equal(result.score, a + b + c);
        assert.equal(
          result.rank,
          result.score <= 1
            ? "Dangerously efficient"
            : result.score <= 4
              ? "Committee material"
              : "Chief Incineration Officer",
        );
        assert.ok(result.copy.length > 40);
        ranks.add(result.rank);
      }
  assert.equal(ranks.size, 3);
});

test("incomplete or invalid answers cannot be certified", () => {
  for (const answers of [
    [],
    [0],
    [0, 1],
    [0, 1, 2, 0],
    [-1, 0, 0],
    [3, 0, 0],
    [NaN, 0, 0],
    [0.5, 0, 0],
    Array(3),
    [, 0, 0],
  ]) {
    assert.throws(() => assessReadiness(answers), /Complete all three/);
  }
});

test("fictional meter is deterministic and clamps invalid elapsed time", () => {
  assert.equal(simulatedBurn(0), INITIAL_BURN);
  assert.equal(simulatedBurn(1), INITIAL_BURN + 14208);
  assert.equal(simulatedBurn(60.9), INITIAL_BURN + 60 * 14208);
  for (const invalid of [-1, Infinity, NaN])
    assert.equal(simulatedBurn(invalid), INITIAL_BURN);
});
