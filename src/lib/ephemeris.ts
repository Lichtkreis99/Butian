import {
  Body,
  Ecliptic,
  Equator,
  GeoVector,
  HelioVector,
  Horizon,
  Illumination,
  Observer,
} from "astronomy-engine";

import {
  AU_PER_PARSEC,
  cartesianToSpherical,
  equatorialToEclipticJ2000,
  type Cartesian,
} from "./coordinates";

export type SolarBodyId =
  | "Sun"
  | "Mercury"
  | "Venus"
  | "Earth"
  | "Moon"
  | "Mars"
  | "Jupiter"
  | "Saturn"
  | "Uranus"
  | "Neptune"
  | "Pluto";

export interface BodyDefinition {
  id: SolarBodyId;
  body: Body;
  nameZh: string;
  symbol: string;
  color: number;
  orbitDays: number;
}

export interface ObserverLocation {
  latitude: number;
  longitude: number;
  elevation?: number;
}

export const BODY_DEFINITIONS: readonly BodyDefinition[] = [
  { id: "Sun", body: Body.Sun, nameZh: "太阳", symbol: "☉", color: 0xffcc62,
    orbitDays: 1 },
  { id: "Mercury", body: Body.Mercury, nameZh: "水星", symbol: "☿", color: 0xb7aa98,
    orbitDays: 87.969 },
  { id: "Venus", body: Body.Venus, nameZh: "金星", symbol: "♀", color: 0xf3c987,
    orbitDays: 224.701 },
  { id: "Earth", body: Body.Earth, nameZh: "地球", symbol: "⊕", color: 0x79aee8,
    orbitDays: 365.256 },
  { id: "Moon", body: Body.Moon, nameZh: "月球", symbol: "☾", color: 0xd9d9cf,
    orbitDays: 27.322 },
  { id: "Mars", body: Body.Mars, nameZh: "火星", symbol: "♂", color: 0xc75a43,
    orbitDays: 686.98 },
  { id: "Jupiter", body: Body.Jupiter, nameZh: "木星", symbol: "♃", color: 0xd6a36f,
    orbitDays: 4_332.59 },
  { id: "Saturn", body: Body.Saturn, nameZh: "土星", symbol: "♄", color: 0xc7ad72,
    orbitDays: 10_759.22 },
  { id: "Uranus", body: Body.Uranus, nameZh: "天王星", symbol: "♅", color: 0x78c7cb,
    orbitDays: 30_688.5 },
  { id: "Neptune", body: Body.Neptune, nameZh: "海王星", symbol: "♆", color: 0x638bc7,
    orbitDays: 60_182 },
  { id: "Pluto", body: Body.Pluto, nameZh: "冥王星", symbol: "♇", color: 0x9c8574,
    orbitDays: 90_560 },
];

export function heliocentricEclipticPosition(
  definition: BodyDefinition,
  date: Date,
): Cartesian {
  if (definition.id === "Sun") return { x: 0, y: 0, z: 0 };
  const vector = HelioVector(definition.body, date);
  return equatorialToEclipticJ2000(vector);
}

export function heliocentricPositionParsecs(
  definition: BodyDefinition,
  date: Date,
): Cartesian {
  const position = heliocentricEclipticPosition(definition, date);
  return {
    x: position.x / AU_PER_PARSEC,
    y: position.y / AU_PER_PARSEC,
    z: position.z / AU_PER_PARSEC,
  };
}

export function geocentricPositionParsecs(body: Body, date: Date): Cartesian {
  const position = equatorialToEclipticJ2000(GeoVector(body, date, false));
  return {
    x: position.x / AU_PER_PARSEC,
    y: position.y / AU_PER_PARSEC,
    z: position.z / AU_PER_PARSEC,
  };
}

export function geocentricLongitude(body: Body, date: Date): number {
  return Ecliptic(GeoVector(body, date, true)).elon;
}

export function bodyDetails(
  definition: BodyDefinition,
  date: Date,
  location: ObserverLocation,
) {
  const observer = new Observer(
    location.latitude,
    location.longitude,
    location.elevation ?? 0,
  );
  const equatorial = Equator(definition.body, date, observer, true, true);
  const horizontal = Horizon(date, observer, equatorial.ra, equatorial.dec, "normal");
  const geocentric = GeoVector(definition.body, date, true);
  const ecliptic = Ecliptic(geocentric);
  const j2000 = cartesianToSpherical(equatorialToEclipticJ2000(geocentric));
  let magnitude: number | undefined;
  if (definition.id !== "Earth" && definition.id !== "Moon") {
    magnitude = Illumination(definition.body, date).mag;
  }
  return {
    ra: equatorial.ra * 15,
    dec: equatorial.dec,
    longitude: ecliptic.elon,
    latitude: ecliptic.elat,
    j2000Longitude: j2000.longitude,
    distanceAu: geocentric.Length(),
    altitude: horizontal.altitude,
    azimuth: horizontal.azimuth,
    magnitude,
  };
}
