import { resolve } from "node:path";

import {
  cartesianToSpherical,
  eclipticToEquatorialJ2000,
  type Cartesian,
} from "../src/lib/coordinates";
import {
  angularSeparation,
  circumpolarRadius,
  gaitianPoint,
  gaitianRadius,
  projectToCelestialSphere,
} from "../src/lib/projections";
import { readClassicBase64, readClassicNumber } from "./lib/generated-data";
import { BODY_DEFINITIONS, heliocentricPositionParsecs } from "../src/lib/ephemeris";

const root = resolve(import.meta.dirname, "..");
const path = resolve(root, "public/data/stars.js");
const bytes = readClassicBase64(path);
const stride = readClassicNumber(path, "stride");

const fixtures = [
  { hip: 32349, ra: 101.288541, dec: -16.713141 },
  { hip: 71683, ra: 219.920407, dec: -60.835146 },
  { hip: 91262, ra: 279.234108, dec: 38.782992 },
  { hip: 11767, ra: 37.946184, dec: 89.264137 },
  { hip: 27989, ra: 88.792871, dec: 7.407036 },
] as const;

function positionForHip(hip: number): Cartesian {
  for (let offset = 0; offset < bytes.byteLength; offset += stride) {
    if (bytes.readInt32LE(offset + 32) !== hip) continue;
    return {
      x: bytes.readFloatLE(offset),
      y: bytes.readFloatLE(offset + 4),
      z: bytes.readFloatLE(offset + 8),
    };
  }
  throw new Error(`HIP ${hip} is absent from generated stars.`);
}

function angularDifference(first: number, second: number): number {
  return Math.abs(((first - second + 540) % 360) - 180);
}

const earthDefinition = BODY_DEFINITIONS.find((body) => body.id === "Earth")!;
const earth = heliocentricPositionParsecs(
  earthDefinition,
  new Date("2025-01-01T00:00:00Z"),
);
let maximumFixtureError = 0;
for (const fixture of fixtures) {
  const projected = projectToCelestialSphere(positionForHip(fixture.hip), earth, 1);
  const equatorial = cartesianToSpherical(eclipticToEquatorialJ2000({
    x: projected.x - earth.x,
    y: projected.y - earth.y,
    z: projected.z - earth.z,
  }));
  const error = Math.max(
    angularDifference(equatorial.longitude, fixture.ra),
    Math.abs(equatorial.latitude - fixture.dec),
  );
  maximumFixtureError = Math.max(maximumFixtureError, error);
  if (error >= 0.01) {
    throw new Error(`HIP ${fixture.hip} 浑天 error ${error}° exceeds 0.01°.`);
  }
}

const betelgeuse = positionForHip(27989);
const rigel = positionForHip(24436);
const betelgeuseRadius = Math.hypot(betelgeuse.x, betelgeuse.y, betelgeuse.z);
const orionViewpoint = {
  x: betelgeuse.x / betelgeuseRadius * 300,
  y: betelgeuse.y / betelgeuseRadius * 300,
  z: betelgeuse.z / betelgeuseRadius * 300,
};
const projectedBetelgeuse = projectToCelestialSphere(betelgeuse, orionViewpoint, 2);
const projectedRigel = projectToCelestialSphere(rigel, orionViewpoint, 2);
const projectedVectors = [projectedBetelgeuse, projectedRigel].map((position) => ({
  x: position.x - orionViewpoint.x,
  y: position.y - orionViewpoint.y,
  z: position.z - orionViewpoint.z,
}));
const projectedSeparation = angularSeparation(projectedVectors[0]!, projectedVectors[1]!);
const directSeparation = angularSeparation({
  x: betelgeuse.x - orionViewpoint.x,
  y: betelgeuse.y - orionViewpoint.y,
  z: betelgeuse.z - orionViewpoint.z,
}, {
  x: rigel.x - orionViewpoint.x,
  y: rigel.y - orionViewpoint.y,
  z: rigel.z - orionViewpoint.z,
});
if (Math.abs(projectedSeparation - directSeparation) >= 1e-6) {
  throw new Error("Orion projection differs from direct vector computation.");
}
const earthSeparation = angularSeparation(betelgeuse, rigel);

const pole = gaitianPoint(137, 90);
if (Math.hypot(pole.x, pole.y) > 1e-12) throw new Error("盖天 pole is not centered.");
const equator = gaitianPoint(23, 0);
if (Math.abs(Math.hypot(equator.x, equator.y) - gaitianRadius(0)) > 1e-12) {
  throw new Error("盖天 equator radius is incorrect.");
}
const latitude = 39.9316;
const expectedInner = latitude / 90;
if (Math.abs(circumpolarRadius(latitude) - expectedInner) > 1e-12) {
  throw new Error("盖天 inner-rule radius is incorrect.");
}

console.log(
  `verify-projection: PASS — 5 Earth fixtures; max RA/Dec Δ ` +
    `${maximumFixtureError.toFixed(6)}°`,
);
console.log(
  `verify-projection: PASS — Orion 300 pc separation ${projectedSeparation.toFixed(9)}°; ` +
    `Earth ${earthSeparation.toFixed(9)}°; change ` +
    `${Math.abs(projectedSeparation - earthSeparation).toFixed(9)}°`,
);
console.log(
  `verify-projection: PASS — 盖天 pole/equator/inner-rule fixtures; ` +
    `inner ${expectedInner.toFixed(9)}`,
);
