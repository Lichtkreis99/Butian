export function clampBortle(value: number): number {
  return Math.min(9, Math.max(1, Math.round(value)));
}

export function bortleLimitingMagnitude(value: number): number {
  return 8.05 - clampBortle(value) * 0.45;
}

export function fovLimitingMagnitude(fov: number, bortle: number): number {
  const zoomGain = Math.min(1.4, Math.max(0, Math.log2(180 / Math.max(1, fov)) * 0.55));
  return bortleLimitingMagnitude(bortle) - 1.4 + zoomGain;
}

export function starLabelMagnitude(fov: number, density: number): number {
  const zoom = Math.max(0, Math.log2(180 / Math.max(1, fov)));
  return -0.8 + Math.min(7.3, zoom * 1.45) +
    Math.min(1, Math.max(0, density)) * 1.8;
}

export function fovLabelCap(baseCap: number, fov: number): number {
  const scale = Math.min(1, Math.max(0, Math.log2(180 / Math.max(1, fov)) / 4.2));
  return Math.min(baseCap, Math.round(25 + (baseCap - 25) * scale));
}

export function airmassForAltitude(altitude: number): number {
  if (altitude <= -1) return 40;
  const radians = altitude * Math.PI / 180;
  return 1 / (Math.sin(radians) + 0.50572 * (altitude + 6.07995) ** -1.6364);
}

export function extinctionMagnitude(altitude: number, coefficient = 0.2): number {
  return coefficient * Math.min(40, airmassForAltitude(altitude));
}

export function saemundssonRefraction(altitude: number): number {
  if (altitude < -1 || altitude > 90) return 0;
  const angle = (altitude + 10.3 / (altitude + 5.11)) * Math.PI / 180;
  return 1.02 / Math.tan(angle) / 60;
}

export function milkyWayBrightness(options: {
  bortle: number;
  fov: number;
  sunAltitude: number;
  moonAltitude: number;
  atmosphere: boolean;
}): number {
  if (options.bortle >= 9 && options.sunAltitude > 0) return 0;
  const pollution = Math.max(0, (10 - clampBortle(options.bortle)) / 9);
  const sun = options.atmosphere
    ? Math.min(1, Math.max(0, (-options.sunAltitude - 4) / 14)) : 1;
  const moon = options.atmosphere
    ? 1 - Math.min(0.7, Math.max(0, options.moonAltitude + 5) / 100) : 1;
  const fov = Math.min(1, Math.max(0.2, Math.sqrt(90 / Math.max(10, options.fov))));
  return 0.34 * pollution ** 1.7 * sun * moon * fov;
}

export function dsoVisible(magnitude: number, fov: number, bortle: number): boolean {
  if (!Number.isFinite(magnitude) || magnitude <= 0) return fov <= 20;
  return magnitude <= fovLimitingMagnitude(fov, bortle) + 1.2 && fov <= 100;
}

export function deepSkyBrightness(
  sunAltitude: number,
  moonAltitude: number,
  atmosphere: boolean,
): number {
  if (!atmosphere) return 1;
  const sun = Math.min(1, Math.max(0, (-sunAltitude - 4) / 14));
  const moon = 1 - Math.min(0.65, Math.max(0, moonAltitude + 5) / 100);
  return sun * moon;
}

export function inertiaAfterFrames(
  initial: number,
  frames: number,
  decayPerSecond = 6,
  framesPerSecond = 60,
): number {
  return initial * Math.exp(-decayPerSecond * frames / framesPerSecond);
}

export function interpolateLogFov(from: number, to: number, progress: number): number {
  const t = Math.min(1, Math.max(0, progress));
  return Math.exp(Math.log(from) * (1 - t) + Math.log(to) * t);
}
