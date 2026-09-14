import {
  MakeTime,
  RotateVector,
  Rotation_ECL_EQJ,
  Rotation_EQJ_ECL,
  Rotation_EQJ_ECT,
  Vector,
} from "astronomy-engine";

export interface Cartesian {
  x: number;
  y: number;
  z: number;
}

export interface SphericalPosition {
  longitude: number;
  latitude: number;
  radius: number;
}

export const AU_PER_PARSEC = 206_264.80624709636;
export const LIGHT_YEARS_PER_PARSEC = 3.261563777;
export const METERS_PER_PARSEC = 3.085677581491367e16;
export const GAIA_METERS_PER_UNIT = 1e9;
export const ECLIPTIC_TO_WORLD_GLSL = `
  vec3 eclipticToWorld(vec3 vector) {
    return vec3(vector.x, vector.z, -vector.y);
  }
`;

const j2000 = MakeTime(new Date("2000-01-01T12:00:00.000Z"));

export function gaiaToEquatorialJ2000(gaia: Cartesian): Cartesian {
  return { x: gaia.z, y: gaia.x, z: gaia.y };
}

export function equatorialToEclipticJ2000(vector: Cartesian): Cartesian {
  const rotated = RotateVector(
    Rotation_EQJ_ECL(),
    new Vector(vector.x, vector.y, vector.z, j2000),
  );
  return { x: rotated.x, y: rotated.y, z: rotated.z };
}

export function eclipticToEquatorialJ2000(vector: Cartesian): Cartesian {
  const rotated = RotateVector(
    Rotation_ECL_EQJ(),
    new Vector(vector.x, vector.y, vector.z, j2000),
  );
  return { x: rotated.x, y: rotated.y, z: rotated.z };
}

export function gaiaPositionToEclipticParsecs(gaia: Cartesian): Cartesian {
  const scale = GAIA_METERS_PER_UNIT / METERS_PER_PARSEC;
  const ecliptic = equatorialToEclipticJ2000(gaiaToEquatorialJ2000(gaia));
  return scaleCartesian(ecliptic, scale);
}

export function gaiaVelocityToEclipticParsecsPerYear(gaia: Cartesian): Cartesian {
  const scale = GAIA_METERS_PER_UNIT / METERS_PER_PARSEC;
  const ecliptic = equatorialToEclipticJ2000(gaiaToEquatorialJ2000(gaia));
  return scaleCartesian(ecliptic, scale);
}

export function equatorialJ2000ToEclipticOfDate(
  vector: Cartesian,
  date: Date,
): Cartesian {
  const rotated = RotateVector(
    Rotation_EQJ_ECT(date),
    new Vector(vector.x, vector.y, vector.z, MakeTime(date)),
  );
  return { x: rotated.x, y: rotated.y, z: rotated.z };
}

export function eclipticJ2000ToEclipticOfDate(
  vector: Cartesian,
  date: Date,
): Cartesian {
  return equatorialJ2000ToEclipticOfDate(
    eclipticToEquatorialJ2000(vector),
    date,
  );
}

export function eclipticToWorld(vector: Cartesian): Cartesian {
  return { x: vector.x, y: vector.z, z: -vector.y };
}

export function worldToEcliptic(vector: Cartesian): Cartesian {
  return { x: vector.x, y: -vector.z, z: vector.y };
}

export function cartesianToSpherical(vector: Cartesian): SphericalPosition {
  const radius = Math.hypot(vector.x, vector.y, vector.z);
  if (radius === 0) return { longitude: 0, latitude: 0, radius: 0 };
  const radiansToDegrees = 180 / Math.PI;
  return {
    longitude: normalizeDegrees(Math.atan2(vector.y, vector.x) * radiansToDegrees),
    latitude: Math.asin(vector.z / radius) * radiansToDegrees,
    radius,
  };
}

export function scaleCartesian(vector: Cartesian, scale: number): Cartesian {
  return { x: vector.x * scale, y: vector.y * scale, z: vector.z * scale };
}

export function addCartesian(first: Cartesian, second: Cartesian): Cartesian {
  return {
    x: first.x + second.x,
    y: first.y + second.y,
    z: first.z + second.z,
  };
}

export function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}
