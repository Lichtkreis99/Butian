import assert from "node:assert/strict";

import {
  angularSeparation,
  aspectMotion,
} from "../src/lib/aspects";

assert.equal(angularSeparation(359, 1), 2);
assert.equal(angularSeparation(10, 190), 180);
assert.equal(aspectMotion({
  firstLongitude: 10,
  firstSpeed: 1,
  secondLongitude: 72,
  secondSpeed: 0,
  angle: 60,
}), "applying");
assert.equal(aspectMotion({
  firstLongitude: 10,
  firstSpeed: -1,
  secondLongitude: 72,
  secondSpeed: 0,
  angle: 60,
}), "separating");
assert.equal(aspectMotion({
  firstLongitude: 10,
  firstSpeed: 0,
  secondLongitude: 70,
  secondSpeed: 0,
  angle: 60,
}), "stationary");

console.log(
  "verify-aspects: PASS — wraparound angle, exact orb motion, applying/separating fixed cases",
);
