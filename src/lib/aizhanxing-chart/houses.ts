// @ts-nocheck -- vendored reference engine; calculation logic intentionally unchanged.
import { MakeTime, SiderealTime, e_tilt } from "astronomy-engine";

import { DEGREES_TO_RADIANS, RADIANS_TO_DEGREES, normalizeDegrees } from "./math";
import type { HouseSystem } from "./types";

interface HouseCalculation {
  ascendant: number;
  midheaven: number;
  cusps: number[];
  fallback?: "Porphyry";
}

function eclipticRightAscension(longitude: number, obliquity: number) {
  const lambda = longitude * DEGREES_TO_RADIANS;
  const epsilon = obliquity * DEGREES_TO_RADIANS;
  return normalizeDegrees(
    Math.atan2(Math.sin(lambda) * Math.cos(epsilon), Math.cos(lambda)) *
      RADIANS_TO_DEGREES,
  );
}

function rightAscensionToEcliptic(rightAscension: number, obliquity: number) {
  const alpha = rightAscension * DEGREES_TO_RADIANS;
  const epsilon = obliquity * DEGREES_TO_RADIANS;
  return normalizeDegrees(
    Math.atan2(Math.sin(alpha) / Math.cos(epsilon), Math.cos(alpha)) *
      RADIANS_TO_DEGREES,
  );
}

function closestOpposition(longitude: number, reference: number) {
  const opposite = normalizeDegrees(longitude + 180);
  const distance = (value: number) => {
    const delta = normalizeDegrees(value - reference);
    return Math.min(delta, 360 - delta);
  };
  return distance(opposite) < distance(longitude) ? opposite : longitude;
}

function oppositeCusps(firstSix: number[]) {
  const cusps = Array<number>(13);
  for (let index = 0; index < 6; index += 1) {
    cusps[index + 1] = normalizeDegrees(firstSix[index]);
    cusps[index + 7] = normalizeDegrees(firstSix[index] + 180);
  }
  return cusps;
}

function equatorialAtLongitude(longitude: number, obliquity: number) {
  const lambda = longitude * DEGREES_TO_RADIANS;
  const epsilon = obliquity * DEGREES_TO_RADIANS;
  return {
    rightAscension: normalizeDegrees(
      Math.atan2(Math.sin(lambda) * Math.cos(epsilon), Math.cos(lambda)) * RADIANS_TO_DEGREES,
    ),
    declination: Math.asin(Math.sin(lambda) * Math.sin(epsilon)) * RADIANS_TO_DEGREES,
  };
}

function solveCusp(
  house: 2 | 3 | 11 | 12,
  lowerLongitude: number,
  upperLongitude: number,
  localSiderealDegrees: number,
  latitude: number,
  obliquity: number,
) {
  const latitudeRadians = latitude * DEGREES_TO_RADIANS;
  const residual = (longitude: number) => {
    const equatorial = equatorialAtLongitude(normalizeDegrees(longitude), obliquity);
    const ascensionalArgument =
      Math.tan(latitudeRadians) * Math.tan(equatorial.declination * DEGREES_TO_RADIANS);
    if (Math.abs(ascensionalArgument) >= 1) return undefined;
    const ascensionalDifference = Math.asin(ascensionalArgument) * RADIANS_TO_DEGREES;
    const semiDiurnal = 90 + ascensionalDifference;
    const semiNocturnal = 90 - ascensionalDifference;
    const targetRightAscension =
      house === 11
        ? localSiderealDegrees + semiDiurnal / 3
        : house === 12
          ? localSiderealDegrees + (2 * semiDiurnal) / 3
          : house === 2
            ? localSiderealDegrees + semiDiurnal + semiNocturnal / 3
            : localSiderealDegrees + semiDiurnal + (2 * semiNocturnal) / 3;
    let unwrappedRightAscension = equatorial.rightAscension;
    while (unwrappedRightAscension < localSiderealDegrees) unwrappedRightAscension += 360;
    return unwrappedRightAscension - targetRightAscension;
  };

  let lower = lowerLongitude;
  let upper = upperLongitude;
  if (upper <= lower) upper += 360;
  let lowerResidual = residual(lower);
  const upperResidual = residual(upper);
  if (
    lowerResidual === undefined ||
    upperResidual === undefined ||
    lowerResidual * upperResidual > 0
  ) {
    return undefined;
  }

  for (let iteration = 0; iteration < 64; iteration += 1) {
    const middle = (lower + upper) / 2;
    const middleResidual = residual(middle);
    if (middleResidual === undefined) return undefined;
    if (lowerResidual * middleResidual <= 0) {
      upper = middle;
    } else {
      lower = middle;
      lowerResidual = middleResidual;
    }
  }
  return normalizeDegrees((lower + upper) / 2);
}

