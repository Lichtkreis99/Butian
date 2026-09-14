import { Illumination } from "astronomy-engine";

import { AU_PER_PARSEC, type Cartesian } from "./coordinates";
import type { BodyDefinition, SolarBodyId } from "./ephemeris";

const ABSOLUTE_MAGNITUDE: Readonly<Record<SolarBodyId, number>> = {
  Sun: -26.74,
  Mercury: -0.42,
  Venus: -4.40,
  Earth: -3.99,
  Moon: 0.23,
  Mars: -1.52,
  Jupiter: -9.40,
  Saturn: -8.88,
  Uranus: -7.19,
  Neptune: -6.87,
  Pluto: -1.0,
};

function distanceAu(first: Cartesian, second: Cartesian): number {
  return Math.max(1e-12, Math.hypot(
    first.x - second.x,
    first.y - second.y,
    first.z - second.z,
  ) * AU_PER_PARSEC);
}

export function phaseAngleDegrees(body: Cartesian, observer: Cartesian): number {
  const sun = { x: -body.x, y: -body.y, z: -body.z };
  const view = {
    x: observer.x - body.x,
    y: observer.y - body.y,
    z: observer.z - body.z,
  };
  const cosine = (sun.x * view.x + sun.y * view.y + sun.z * view.z) /
    (Math.hypot(sun.x, sun.y, sun.z) * Math.hypot(view.x, view.y, view.z));
  return Math.acos(Math.min(1, Math.max(-1, cosine))) * 180 / Math.PI;
}

function phaseTerm(id: SolarBodyId, angle: number): number {
  if (id === "Moon") return 0.026 * angle + 4e-9 * angle ** 4;
  if (id === "Mercury") return 0.035 * angle;
  if (id === "Venus") return 0.0009 * angle + 0.000239 * angle ** 2 -
    0.00000065 * angle ** 3;
  if (id === "Mars") return 0.016 * angle;
  if (id === "Jupiter") return 0.005 * angle;
  if (id === "Saturn") return 0.044 * angle;
  return 0.001 * angle;
}

export function apparentMagnitudeFromCamera(
  definition: BodyDefinition,
  date: Date,
  body: Cartesian,
  camera: Cartesian,
  earth: Cartesian,
): number {
  const delta = distanceAu(body, camera);
  if (definition.id === "Sun") return ABSOLUTE_MAGNITUDE.Sun + 5 * Math.log10(delta);
  const r = Math.max(1e-12, Math.hypot(body.x, body.y, body.z) * AU_PER_PARSEC);
  const phase = phaseAngleDegrees(body, camera);
  const standard = ABSOLUTE_MAGNITUDE[definition.id] +
    5 * Math.log10(r * delta) + phaseTerm(definition.id, phase);
  if (definition.id === "Earth" || definition.id === "Moon") return standard;

  // At Earth use astronomy-engine's validated model; elsewhere retain the same
  // zero point while varying r, camera distance and phase with the standard law.
  const earthDelta = distanceAu(body, earth);
  if (distanceAu(camera, earth) < 1e-4) return Illumination(definition.body, date).mag;
  const earthPhase = phaseAngleDegrees(body, earth);
  const earthStandard = ABSOLUTE_MAGNITUDE[definition.id] +
    5 * Math.log10(r * earthDelta) + phaseTerm(definition.id, earthPhase);
  return standard + Illumination(definition.body, date).mag - earthStandard;
}
