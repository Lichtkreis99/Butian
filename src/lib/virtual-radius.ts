import type { Cartesian } from "./coordinates";

export function virtualRadiusOffset(longitude: number, radius: number): Cartesian {
  const angle = longitude * Math.PI / 180;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    z: 0,
  };
}

export function virtualRadiusPosition(
  earth: Cartesian,
  longitude: number,
  radius: number,
): Cartesian {
  const offset = virtualRadiusOffset(longitude, radius);
  return { x: earth.x + offset.x, y: earth.y + offset.y, z: earth.z };
}
