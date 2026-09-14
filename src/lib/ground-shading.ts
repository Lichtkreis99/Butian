export type Rgb = readonly [number, number, number];

export const NIGHT_GROUND_RGB: Rgb = [26, 29, 27];
export const DAY_GROUND_RGB: Rgb = [52, 58, 56];
export const LANDSCAPE_MEAN_RGB: Rgb = [115, 122, 60];
export const GROUND_SELFTEST_LOCATION = {
  latitude: 39.9316,
  longitude: 116.41,
} as const;
// Browser tests scan exactly 48 hourly instants from this Beijing summer-solstice date.
export const GROUND_SELFTEST_START = "2026-06-21T00:00:00.000Z";
export const GROUND_SELFTEST_HOURS = 48;

export function groundColorForSunAltitude(sunAltitude: number): Rgb {
  const raw = (sunAltitude + 18) / 38;
  const amount = Math.min(1, Math.max(0, raw));
  const smooth = amount * amount * (3 - 2 * amount);
  return NIGHT_GROUND_RGB.map((night, index) =>
    Math.round(night + (DAY_GROUND_RGB[index]! - night) * smooth),
  ) as unknown as Rgb;
}

export function landscapeDaylightForSunAltitude(sunAltitude: number): number {
  const amount = Math.min(1, Math.max(0, (sunAltitude + 12) / 20));
  const smooth = amount * amount * (3 - 2 * amount);
  return 0.22 + 0.78 * smooth;
}

export function landscapeGroundColorForSunAltitude(sunAltitude: number): Rgb {
  const daylight = landscapeDaylightForSunAltitude(sunAltitude);
  return LANDSCAPE_MEAN_RGB.map((channel) =>
    Math.round(channel * daylight)) as unknown as Rgb;
}

export function colorsWithinTolerance(
  actual: readonly number[],
  expected: Rgb,
  tolerance = 6,
): boolean {
  return expected.every((value, index) => Math.abs(actual[index]! - value) <= tolerance);
}

export function colorsHaveClearContrast(
  first: readonly number[],
  second: readonly number[],
): boolean {
  const luminance = (value: readonly number[]) =>
    value[0]! * 0.2126 + value[1]! * 0.7152 + value[2]! * 0.0722;
  const channelDistance = Math.hypot(
    first[0]! - second[0]!,
    first[1]! - second[1]!,
    first[2]! - second[2]!,
  );
  return Math.abs(luminance(first) - luminance(second)) >= 10 &&
    channelDistance >= 18;
}
