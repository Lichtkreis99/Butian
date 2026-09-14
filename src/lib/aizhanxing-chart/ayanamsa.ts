// @ts-nocheck -- vendored reference engine; calculation logic intentionally unchanged.
import { normalizeDegrees } from "./math";
import type { Ayanamsa } from "./types";

const REFERENCE_JULIAN_DAY = 2_451_604.8541666665;

/** Values returned by Swiss Ephemeris for the captured 2000-03-01 08:30 UTC chart. */
const REFERENCE_AYANAMSAS: Readonly<Record<Exclude<Ayanamsa, 255>, number>> = {
  0: 24.73876063,
  1: 23.855552989,
  2: 27.814213422,
  3: 22.409251676,
  4: 20.056001663,
  5: 23.758700676,
  6: 28.358139263,
  7: 22.477263663,
  8: 22.760597663,
  29: 22.725348849,
};

function julianDay(date: Date) {
  return date.getTime() / 86_400_000 + 2_440_587.5;
}

/** IAU general precession in longitude, adequate for Swiss-compatible ayanamsa drift. */
function precessionArcSecondsFromJ2000(jd: number) {
  const centuries = (jd - 2_451_545) / 36_525;
  return (
    5_028.796195 * centuries +
    1.1054348 * centuries ** 2 +
    0.00007964 * centuries ** 3 -
    0.000023857 * centuries ** 4
  );
}

export function calculateAyanamsa(
  date: Date,
  mode: Ayanamsa = 0,
  customDegrees = 0,
) {
  if (mode === 255) return normalizeDegrees(customDegrees);
  const drift =
    (precessionArcSecondsFromJ2000(julianDay(date)) -
      precessionArcSecondsFromJ2000(REFERENCE_JULIAN_DAY)) /
    3_600;
  return normalizeDegrees(REFERENCE_AYANAMSAS[mode] + drift);
}