function porphyryCusps(ascendant: number, midheaven: number) {
  const cusps = Array<number>(13);
  cusps[1] = ascendant;
  cusps[4] = normalizeDegrees(midheaven + 180);
  cusps[7] = normalizeDegrees(ascendant + 180);
  cusps[10] = midheaven;
  const quadrant = (start: number, end: number, firstHouse: number) => {
    const arc = normalizeDegrees(end - start);
    cusps[firstHouse] = normalizeDegrees(start + arc / 3);
    cusps[firstHouse + 1] = normalizeDegrees(start + (2 * arc) / 3);
  };
  quadrant(cusps[1], cusps[4], 2);
  quadrant(cusps[4], cusps[7], 5);
  quadrant(cusps[7], cusps[10], 8);
  quadrant(cusps[10], cusps[1], 11);
  return cusps;
}

function equalCusps(start: number) {
  const cusps = Array<number>(13);
  for (let house = 1; house <= 12; house += 1) {
    cusps[house] = normalizeDegrees(start + (house - 1) * 30);
  }
  return cusps;
}

function raDivisionCusps(ascendant: number, midheaven: number, obliquity: number) {
  const ascendantRa = eclipticRightAscension(ascendant, obliquity);
  const midheavenRa = eclipticRightAscension(midheaven, obliquity);
  const lowerMeridianRa = normalizeDegrees(midheavenRa + 180);
  const lowerArc = normalizeDegrees(lowerMeridianRa - ascendantRa);
  const cusp2 = rightAscensionToEcliptic(ascendantRa + lowerArc / 3, obliquity);
  const cusp3 = rightAscensionToEcliptic(ascendantRa + (2 * lowerArc) / 3, obliquity);
  const upperArc = normalizeDegrees(ascendantRa - midheavenRa);
  const cusp11 = rightAscensionToEcliptic(midheavenRa + upperArc / 3, obliquity);
  const cusp12 = rightAscensionToEcliptic(midheavenRa + (2 * upperArc) / 3, obliquity);
  return oppositeCusps([
    ascendant,
    cusp2,
    cusp3,
    normalizeDegrees(midheaven + 180),
    normalizeDegrees(cusp11 + 180),
    normalizeDegrees(cusp12 + 180),
  ]);
}

function regioCusps(
  localSiderealDegrees: number,
  latitude: number,
  obliquity: number,
  ascendant: number,
) {
  const theta = localSiderealDegrees * DEGREES_TO_RADIANS;
  const phi = latitude * DEGREES_TO_RADIANS;
  const epsilon = obliquity * DEGREES_TO_RADIANS;
  const north = [
    -Math.sin(phi) * Math.cos(theta),
    -Math.sin(phi) * Math.sin(theta),
    Math.cos(phi),
  ];
  const cusps = Array<number>(13);
  for (let house = 1; house <= 12; house += 1) {
    const alpha = (localSiderealDegrees + (house - 10) * 30) * DEGREES_TO_RADIANS;
    const equatorPoint = [Math.cos(alpha), Math.sin(alpha), 0];
    const plane = [
      north[1] * equatorPoint[2] - north[2] * equatorPoint[1],
      north[2] * equatorPoint[0] - north[0] * equatorPoint[2],
      north[0] * equatorPoint[1] - north[1] * equatorPoint[0],
    ];
    const longitude = normalizeDegrees(
      Math.atan2(
        -plane[0],
        plane[1] * Math.cos(epsilon) + plane[2] * Math.sin(epsilon),
      ) * RADIANS_TO_DEGREES,
    );
    cusps[house] = closestOpposition(longitude, ascendant + (house - 1) * 30);
  }
  return cusps;
}

