import type { Cartesian } from "./coordinates";

export function projectToCelestialSphere(
  position: Cartesian,
  viewpoint: Cartesian,
  radius: number,
): Cartesian {
  const x = position.x - viewpoint.x;
  const y = position.y - viewpoint.y;
  const z = position.z - viewpoint.z;
  const length = Math.hypot(x, y, z);
  if (!length) return { ...viewpoint };
  const scale = radius / length;
  return {
    x: viewpoint.x + x * scale,
    y: viewpoint.y + y * scale,
    z: viewpoint.z + z * scale,
  };
}

export function angularSeparation(first: Cartesian, second: Cartesian): number {
  const denominator = Math.hypot(first.x, first.y, first.z) *
    Math.hypot(second.x, second.y, second.z);
  if (!denominator) return 0;
  const cosine = Math.max(-1, Math.min(1,
    (first.x * second.x + first.y * second.y + first.z * second.z) / denominator));
  return Math.acos(cosine) * 180 / Math.PI;
}

export function gaitianRadius(declination: number): number {
  return (90 - declination) / 90;
}

export function gaitianPoint(ra: number, declination: number): { x: number; y: number } {
  const radius = gaitianRadius(declination);
  const angle = (ra - 90) * Math.PI / 180;
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
}

export function circumpolarRadius(latitude: number): number {
  return Math.max(0, latitude) / 90;
}

export function southernVisibilityRadius(latitude: number): number {
  return Math.min(2, (180 - latitude) / 90);
}
