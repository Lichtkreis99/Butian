import assert from "node:assert/strict";
import { Horizon, Observer } from "astronomy-engine";

import { calculateNatalChart } from "../src/lib/aizhanxing-chart";
import {
  eclipticPointHorizontal,
  equatorialHorizontal,
  projectionForward,
  projectionInverse,
  altitudeFromDirection,
} from "../src/lib/planetarium";
import { localParts } from "../src/ui/charts/svg";
import {
  healpixLandscapeTileCoordinates,
  healpixPixelForDirection,
  healpixTileDirection,
} from "../src/lib/healpix";
import { BODY_DEFINITIONS, bodyDetails } from "../src/lib/ephemeris";
import {
  DAY_GROUND_RGB,
  GROUND_SELFTEST_HOURS,
  GROUND_SELFTEST_LOCATION,
  GROUND_SELFTEST_START,
  LANDSCAPE_MEAN_RGB,
  NIGHT_GROUND_RGB,
  colorsHaveClearContrast,
  colorsWithinTolerance,
  groundColorForSunAltitude,
  landscapeDaylightForSunAltitude,
  landscapeGroundColorForSunAltitude,
} from "../src/lib/ground-shading";

const fixtures = [
  ["2026-01-01T00:00:00Z", 39.9316, 116.41],
  ["2026-06-21T18:00:00Z", 51.5074, -0.1278],
  ["1990-05-15T00:00:00Z", -33.8688, 151.2093],
] as const;
let maximumHorizon = 0;
for (const [iso, latitude, longitude] of fixtures) {
  const date = new Date(iso);
  const location = { latitude, longitude };
  const actual = equatorialHorizontal(101.287155, -16.716116, date, location);
  const expected = Horizon(
    date,
    new Observer(latitude, longitude, 0),
    101.287155 / 15,
    -16.716116,
    "",
  );
  const difference = Math.max(
    Math.abs(actual.altitude - expected.altitude),
    Math.abs(((actual.azimuth - expected.azimuth + 540) % 360) - 180),
  );
  maximumHorizon = Math.max(maximumHorizon, difference);
  assert.ok(difference < 0.01);
}

let maximumRoundTrip = 0;
let seed = 0x51a7e;
const random = () => {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 0x1_0000_0000;
};
for (const projection of ["stereographic", "perspective", "fisheye"] as const) {
 for (let index = 0; index < 10_000; index += 1) {
  const longitude = random() * Math.PI * 2;
  const z = projection === "perspective" ? 0.001 + random() * 0.999
    : -0.999 + random() * 1.998;
  const radial = Math.sqrt(1 - z * z);
  const source = {
    x: radial * Math.cos(longitude), y: radial * Math.sin(longitude), z,
  };
  const result = projectionInverse(projection, projectionForward(projection, source));
  const error = Math.hypot(result.x - source.x, result.y - source.y, result.z - source.z);
  maximumRoundTrip = Math.max(maximumRoundTrip, error);
  assert.ok(error < 1e-9);
  const altitude = altitudeFromDirection(source, { x: 0, y: 0, z: 1 });
  assert.equal(altitude < 0, source.z < 0);
 }
}

let maximumAscAltitude = 0;
let maximumMcMeridian = 0;
for (const [iso, latitude, longitude] of fixtures) {
  const date = new Date(iso);
  const timeZone = "UTC";
  const local = localParts(date, timeZone);
  const chart = calculateNatalChart({
    date: local.date,
    time: local.time,
    latitude,
    longitude,
    timeZone,
    summer: 0,
    houseSystem: "P",
  });
  const location = { latitude, longitude };
  const asc = eclipticPointHorizontal(chart.ascendantLongitude, 0, date, location);
  const mc = eclipticPointHorizontal(chart.midheavenLongitude, 0, date, location);
  const meridianError = Math.min(mc.azimuth, Math.abs(mc.azimuth - 180),
    Math.abs(mc.azimuth - 360));
  maximumAscAltitude = Math.max(maximumAscAltitude, Math.abs(asc.altitude));
  maximumMcMeridian = Math.max(maximumMcMeridian, meridianError);
  assert.ok(Math.abs(asc.altitude) < 0.05);
  assert.ok(meridianError < 0.05);
}

