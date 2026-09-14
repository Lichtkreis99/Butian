import type { UnitVector } from "./planetarium";

const JRLL = [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4] as const;
const JPLL = [1, 3, 5, 7, 0, 2, 4, 6, 1, 3, 5, 7] as const;

function deinterleave(value: number): [number, number] {
  let x = 0;
  let y = 0;
  let bit = 0;
  while (value > 0) {
    x |= (value & 1) << bit;
    value >>>= 1;
    y |= (value & 1) << bit;
    value >>>= 1;
    bit += 1;
  }
  return [x, y];
}

export function healpixTileDirection(
  order: number,
  pixel: number,
  u = 0.5,
  v = 0.5,
): UnitVector {
  const nside = 2 ** order;
  const facePixels = nside * nside;
  const face = Math.floor(pixel / facePixels);
  const [ix, iy] = deinterleave(pixel % facePixels);
  const x = ix + u - 0.5;
  const y = iy + v - 0.5;
  const jr = JRLL[face]! * nside - x - y - 1;
  let nr: number;
  let z: number;
  let shift: number;
  if (jr < nside) {
    nr = Math.max(1e-9, jr);
    z = 1 - nr * nr / (3 * nside * nside);
    shift = 0;
  } else if (jr > 3 * nside) {
    nr = Math.max(1e-9, 4 * nside - jr);
    z = -1 + nr * nr / (3 * nside * nside);
    shift = 0;
  } else {
    nr = nside;
    z = (2 * nside - jr) * 2 / (3 * nside);
    shift = (Math.floor(jr) - nside) & 1;
  }
  let jp = (JPLL[face]! * nr + x - y + 1 + shift) / 2;
  const around = 4 * nr;
  jp = ((jp - 1) % around + around) % around + 1;
  const phi = (jp - (shift + 1) * 0.5) * Math.PI / (2 * nr);
  const radial = Math.sqrt(Math.max(0, 1 - z * z));
  return { x: radial * Math.cos(phi), y: radial * Math.sin(phi), z };
}

export function healpixPixelForDirection(order: number, direction: UnitVector): number {
  const count = 12 * 4 ** order;
  const length = Math.hypot(direction.x, direction.y, direction.z) || 1;
  let best = 0;
  let bestDot = -Infinity;
  for (let pixel = 0; pixel < count; pixel += 1) {
    const centre = healpixTileDirection(order, pixel);
    const dot = (direction.x * centre.x + direction.y * centre.y +
      direction.z * centre.z) / length;
    if (dot > bestDot) {
      bestDot = dot;
      best = pixel;
    }
  }
  return best;
}

export function healpixLandscapeTileCoordinates(
  gridCoordinate: number,
  tileSize = 512,
): { direction: number; texture: number } {
  const halfTexel = 0.5 / tileSize;
  return {
    direction: -halfTexel + (1 + halfTexel * 2) * gridCoordinate,
    texture: halfTexel + (1 - halfTexel * 2) * gridCoordinate,
  };
}
