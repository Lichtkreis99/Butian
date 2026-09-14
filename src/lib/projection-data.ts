import type { ObserverLocation } from "./ephemeris";
import { calculateZhengyuFor } from "./zhengyu";

export const ZHENGYU_PROJECTION_BODIES = [
  "Sun",
  "Moon",
  "Mercury",
  "Venus",
  "Mars",
  "Jupiter",
  "Saturn",
] as const;

export const VIRTUAL_POINT_IDS = ["NorthNode", "SouthNode", "Lilith"] as const;

export type ZhengyuProjectionBody = typeof ZHENGYU_PROJECTION_BODIES[number];
export type VirtualPointId = typeof VIRTUAL_POINT_IDS[number];

export interface RingPosition {
  id: ZhengyuProjectionBody | VirtualPointId | "Ziqi";
  longitude: number;
  latitude: number;
  mansion: number;
  mansionDegree: number;
}

export interface ProjectionSnapshot {
  positions: RingPosition[];
  mansionLongitudes: number[];
}

export function projectionSnapshot(
  date: Date,
  location: ObserverLocation,
  timeZone: string,
  calcType: 0 | 4 = 0,
): ProjectionSnapshot {
  const result = calculateZhengyuFor({
    date,
    location,
    timeZone,
    gender: "male",
    calcType,
  });
  const names = new Set<string>([
    ...ZHENGYU_PROJECTION_BODIES,
    ...VIRTUAL_POINT_IDS,
    "Ziqi",
  ]);
  return {
    positions: result.planets2
      .filter((planet) => names.has(planet.name))
      .map((planet) => ({
        id: planet.name as RingPosition["id"],
        longitude: planet.lng,
        latitude: planet.lat,
        mansion: planet.xingxiu,
        mansionDegree: planet.xingxiu_degree,
      })),
    mansionLongitudes: result.xingxiu_list.map((mansion) => mansion.lng),
  };
}

export function projectionRingPositions(
  date: Date,
  location: ObserverLocation,
  timeZone: string,
  calcType: 0 | 4 = 0,
): RingPosition[] {
  return projectionSnapshot(date, location, timeZone, calcType).positions;
}
