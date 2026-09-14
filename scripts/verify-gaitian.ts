import assert from "node:assert/strict";

import { gaitianStarRadius, gaitianStarVisible } from "../src/lib/gaitian-stars";

assert.equal(gaitianStarRadius(-2), 2.2);
assert.equal(gaitianStarRadius(0), 2.2);
assert.ok(Math.abs(gaitianStarRadius(5) - 0.45) < 1e-12);
assert.equal(gaitianStarRadius(20), 0.45);
assert.ok(gaitianStarVisible(8, true));
assert.ok(gaitianStarVisible(5.5, false));
assert.ok(!gaitianStarVisible(5.51, false));

for (let magnitude = -2; magnitude <= 12; magnitude += 0.1) {
  const radius = gaitianStarRadius(magnitude);
  assert.ok(radius >= 0.45 && radius <= 2.2);
}

console.log(
  "verify-gaitian: PASS — magnitude radius 0.45–2.2 and non-member cutoff 5.5",
);
