import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { allFinite, finiteRecord } from "../src/lib/finite-state";

assert.equal(allFinite([0, -1, Number.MAX_VALUE]), true);
assert.equal(allFinite([0, Number.NaN]), false);
assert.equal(allFinite([Number.POSITIVE_INFINITY]), false);
assert.equal(finiteRecord({ camera: [1, 0, 0, 1], fov: 48 }), true);
assert.equal(finiteRecord({ camera: [1, Number.NaN], fov: 48 }), false);
const starShader = readFileSync(new URL("../src/scene/star-field.ts", import.meta.url), "utf8");
assert.equal(starShader.match(/varying float vProfileScale;/g)?.length, 2);

console.log(
  "verify-stability: PASS — finite guards and linked star profile varying",
);
