import assert from "node:assert/strict";

import { calculateZhengyuFor } from "../src/lib/zhengyu";
import {
  projectionRingPositions,
  VIRTUAL_POINT_IDS,
  ZHENGYU_PROJECTION_BODIES,
} from "../src/lib/projection-data";
import { virtualRadiusOffset } from "../src/lib/virtual-radius";

const dates = [
  "1000-02-04T12:34:00Z", "1582-10-15T00:00:00Z", "1990-05-15T00:00:00Z",
  "2026-09-13T18:30:00Z", "2500-12-21T06:00:00Z",
].map((value) => new Date(value));
const location = { latitude: 39.9316, longitude: 116.41 };
const radius = 62 / 206_264.806;
let maximumLongitude = 0;
let maximumRadiusError = 0;
const involved = [...ZHENGYU_PROJECTION_BODIES, ...VIRTUAL_POINT_IDS];

for (const date of dates) {
  const ring = projectionRingPositions(date, location, "Asia/Shanghai");
  const engine = calculateZhengyuFor({
    date, location, timeZone: "Asia/Shanghai", gender: "male",
  });
  for (const id of involved) {
    const position = ring.find((item) => item.id === id)!;
    const enginePosition = engine.planets2.find((item) => item.name === id)!;
    assert.ok(position && enginePosition, id);
    const longitudeError = Math.abs(
      ((position.longitude - enginePosition.lng + 540) % 360) - 180,
    );
    const virtual = virtualRadiusOffset(position.longitude, radius);
    const virtualLongitude = (Math.atan2(virtual.y, virtual.x) * 180 / Math.PI + 360) % 360;
    const mappedError = Math.abs(
      ((virtualLongitude - enginePosition.lng + 540) % 360) - 180,
    );
    const radiusError = Math.abs(Math.hypot(virtual.x, virtual.y, virtual.z) / radius - 1);
    maximumLongitude = Math.max(maximumLongitude, longitudeError, mappedError);
    maximumRadiusError = Math.max(maximumRadiusError, radiusError);
    assert.ok(mappedError < 0.01);
    assert.ok(radiusError < 1e-6);
    assert.equal(virtual.z, 0);
  }
}

console.log(
  `verify-virtual-radius: PASS — ${dates.length} dates × ` +
  `${involved.length} points; max Δλ ` +
  `${maximumLongitude.toFixed(9)}°; max relative Δr ${maximumRadiusError.toExponential(1)}`,
);