console.log(
  `verify-planetarium: PASS — Sirius 3 cases max alt/az Δ ` +
  `${maximumHorizon.toExponential(1)}°; stereo round-trip ` +
  `${maximumRoundTrip.toExponential(1)}`,
);
for (let order = 0; order <= 4; order += 1) {
  for (let pixel = 0; pixel < 12 * 4 ** order; pixel += 1) {
    assert.equal(healpixPixelForDirection(order, healpixTileDirection(order, pixel)), pixel);
  }
}
console.log("verify-planetarium: PASS — HEALPix nested centres round-trip through order 4");
const firstLandscapeEdge = healpixLandscapeTileCoordinates(0);
const lastLandscapeEdge = healpixLandscapeTileCoordinates(1);
assert.ok(firstLandscapeEdge.direction < 0);
assert.ok(lastLandscapeEdge.direction > 1);
assert.ok(firstLandscapeEdge.texture > 0);
assert.ok(lastLandscapeEdge.texture < 1);
assert.equal(landscapeDaylightForSunAltitude(30), 1);
assert.equal(landscapeDaylightForSunAltitude(-30), 0.22);
assert.deepEqual(landscapeGroundColorForSunAltitude(30), LANDSCAPE_MEAN_RGB);
assert.deepEqual(landscapeGroundColorForSunAltitude(-30), [25, 27, 13]);
console.log(
  "verify-planetarium: PASS — landscape half-texel overlap/inset and opaque fallback shades",
);
assert.deepEqual(groundColorForSunAltitude(-30), NIGHT_GROUND_RGB);
assert.deepEqual(groundColorForSunAltitude(30), DAY_GROUND_RGB);
assert.equal(colorsWithinTolerance([27, 28, 26], NIGHT_GROUND_RGB), true);
assert.equal(colorsWithinTolerance([5, 8, 7], NIGHT_GROUND_RGB), false);
assert.equal(colorsHaveClearContrast(NIGHT_GROUND_RGB, [5, 8, 7]), true);
const selftestSun = BODY_DEFINITIONS.find((body) => body.id === "Sun")!;
const selftestStart = new Date(GROUND_SELFTEST_START).getTime();
const selftestInstants = Array.from({ length: GROUND_SELFTEST_HOURS }, (_, hour) => {
  const date = new Date(selftestStart + hour * 60 * 60 * 1_000);
  return {
    date,
    altitude: bodyDetails(selftestSun, date, GROUND_SELFTEST_LOCATION).altitude,
  };
});
const selftestDay = selftestInstants.reduce((best, value) =>
  value.altitude > best.altitude ? value : best);
const selftestNight = selftestInstants.reduce((best, value) =>
  value.altitude < best.altitude ? value : best);
assert.equal(GROUND_SELFTEST_HOURS, 48);
assert.ok(selftestDay.altitude > 20);
assert.ok(selftestNight.altitude < -18);
assert.deepEqual(groundColorForSunAltitude(selftestDay.altitude), DAY_GROUND_RGB);
assert.deepEqual(groundColorForSunAltitude(selftestNight.altitude), NIGHT_GROUND_RGB);
console.log(
  `verify-planetarium: PASS — 48-hour Beijing scan; day ` +
  `${selftestDay.date.toISOString()} rgb 52,58,56; night ` +
  `${selftestNight.date.toISOString()} rgb 26,29,27`,
);
console.log(
  `verify-planetarium: PASS — 3 projections × 10000 seeded round-trips; ` +
  `ground classification exact`,
);
console.log(
  `verify-planetarium: PASS — ASC altitude max ${maximumAscAltitude.toFixed(5)}°; ` +
  `MC meridian max ${maximumMcMeridian.toFixed(5)}°; ecliptic latitude 0`,
);
