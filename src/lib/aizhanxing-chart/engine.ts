// @ts-nocheck -- vendored reference engine; calculation logic intentionally unchanged.
import {
  Body,
  Ecliptic,
  GeoVector,
  Observer,
  SearchAltitude,
} from "astronomy-engine";

import { calculateAyanamsa } from "./ayanamsa";
import {
  ASPECT_DEGREES,
  ASPECT_LIGHT_ORBS,
  ASPECT_ORBS,
  ASTRONOMY_BODIES,
  BODY_PRESENTATION,
  CHALDEAN_ORDER,
  DEFAULT_BODY_NAMES,
  LUMINARY_ASPECT_ORB_EXTENSION,
  SIGN_NAMES,
  WEEKDAY_RULERS,
} from "./constants";
import { assignHouse, calculateHouses } from "./houses";
import {
  angularDistance,
  degreeWithinSign,
  formatZodiacDegree,
  normalizeDegrees,
  signIndex,
} from "./math";
import { addLocalDays, formatLocalTime, localDateTimeToUtc, localWeekday } from "./time";
import type {
  AspectType,
  ChartAspect,
  ChartBodyName,
  ChartPlanet,
  NatalChartInput,
  NatalChartOptions,
  NatalChartResult,
  PlanetaryHost,
  PlanetaryRulerName,
} from "./types";

const LABEL_SEPARATION = 7;
const SPEED_STEP_MILLISECONDS = 30 * 60 * 1_000;

function astronomyLongitude(name: Exclude<ChartBodyName, "NorthNode" | "Asc">, date: Date) {
  return Ecliptic(GeoVector(ASTRONOMY_BODIES[name], date, true)).elon;
}

function meanNorthNodeLongitude(date: Date) {
  const julianDay = date.getTime() / 86_400_000 + 2_440_587.5;
  const centuries = (julianDay - 2_451_545) / 36_525;
  return normalizeDegrees(
    125.0445479 -
      1934.1362891 * centuries +
      0.0020754 * centuries ** 2 +
      centuries ** 3 / 467_441 -
      centuries ** 4 / 60_616_000,
  );
}

function trueNorthNodeLongitude(date: Date) {
  const stepMilliseconds = 60_000;
  const eclipticMoonVector = (at: Date) =>
    Ecliptic(GeoVector(Body.Moon, at, false)).vec;
  const position = eclipticMoonVector(date);
  const before = eclipticMoonVector(new Date(date.getTime() - stepMilliseconds));
  const after = eclipticMoonVector(new Date(date.getTime() + stepMilliseconds));
  const velocity = {
    x: after.x - before.x,
    y: after.y - before.y,
    z: after.z - before.z,
  };
  const angularMomentum = {
    x: position.y * velocity.z - position.z * velocity.y,
    y: position.z * velocity.x - position.x * velocity.z,
  };
  return normalizeDegrees(
    Math.atan2(angularMomentum.x, -angularMomentum.y) * (180 / Math.PI),
  );
}

function finiteDifferenceSpeed(longitudeAt: (date: Date) => number, date: Date) {
  const before = longitudeAt(new Date(date.getTime() - SPEED_STEP_MILLISECONDS));
  const after = longitudeAt(new Date(date.getTime() + SPEED_STEP_MILLISECONDS));
  let change = normalizeDegrees(after - before);
  if (change > 180) change -= 360;
  return change / ((2 * SPEED_STEP_MILLISECONDS) / 86_400_000);
}

function describePlanet(name: ChartBodyName, longitude: number) {
  const presentation = BODY_PRESENTATION[name];
  return `${presentation.nameZh}落在${SIGN_NAMES[signIndex(longitude)]}。`;
}

function makePlanet(
  name: ChartBodyName,
  longitude: number,
  speed: number,
  cusps: number[],
): ChartPlanet {
  const presentation = BODY_PRESENTATION[name];
  return {
    name,
    nameZh: presentation.nameZh,
    glyph: presentation.glyph as ChartPlanet["glyph"],
    longitude,
    adjustedLongitude: longitude,
    degree: degreeWithinSign(longitude),
    degreeString: formatZodiacDegree(longitude),
    signIndex: signIndex(longitude),
    house: assignHouse(longitude, cusps),
    speed,
    status: speed < 0 ? "逆行" : undefined,
    color: presentation.color,
    description: describePlanet(name, longitude),
  };
}

