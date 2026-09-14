import assert from "node:assert/strict";

import { isClickGesture, type PointerGestureSummary } from "../src/scene/pointer-gesture";

const base: PointerGestureSummary = {
  durationMs: 120,
  totalMovement: 2,
  maximumPointers: 1,
  wheelOrPinch: false,
};

assert.equal(isClickGesture(base), true, "a short stationary gesture is a click");
assert.equal(isClickGesture({ ...base, totalMovement: 4.999 }), true);
assert.equal(isClickGesture({ ...base, totalMovement: 5 }), false);
assert.equal(isClickGesture({ ...base, durationMs: 349.999 }), true);
assert.equal(isClickGesture({ ...base, durationMs: 350 }), false);
assert.equal(isClickGesture({ ...base, maximumPointers: 2 }), false);
assert.equal(isClickGesture({ ...base, wheelOrPinch: true }), false);
assert.equal(isClickGesture({ ...base, cancelled: true }), false);

console.log("verify-pointer: 8 gesture cases passed; limits <5 CSS px and <350 ms");
