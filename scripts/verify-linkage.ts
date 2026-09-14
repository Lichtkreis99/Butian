import assert from "node:assert/strict";

import { calculateZhengyuFor } from "../src/lib/zhengyu";
import {
  projectionRingPositions,
  ZHENGYU_PROJECTION_BODIES,
} from "../src/lib/projection-data";

const dates = [
  new Date("1000-02-04T12:34:00Z"),
  new Date("1582-10-15T00:00:00Z"),
  new Date("1990-05-15T00:00:00Z"),
  new Date("2026-09-13T18:30:00Z"),
  new Date("2500-12-21T06:00:00Z"),
];
const location = { latitude: 39.9316, longitude: 116.41 };
let maximumDifference = 0;
let comparisons = 0;

function angularDifference(first: number, second: number): number {
  return Math.abs(((first - second + 540) % 360) - 180);
}

for (const calcType of [0, 4] as const) {
  for (const date of dates) {
    const ring = projectionRingPositions(date, location, "Asia/Shanghai", calcType);
    const engine = calculateZhengyuFor({
      date,
      location,
      timeZone: "Asia/Shanghai",
      gender: "male",
      calcType,
    });
    for (const id of ZHENGYU_PROJECTION_BODIES) {
      const ringBody = ring.find((body) => body.id === id);
      const engineBody = engine.planets2.find((body) => body.name === id);
      assert.ok(ringBody, `calc ${calcType} 3D ring omitted ${id}`);
      assert.ok(engineBody, `calc ${calcType} zhengyu omitted ${id}`);
      const difference = angularDifference(ringBody.longitude, engineBody.lng);
      maximumDifference = Math.max(maximumDifference, difference);
      assert.ok(difference < 0.01, `${id} longitude differs by ${difference}°`);
      assert.equal(ringBody.mansion, engineBody.xingxiu, `${id} mansion differs`);
      comparisons += 1;
    }
  }
}

console.log(
  `verify-linkage: PASS — 2 calc types × ${dates.length} dates × ` +
    `${ZHENGYU_PROJECTION_BODIES.length} 七政 bodies; max ring Δ ` +
    `${maximumDifference.toFixed(9)}°; mansions identical ` +
    `(${comparisons} comparisons)`,
);