/** Port of calcs.gi5Q7hiX.js `lngAdjust`, using the default 7-degree spacing. */
export function adjustChartLabelLongitudes(planets: ChartPlanet[], ascendantLongitude: number) {
  const adjusted = planets
    .map((planet) => ({
      planet,
      longitude: normalizeDegrees(planet.longitude - ascendantLongitude),
      adjustedLongitude: normalizeDegrees(planet.longitude - ascendantLongitude),
    }))
    .sort((first, second) => first.longitude - second.longitude);

  if (adjusted.length === 2) {
    const separation = normalizeDegrees(
      adjusted[1].adjustedLongitude - adjusted[0].adjustedLongitude,
    );
    if (separation < LABEL_SEPARATION) {
      adjusted[1].adjustedLongitude = adjusted[0].adjustedLongitude + LABEL_SEPARATION;
    }
  } else {
    for (let remaining = 200; remaining >= 0; remaining -= 1) {
      let collided = false;
      for (let index = 0; index < adjusted.length; index += 1) {
        const nextIndex = (index + 1) % adjusted.length;
        const distance = normalizeDegrees(
          adjusted[nextIndex].adjustedLongitude - adjusted[index].adjustedLongitude,
        );
        if (distance >= LABEL_SEPARATION) continue;
        collided = true;
        const movement = (LABEL_SEPARATION - distance) / 2 + 0.0001;
        const previousIndex = (index - 1 + adjusted.length) % adjusted.length;
        if (
          normalizeDegrees(
            adjusted[index].adjustedLongitude - adjusted[previousIndex].adjustedLongitude,
          ) > movement
        ) {
          adjusted[index].adjustedLongitude -= movement;
        } else {
          adjusted[index].adjustedLongitude = adjusted[previousIndex].adjustedLongitude;
        }
        const afterNextIndex = (nextIndex + 1) % adjusted.length;
        if (
          normalizeDegrees(
            adjusted[afterNextIndex].adjustedLongitude - adjusted[nextIndex].adjustedLongitude,
          ) > movement
        ) {
          adjusted[nextIndex].adjustedLongitude += movement;
        } else {
          adjusted[nextIndex].adjustedLongitude = adjusted[afterNextIndex].adjustedLongitude;
        }
      }
      if (!collided) break;
    }
  }

  for (const item of adjusted) {
    item.planet.adjustedLongitude = normalizeDegrees(
      item.adjustedLongitude + ascendantLongitude,
    );
  }
  return planets;
}

function calculateAspects(
  planets: ChartPlanet[],
  options: NatalChartOptions,
): ChartAspect[] {
  const aspects: ChartAspect[] = [];
  const visibleTypes = options.visibleAspectTypes
    ? new Set(options.visibleAspectTypes)
    : undefined;
  const aspectOrbs = { ...ASPECT_ORBS, ...options.aspectOrbs };
  const lightOrbs = { ...ASPECT_LIGHT_ORBS, ...options.aspectLightOrbs };
  for (let firstIndex = 0; firstIndex < planets.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < planets.length; secondIndex += 1) {
      const first = planets[firstIndex];
      const second = planets[secondIndex];
      const separation = angularDistance(first.longitude, second.longitude);
      const lightOrb = (lightOrbs[first.name] + lightOrbs[second.name]) / 2;
      const includesLuminary =
        first.name === "Sun" ||
        first.name === "Moon" ||
        second.name === "Sun" ||
        second.name === "Moon";
      for (let type = 1 as AspectType; type <= 10; type = (type + 1) as AspectType) {
        if (visibleTypes && !visibleTypes.has(type)) continue;
        const orb = Math.abs(separation - ASPECT_DEGREES[type]);
        const legacyTypeOrb =
          aspectOrbs[type] + (includesLuminary ? LUMINARY_ASPECT_ORB_EXTENSION : 0);
        const permittedOrb = options.aspectCalculationType === 0
          ? aspectOrbs[type]
          : options.aspectCalculationType === 1
            ? lightOrb
            : Math.min(legacyTypeOrb, lightOrb);
        if (orb <= permittedOrb) {
          aspects.push({ planet1: first.name, planet2: second.name, type, orb, degree: orb });
          break;
        }
      }
    }
  }
  return aspects;
}

function findSunEvent(input: NatalChartInput, localDate: string, direction: 1 | -1) {
  const searchStart = localDateTimeToUtc({
    date: localDate,
    time: "00:00",
    timeZone: input.timeZone,
    summer: input.summer,
  });
  const event = SearchAltitude(
    Body.Sun,
    new Observer(input.latitude, input.longitude, 0),
    direction,
    searchStart,
    1.5,
    0,
  );
  return event?.date;
}

function rulerAtOffset(dayRuler: PlanetaryRulerName, hoursAfterSunrise: number) {
  const startIndex = CHALDEAN_ORDER.indexOf(dayRuler);
  return CHALDEAN_ORDER[(startIndex + hoursAfterSunrise) % CHALDEAN_ORDER.length];
}