function campanusCusps(
  localSiderealDegrees: number,
  latitude: number,
  obliquity: number,
  ascendant: number,
) {
  const theta = localSiderealDegrees * DEGREES_TO_RADIANS;
  const phi = latitude * DEGREES_TO_RADIANS;
  const epsilon = obliquity * DEGREES_TO_RADIANS;
  const zenith = [
    Math.cos(phi) * Math.cos(theta),
    Math.cos(phi) * Math.sin(theta),
    Math.sin(phi),
  ];
  const north = [
    -Math.sin(phi) * Math.cos(theta),
    -Math.sin(phi) * Math.sin(theta),
    Math.cos(phi),
  ];
  const east = [-Math.sin(theta), Math.cos(theta), 0];
  const cusps = Array<number>(13);
  for (let house = 1; house <= 12; house += 1) {
    const angle = (house - 10) * 30 * DEGREES_TO_RADIANS;
    const primeVerticalPoint = [
      zenith[0] * Math.cos(angle) + east[0] * Math.sin(angle),
      zenith[1] * Math.cos(angle) + east[1] * Math.sin(angle),
      zenith[2] * Math.cos(angle),
    ];
    const plane = [
      north[1] * primeVerticalPoint[2] - north[2] * primeVerticalPoint[1],
      north[2] * primeVerticalPoint[0] - north[0] * primeVerticalPoint[2],
      north[0] * primeVerticalPoint[1] - north[1] * primeVerticalPoint[0],
    ];
    const longitude = normalizeDegrees(
      Math.atan2(
        -plane[0],
        plane[1] * Math.cos(epsilon) + plane[2] * Math.sin(epsilon),
      ) * RADIANS_TO_DEGREES,
    );
    cusps[house] = closestOpposition(longitude, ascendant + (house - 1) * 30);
  }
  return cusps;
}

function topocentricCusps(
  localSiderealDegrees: number,
  latitude: number,
  obliquity: number,
  ascendant: number,
  midheaven: number,
) {
  const pseudoLatitude = (fraction: number) =>
    Math.atan(Math.tan(latitude * DEGREES_TO_RADIANS) * fraction) *
    RADIANS_TO_DEGREES;
  const ascendantAt = (offset: number, fraction: number) => {
    const theta = (localSiderealDegrees + offset) * DEGREES_TO_RADIANS;
    const epsilon = obliquity * DEGREES_TO_RADIANS;
    const phi = pseudoLatitude(fraction) * DEGREES_TO_RADIANS;
    return normalizeDegrees(
      Math.atan2(
        Math.cos(theta),
        -(Math.sin(epsilon) * Math.tan(phi) + Math.cos(epsilon) * Math.sin(theta)),
      ) * RADIANS_TO_DEGREES,
    );
  };
  return oppositeCusps([
    ascendant,
    ascendantAt(30, 2 / 3),
    ascendantAt(60, 1 / 3),
    normalizeDegrees(midheaven + 180),
    normalizeDegrees(ascendantAt(-60, 1 / 3) + 180),
    normalizeDegrees(ascendantAt(-30, 2 / 3) + 180),
  ]);
}

function kochCusps(
  localSiderealDegrees: number,
  latitude: number,
  obliquity: number,
  ascendant: number,
  midheaven: number,
) {
  const phi = latitude * DEGREES_TO_RADIANS;
  const riseSiderealTime = (longitude: number) => {
    const equatorial = equatorialAtLongitude(longitude, obliquity);
    const argument = -Math.tan(phi) *
      Math.tan(equatorial.declination * DEGREES_TO_RADIANS);
    if (Math.abs(argument) > 1) return undefined;
    const semiDiurnal = Math.acos(argument) * RADIANS_TO_DEGREES;
    return normalizeDegrees(equatorial.rightAscension - semiDiurnal);
  };
  const lowerMeridian = normalizeDegrees(midheaven + 180);
  const lowerMeridianRise = riseSiderealTime(lowerMeridian);
  if (lowerMeridianRise === undefined) return undefined;
  const step = normalizeDegrees(lowerMeridianRise - localSiderealDegrees) / 3;
  const ascendantAt = (offset: number) => {
    const theta = (localSiderealDegrees + offset) * DEGREES_TO_RADIANS;
    const epsilon = obliquity * DEGREES_TO_RADIANS;
    return normalizeDegrees(
      Math.atan2(
        Math.cos(theta),
        -(Math.sin(epsilon) * Math.tan(phi) + Math.cos(epsilon) * Math.sin(theta)),
      ) * RADIANS_TO_DEGREES,
    );
  };
  return oppositeCusps([
    ascendant,
    ascendantAt(step),
    ascendantAt(step * 2),
    lowerMeridian,
    normalizeDegrees(ascendantAt(-step * 2) + 180),
    normalizeDegrees(ascendantAt(-step) + 180),
  ]);
}

