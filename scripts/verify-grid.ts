import assert from "node:assert/strict";

import {
  equatorialGridCoordinates,
  horizontalGridCoordinates,
} from "../src/lib/sky-grid";

const horizontal = horizontalGridCoordinates();
const altitudes = horizontal.flat().map((point) => point.altitude);
assert.equal(Math.min(...altitudes), -90);
assert.equal(Math.max(...altitudes), 90);
assert.ok(altitudes.some((altitude) => altitude < 0));
assert.ok(altitudes.some((altitude) => altitude > 0));

const equatorial = equatorialGridCoordinates();
const declinations = equatorial.flat().map((point) => point.declination);
assert.equal(Math.min(...declinations), -90);
assert.equal(Math.max(...declinations), 90);

console.log(
  `verify-grid: PASS — ${horizontal.length} alt-az and ${equatorial.length} ` +
    "equatorial lines cover −90°…+90°",
);
