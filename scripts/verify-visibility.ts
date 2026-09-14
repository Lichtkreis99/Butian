import assert from "node:assert/strict";

import {
  detectableStarMagnitude,
  parsecsFromSlider,
  planetFade,
  planetThreshold,
  segmentVisible,
  starDistanceVisible,
} from "../src/lib/visibility";

assert.equal(planetThreshold(1), Infinity);
assert.equal(planetFade(100, Infinity), 1);
assert.equal(planetFade(2, 1), 0);
assert.equal(planetFade(0.5, 1), 1);
assert.ok(planetFade(1, 1) > 0 && planetFade(1, 1) < 1);
assert.equal(parsecsFromSlider(1), 5_001);
assert.equal(starDistanceVisible(2, "gaia", 1, 10), true);
assert.equal(starDistanceVisible(20, "gaia", 1, 10), false);
assert.equal(starDistanceVisible(1_000, "unknown", 1, 5_001), true);
assert.equal(starDistanceVisible(1_000, "unknown", 1, 5_000), false);
assert.equal(starDistanceVisible(1_000, "unknown", 2, 5_001), false);
assert.equal(segmentVisible(true, true), true);
assert.equal(segmentVisible(true, false), false);
assert.ok(Math.abs(detectableStarMagnitude(1.5, 1) - 4) < 1e-12);
assert.equal(detectableStarMagnitude(1.5, 0.04), Number.NEGATIVE_INFINITY);
console.log(
  "verify-visibility: PASS — planet fade/∞, star range/segments and detectable magnitude",
);
