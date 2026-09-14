export const PLANET_ORBIT_RADII_AU = [
  ["水星", 0.387], ["金星", 0.723], ["地球", 1], ["火星", 1.524],
  ["木星", 5.203], ["土星", 9.537], ["天王星", 19.191],
  ["海王星", 30.069], ["冥王星", 39.482],
] as const;

export function planetThreshold(position: number): number {
  if (position >= 1) return Infinity;
  return 0.1 * (600 ** Math.max(0, position));
}

export function planetFade(distanceAu: number, thresholdAu: number): number {
  if (!Number.isFinite(thresholdAu)) return 1;
  if (distanceAu <= thresholdAu * 0.9) return 1;
  if (distanceAu >= thresholdAu * 1.1) return 0;
  const value = (distanceAu / thresholdAu - 0.9) / 0.2;
  return 1 - value * value * (3 - 2 * value);
}

export function starDistanceVisible(
  distancePc: number,
  source: "gaia" | "stellarium-plx" | "unknown",
  minimum: number,
  maximum: number,
): boolean {
  const full = minimum <= 1 && maximum > 5_000;
  if (source === "unknown") return full;
  return distancePc >= minimum && (maximum > 5_000 || distancePc <= maximum);
}

export function segmentVisible(first: boolean, second: boolean): boolean {
  return first && second;
}

export function detectableStarMagnitude(
  brightnessScale: number,
  atmosphereScale: number,
  profileScale = 1,
): number {
  const effectiveScale = brightnessScale * atmosphereScale * profileScale;
  const requiredCoreBrightness = 0.9 / effectiveScale;
  if (!Number.isFinite(requiredCoreBrightness) || requiredCoreBrightness > 1) {
    return Number.NEGATIVE_INFINITY;
  }
  return 9.4 - requiredCoreBrightness * 9;
}

export function distanceSliderValue(parsecs: number): number {
  return parsecs > 5_000 ? 1 : Math.log10(Math.max(1, parsecs)) / Math.log10(5_000);
}

export function parsecsFromSlider(value: number): number {
  return value >= 0.9999 ? 5_001 : 10 ** (Math.max(0, value) * Math.log10(5_000));
}