function neoPorphyryCusps(ascendant: number, midheaven: number) {
  const lowerMeridian = normalizeDegrees(midheaven + 180);
  const quadrant = normalizeDegrees(lowerMeridian - ascendant);
  const correction = (90 - quadrant) / 12;
  const cusp2 = normalizeDegrees(ascendant + quadrant / 3 + correction);
  const cusp3 = normalizeDegrees(ascendant + (2 * quadrant) / 3 - correction);
  const upperQuadrant = 180 - quadrant;
  const cusp5 = normalizeDegrees(lowerMeridian + upperQuadrant / 3 - correction);
  const cusp6 = normalizeDegrees(lowerMeridian + (2 * upperQuadrant) / 3 + correction);
  return oppositeCusps([ascendant, cusp2, cusp3, lowerMeridian, cusp5, cusp6]);
}

function sripatiCusps(ascendant: number, midheaven: number) {
  const porphyry = porphyryCusps(ascendant, midheaven);
  const cusps = Array<number>(13);
  for (let house = 1; house <= 12; house += 1) {
    const previous = porphyry[house === 1 ? 12 : house - 1];
    cusps[house] = normalizeDegrees(previous + normalizeDegrees(porphyry[house] - previous) / 2);
  }
  return cusps;
}

function meridianCusps(localSiderealDegrees: number, obliquity: number, morinus: boolean) {
  const cusps = Array<number>(13);
  const epsilon = obliquity * DEGREES_TO_RADIANS;
  for (let house = 1; house <= 12; house += 1) {
    const alpha = normalizeDegrees(localSiderealDegrees + (house - 10) * 30);
    if (!morinus) {
      cusps[house] = rightAscensionToEcliptic(alpha, obliquity);
      continue;
    }
    const radians = alpha * DEGREES_TO_RADIANS;
    cusps[house] = normalizeDegrees(
      Math.atan2(Math.sin(radians) * Math.cos(epsilon), Math.cos(radians)) *
        RADIANS_TO_DEGREES,
    );
  }
  return cusps;
}

function krusinskiPisaCusps(
  localSiderealDegrees: number,
  latitude: number,
  obliquity: number,
  ascendant: number,
) {
  const theta = localSiderealDegrees * DEGREES_TO_RADIANS;
  const phi = latitude * DEGREES_TO_RADIANS;
  const epsilon = obliquity * DEGREES_TO_RADIANS;
  const lambda = ascendant * DEGREES_TO_RADIANS;
  const ascendantVector = [
    Math.cos(lambda),
    Math.sin(lambda) * Math.cos(epsilon),
    Math.sin(lambda) * Math.sin(epsilon),
  ];
  const zenith = [
    Math.cos(phi) * Math.cos(theta),
    Math.cos(phi) * Math.sin(theta),
    Math.sin(phi),
  ];
  const cusps = Array<number>(13);
  for (let house = 1; house <= 12; house += 1) {
    const angle = -(house - 1) * 30 * DEGREES_TO_RADIANS;
    const divisionPoint = ascendantVector.map(
      (coordinate, index) =>
        coordinate * Math.cos(angle) + zenith[index] * Math.sin(angle),
    );
    const rightAscension = normalizeDegrees(
      Math.atan2(divisionPoint[1], divisionPoint[0]) * RADIANS_TO_DEGREES,
    );
    cusps[house] = rightAscensionToEcliptic(rightAscension, obliquity);
  }
  return cusps;
}

