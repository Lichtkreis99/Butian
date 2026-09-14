import {
  EquatorFromVector,
  Horizon,
  MakeTime,
  Observer,
  RotateVector,
  Rotation_ECT_EQD,
  Rotation_HOR_EQJ,
  Spherical,
  Vector,
  VectorFromHorizon,
} from "astronomy-engine";

import {
  equatorialToEclipticJ2000,
  normalizeDegrees,
  type Cartesian,
} from "./coordinates";
import type { ObserverLocation } from "./ephemeris";

export interface HorizontalCoordinates {
  altitude: number;
  azimuth: number;
}

export interface UnitVector {
  x: number;
  y: number;
  z: number;
}

export type PureProjection = "stereographic" | "perspective" | "fisheye";

function normalized(direction: UnitVector): UnitVector {
  const length = Math.hypot(direction.x, direction.y, direction.z) || 1;
  return {
    x: direction.x / length,
    y: direction.y / length,
    z: direction.z / length,
  };
}

export function horizontalDirectionEcliptic(
  date: Date,
  location: ObserverLocation,
  azimuth: number,
  altitude: number,
): Cartesian {
  const horizontal = VectorFromHorizon(
    new Spherical(altitude, normalizeDegrees(azimuth), 1),
    MakeTime(date),
    "",
  );
  const observer = new Observer(
    location.latitude,
    location.longitude,
    location.elevation ?? 0,
  );
  return equatorialToEclipticJ2000(
    RotateVector(Rotation_HOR_EQJ(date, observer), horizontal),
  );
}

export function eclipticPointHorizontal(
  longitude: number,
  latitude: number,
  date: Date,
  location: ObserverLocation,
): HorizontalCoordinates {
  const radiansLongitude = longitude * Math.PI / 180;
  const radiansLatitude = latitude * Math.PI / 180;
  const ofDate = new Vector(
    Math.cos(radiansLatitude) * Math.cos(radiansLongitude),
    Math.cos(radiansLatitude) * Math.sin(radiansLongitude),
    Math.sin(radiansLatitude),
    MakeTime(date),
  );
  const equatorial = EquatorFromVector(RotateVector(Rotation_ECT_EQD(date), ofDate));
  const observer = new Observer(
    location.latitude,
    location.longitude,
    location.elevation ?? 0,
  );
  const horizon = Horizon(date, observer, equatorial.ra, equatorial.dec, "");
  return { altitude: horizon.altitude, azimuth: horizon.azimuth };
}

export function equatorialHorizontal(
  rightAscensionDegrees: number,
  declination: number,
  date: Date,
  location: ObserverLocation,
): HorizontalCoordinates {
  const observer = new Observer(
    location.latitude,
    location.longitude,
    location.elevation ?? 0,
  );
  const horizon = Horizon(
    date,
    observer,
    rightAscensionDegrees / 15,
    declination,
    "",
  );
  return { altitude: horizon.altitude, azimuth: horizon.azimuth };
}

export function stereographicForward(direction: UnitVector): { x: number; y: number } {
  const { x, y, z } = normalized(direction);
  const denominator = Math.max(1e-15, 1 + z);
  return { x: 2 * x / denominator, y: 2 * y / denominator };
}


export function perspectiveForward(direction: UnitVector): { x: number; y: number } {
  const value = normalized(direction);
  return { x: value.x / value.z, y: value.y / value.z };
}

export function perspectiveInverse(point: { x: number; y: number }): UnitVector {
  return normalized({ x: point.x, y: point.y, z: 1 });
}

export function fisheyeForward(direction: UnitVector): { x: number; y: number } {
  const value = normalized(direction);
  const theta = Math.acos(Math.min(1, Math.max(-1, value.z)));
  const radial = Math.hypot(value.x, value.y);
  return radial < 1e-15
    ? { x: 0, y: 0 }
    : { x: value.x / radial * theta, y: value.y / radial * theta };
}

export function fisheyeInverse(point: { x: number; y: number }): UnitVector {
  const theta = Math.hypot(point.x, point.y);
  if (theta < 1e-15) return { x: 0, y: 0, z: 1 };
  const sine = Math.sin(theta);
  return {
    x: point.x / theta * sine,
    y: point.y / theta * sine,
    z: Math.cos(theta),
  };
}

export function projectionForward(
  projection: PureProjection,
  direction: UnitVector,
): { x: number; y: number } {
  if (projection === "perspective") return perspectiveForward(direction);
  if (projection === "fisheye") return fisheyeForward(direction);
  return stereographicForward(direction);
}

export function projectionInverse(
  projection: PureProjection,
  point: { x: number; y: number },
): UnitVector {
  if (projection === "perspective") return perspectiveInverse(point);
  if (projection === "fisheye") return fisheyeInverse(point);
  return stereographicInverse(point);
}

export function altitudeFromDirection(direction: UnitVector, up: UnitVector): number {
  const value = normalized(direction);
  const zenith = normalized(up);
  return Math.asin(Math.min(1, Math.max(-1,
    value.x * zenith.x + value.y * zenith.y + value.z * zenith.z,
  ))) * 180 / Math.PI;
}

export function stereographicInverse(point: { x: number; y: number }): UnitVector {
  const radiusSquared = point.x * point.x + point.y * point.y;
  const denominator = 4 + radiusSquared;
  return {
    x: 4 * point.x / denominator,
    y: 4 * point.y / denominator,
    z: (4 - radiusSquared) / denominator,
  };
}
