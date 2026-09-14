// @ts-nocheck -- vendored reference engine; calculation logic intentionally unchanged.
export const DEGREES_TO_RADIANS = Math.PI / 180;
export const RADIANS_TO_DEGREES = 180 / Math.PI;

export function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

export function angularDistance(first: number, second: number) {
  const distance = Math.abs(normalizeDegrees(first - second));
  return Math.min(distance, 360 - distance);
}

export function signIndex(longitude: number) {
  return Math.floor(normalizeDegrees(longitude) / 30);
}

export function degreeWithinSign(longitude: number) {
  return normalizeDegrees(longitude) % 30;
}

export function formatZodiacDegree(longitude: number) {
  const totalMinutes = Math.round(degreeWithinSign(longitude) * 60) % (30 * 60);
  const degrees = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${degrees}°${String(minutes).padStart(2, "0")}'`;
}