function planetaryHost(input: NatalChartInput, birthUtc: Date): PlanetaryHost | undefined {
  const sunrise = findSunEvent(input, input.date, 1);
  const sunset = findSunEvent(input, input.date, -1);
  if (!sunrise || !sunset) return undefined;

  let rulerDate = input.date;
  let periodStart = sunrise;
  let periodEnd = sunset;
  let hourOffset = 0;
  if (birthUtc < sunrise) {
    rulerDate = addLocalDays(input.date, -1);
    const previousSunset = findSunEvent(input, rulerDate, -1);
    if (!previousSunset) return undefined;
    periodStart = previousSunset;
    periodEnd = sunrise;
    hourOffset = 12;
  } else if (birthUtc >= sunset) {
    const nextSunrise = findSunEvent(input, addLocalDays(input.date, 1), 1);
    if (!nextSunrise) return undefined;
    periodStart = sunset;
    periodEnd = nextSunrise;
    hourOffset = 12;
  }

  const dayRuler = WEEKDAY_RULERS[localWeekday(rulerDate)];
  const fraction =
    (birthUtc.getTime() - periodStart.getTime()) /
    (periodEnd.getTime() - periodStart.getTime());
  const planetaryHour = Math.max(0, Math.min(11, Math.floor(fraction * 12)));
  return {
    sunrise: formatLocalTime(sunrise, input.timeZone, input.summer),
    sunset: formatLocalTime(sunset, input.timeZone, input.summer),
    dayRuler,
    hourRuler: rulerAtOffset(dayRuler, hourOffset + planetaryHour),
  };
}

export function calculateNatalChart(
  input: NatalChartInput,
  options: NatalChartOptions = {},
): NatalChartResult {
  if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90) {
    throw new RangeError("Latitude must be between -90 and 90 degrees.");
  }
  if (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180) {
    throw new RangeError("Longitude must be between -180 and 180 degrees.");
  }
  const utcDate = localDateTimeToUtc(input);
  const houseSystem = options.houseSystem ?? input.houseSystem ?? "P";
  const tropicalHouses = calculateHouses(
    utcDate,
    input.latitude,
    input.longitude,
    houseSystem,
  );
  const zodiac = options.zodiac ?? "tropical";
  const ayanamsaAt = (date: Date) =>
    zodiac === "sidereal"
      ? calculateAyanamsa(
          date,
          options.ayanamsa,
          options.customAyanamsaDegrees,
        )
      : 0;
  const ayanamsaDegrees = ayanamsaAt(utcDate);
  const toZodiac = (longitude: number, date = utcDate) =>
    normalizeDegrees(longitude - ayanamsaAt(date));
  const houseCalculation = {
    ...tropicalHouses,
    ascendant: toZodiac(tropicalHouses.ascendant),
    midheaven: toZodiac(tropicalHouses.midheaven),
    cusps: tropicalHouses.cusps.map((cusp) =>
      cusp === undefined ? cusp : toZodiac(cusp),
    ),
  };
  const planets = DEFAULT_BODY_NAMES.map((name) => {
    if (name === "Asc") {
      const longitudeAt = (date: Date) =>
        toZodiac(
          calculateHouses(date, input.latitude, input.longitude, houseSystem).ascendant,
          date,
        );
      return makePlanet(
        name,
        houseCalculation.ascendant,
        finiteDifferenceSpeed(longitudeAt, utcDate),
        houseCalculation.cusps,
      );
    }
    if (name === "NorthNode") {
      const nodeLongitude = options.trueNode
        ? trueNorthNodeLongitude
        : meanNorthNodeLongitude;
      return makePlanet(
        name,
        toZodiac(nodeLongitude(utcDate)),
        finiteDifferenceSpeed((date) => toZodiac(nodeLongitude(date), date), utcDate),
        houseCalculation.cusps,
      );
    }
    const longitudeAt = (date: Date) => astronomyLongitude(name, date);
    return makePlanet(
      name,
      toZodiac(longitudeAt(utcDate)),
      finiteDifferenceSpeed((date) => toZodiac(longitudeAt(date), date), utcDate),
      houseCalculation.cusps,
    );
  });
  adjustChartLabelLongitudes(planets, houseCalculation.ascendant);

  return {
    utcDate,
    ascendantLongitude: houseCalculation.ascendant,
    midheavenLongitude: houseCalculation.midheaven,
    houseSystem,
    zodiac,
    ayanamsaDegrees,
    houseFallback: houseCalculation.fallback,
    planets,
    houses: houseCalculation.cusps.slice(1).map((longitude, index) => ({
      house: index + 1,
      longitude,
      signIndex: signIndex(longitude),
      degreeString: formatZodiacDegree(longitude),
    })),
    aspects: calculateAspects(planets, options),
    planetaryHost: planetaryHost(input, utcDate),
  };
}