export function calculateHouses(
  date: Date,
  latitude: number,
  longitude: number,
  system: HouseSystem = "P",
): HouseCalculation {
  const time = MakeTime(date);
  const obliquity = e_tilt(time).tobl;
  const localSiderealDegrees = normalizeDegrees(SiderealTime(time) * 15 + longitude);
  const theta = localSiderealDegrees * DEGREES_TO_RADIANS;
  const epsilon = obliquity * DEGREES_TO_RADIANS;
  const phi = latitude * DEGREES_TO_RADIANS;
  const midheaven = normalizeDegrees(
    Math.atan2(Math.sin(theta), Math.cos(theta) * Math.cos(epsilon)) * RADIANS_TO_DEGREES,
  );
  const ascendant = normalizeDegrees(
    Math.atan2(
      Math.cos(theta),
      -(Math.sin(epsilon) * Math.tan(phi) + Math.cos(epsilon) * Math.sin(theta)),
    ) * RADIANS_TO_DEGREES,
  );

  if (system === "W") {
    return { ascendant, midheaven, cusps: equalCusps(Math.floor(ascendant / 30) * 30) };
  }
  if (system === "A") return { ascendant, midheaven, cusps: equalCusps(ascendant) };
  if (system === "D") return { ascendant, midheaven, cusps: equalCusps(midheaven + 90) };
  if (system === "B") {
    return { ascendant, midheaven, cusps: raDivisionCusps(ascendant, midheaven, obliquity) };
  }
  if (system === "R") {
    return {
      ascendant,
      midheaven,
      cusps: regioCusps(localSiderealDegrees, latitude, obliquity, ascendant),
    };
  }
  if (system === "M" || system === "X") {
    return {
      ascendant,
      midheaven,
      cusps: meridianCusps(localSiderealDegrees, obliquity, system === "M"),
    };
  }
  if (system === "O") return { ascendant, midheaven, cusps: porphyryCusps(ascendant, midheaven) };
  if (system === "S") return { ascendant, midheaven, cusps: sripatiCusps(ascendant, midheaven) };
  if (system === "T") {
    return {
      ascendant,
      midheaven,
      cusps: topocentricCusps(
        localSiderealDegrees,
        latitude,
        obliquity,
        ascendant,
        midheaven,
      ),
    };
  }
  if (system === "C") {
    return {
      ascendant,
      midheaven,
      cusps: campanusCusps(localSiderealDegrees, latitude, obliquity, ascendant),
    };
  }
  if (system === "L") {
    return { ascendant, midheaven, cusps: neoPorphyryCusps(ascendant, midheaven) };
  }
  if (system === "U") {
    return {
      ascendant,
      midheaven,
      cusps: krusinskiPisaCusps(
        localSiderealDegrees,
        latitude,
        obliquity,
        ascendant,
      ),
    };
  }
  if (system === "K") {
    const cusps = kochCusps(
      localSiderealDegrees,
      latitude,
      obliquity,
      ascendant,
      midheaven,
    );
    if (cusps) return { ascendant, midheaven, cusps };
    return {
      ascendant,
      midheaven,
      cusps: porphyryCusps(ascendant, midheaven),
      fallback: "Porphyry",
    };
  }

  const cusp11 = solveCusp(11, midheaven, ascendant, localSiderealDegrees, latitude, obliquity);
  const cusp12 =
    cusp11 === undefined
      ? undefined
      : solveCusp(12, cusp11, ascendant, localSiderealDegrees, latitude, obliquity);
  const lowerMeridian = normalizeDegrees(midheaven + 180);
  const cusp2 = solveCusp(2, ascendant, lowerMeridian, localSiderealDegrees, latitude, obliquity);
  const cusp3 =
    cusp2 === undefined
      ? undefined
      : solveCusp(3, cusp2, lowerMeridian, localSiderealDegrees, latitude, obliquity);

  if (cusp2 === undefined || cusp3 === undefined || cusp11 === undefined || cusp12 === undefined) {
    return {
      ascendant,
      midheaven,
      cusps: porphyryCusps(ascendant, midheaven),
      fallback: "Porphyry",
    };
  }

  const cusps = Array<number>(13);
  cusps[1] = ascendant;
  cusps[2] = cusp2;
  cusps[3] = cusp3;
  cusps[4] = lowerMeridian;
  cusps[5] = normalizeDegrees(cusp11 + 180);
  cusps[6] = normalizeDegrees(cusp12 + 180);
  cusps[7] = normalizeDegrees(ascendant + 180);
  cusps[8] = normalizeDegrees(cusp2 + 180);
  cusps[9] = normalizeDegrees(cusp3 + 180);
  cusps[10] = midheaven;
  cusps[11] = cusp11;
  cusps[12] = cusp12;
  return { ascendant, midheaven, cusps };
}

export function calculatePlacidusHouses(date: Date, latitude: number, longitude: number) {
  return calculateHouses(date, latitude, longitude, "P");
}

export function assignHouse(longitude: number, cusps: number[]) {
  for (let house = 1; house <= 12; house += 1) {
    const start = cusps[house];
    const end = cusps[house === 12 ? 1 : house + 1];
    if (normalizeDegrees(longitude - start) < normalizeDegrees(end - start)) return house;
  }
  return 1;
}
