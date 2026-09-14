// @ts-nocheck -- vendored reference engine; calculation logic intentionally unchanged.
import {
  Body,
  DefineStar,
  Ecliptic,
  EquatorFromVector,
  GeoVector,
  MakeTime,
  Observer,
  RotateVector,
  Rotation_ECL_EQJ,
  SearchAltitude,
  SearchRiseSet,
  SiderealTime,
  Vector,
  e_tilt,
} from "astronomy-engine";

import {
  calculateNatalChart,
  localDateTimeToUtc,
  normalizeDegrees,
  type ChartPlanet,
} from "@/lib/aizhanxing-chart";

import {
  calculateBaziData,
  formatDateTime,
  keZhu,
  lunarNewYear,
  trueSolarDate,
} from "./calendar";
import {
  childLimitBranchOffsets,
  limitYearDurations,
  mansionMarkers,
  mingSignChouBySign,
  mingXingxiuChouByIndex,
  natalYaoTailByFirstSign,
  tenGodPlanetIds,
  transitYaoTailByFirstSign,
  yaoDefinitions,
  yaoPlanetNames,
  yaoYearPlanetIds,
  yaoYearTransformIds,
} from "./constants";
import type {
  ZhengyuHouse,
  ZhengyuPlanet,
  ZhengyuRequest,
  ZhengyuResult,
  ZhengyuXingxiu,
} from "./types";

const referenceDate = Date.UTC(2000, 2, 1, 8, 30);
const ziqiDegreesPerDay = 0.03520032190303282;
const degreesToRadians = Math.PI / 180;
const radiansToDegrees = 180 / Math.PI;
const tropicalBodies = new Set([
  "Sun",
  "Moon",
  "Mercury",
  "Venus",
  "Mars",
  "Jupiter",
  "Saturn",
  "Uranus",
  "Neptune",
  "Pluto",
]);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function degreeString(value: number) {
  const degree = Math.floor(value);
  const minute = Math.round((value - degree) * 60);
  return `${degree}°${minute}'`;
}

function trueLahiri(date: Date) {
  const years = (date.getTime() - referenceDate) / (365.2425 * 86_400_000);
  return 23.843986540562865 + years * (50.0 / 3_600);
}

function meanLunarApogeePosition(date: Date) {
  const julianDay = date.getTime() / 86_400_000 + 2_440_587.5;
  const centuries = (julianDay - 2_451_545) / 36_525;
  // Meeus lunar mean node/perigee elements. Projecting the apogee of the
  // inclined lunar orbit is essential: its ecliptic longitude is not simply
  // the longitude of perigee plus 180 degrees.
  const node = (
    125.0445479 - 1_934.1362891 * centuries + 0.0020754 * centuries ** 2 +
      centuries ** 3 / 467_441 - centuries ** 4 / 60_616_000
  );
  const perigee = (
    83.3532465 + 4_069.0137287 * centuries - 0.01032 * centuries ** 2 -
      centuries ** 3 / 80_053 + centuries ** 4 / 18_999_000
  );
  const inclination = 5.1453964 * degreesToRadians;
  const nodeRadians = node * degreesToRadians;
  const argument = (perigee - node + 180) * degreesToRadians;
  const x = Math.cos(nodeRadians) * Math.cos(argument) -
    Math.sin(nodeRadians) * Math.sin(argument) * Math.cos(inclination);
  const y = Math.sin(nodeRadians) * Math.cos(argument) +
    Math.cos(nodeRadians) * Math.sin(argument) * Math.cos(inclination);
  const z = Math.sin(argument) * Math.sin(inclination);
  return {
    longitude: normalizeDegrees(Math.atan2(y, x) * radiansToDegrees),
    latitude: Math.asin(z) * radiansToDegrees,
  };
}

function meanLilith(date: Date, zodiacShift: number) {
  const current = meanLunarApogeePosition(date);
  const nextDate = new Date(date.getTime() + 86_400_000);
  const next = meanLunarApogeePosition(nextDate);
  const nextShift = zodiacShift
    ? zodiacShift + 50 / 3_600 / 365.2425
    : 0;
  return {
    longitude: normalizeDegrees(current.longitude - zodiacShift),
    latitude: current.latitude,
    speed: normalizeDegrees(next.longitude - nextShift - current.longitude + zodiacShift),
  };
}

function fixedStarBoundaries(date: Date, zodiacShift: number): ZhengyuXingxiu[] {
  return mansionMarkers.map((item) => {
    const longitude = item.longitude * degreesToRadians;
    const latitude = item.latitude * degreesToRadians;
    const radius = Math.cos(latitude);
    const ecliptic = new Vector(
      radius * Math.cos(longitude),
      radius * Math.sin(longitude),
      Math.sin(latitude),
      MakeTime(date),
    );
    const equatorialVector = RotateVector(Rotation_ECL_EQJ(), ecliptic);
    const equatorial = EquatorFromVector(equatorialVector);
    DefineStar(Body.Star1, equatorial.ra, equatorial.dec, 1_000_000);
    const apparent = Ecliptic(GeoVector(Body.Star1, date, true)).elon;
    const lng = normalizeDegrees(apparent - zodiacShift);
    const degree = lng % 30;
    return {
      name: item.name,
      planet_name: item.planetName,
      animal_name: item.animalName,
      lng_type: 0,
      lng,
      sign: Math.floor(lng / 30) + 1,
      degree,
      degree_str: degreeString(degree),
    };
  });
}

function xingxiuPosition(longitude: number, boundaries: ZhengyuXingxiu[]) {
  for (let index = 0; index < boundaries.length; index += 1) {
    const start = boundaries[index].lng;
    const end = boundaries[(index + 1) % boundaries.length].lng;
    const arc = normalizeDegrees(end - start);
    const degree = normalizeDegrees(longitude - start);
    if (degree < arc) return { index, degree };
  }
  return { index: 0, degree: 0 };
}

function houseFor(longitude: number, firstSign: number) {
  return ((Math.floor(longitude / 30) - firstSign + 12) % 12) + 1;
}

function arcHouseFor(longitude: number, cusps: number[]) {
  for (let index = 0; index < cusps.length; index += 1) {
    const start = cusps[index];
    const end = cusps[(index + 1) % cusps.length];
    if (normalizeDegrees(longitude - start) < normalizeDegrees(end - start)) {
      return index + 1;
    }
  }
  return 1;
}

function planetFromChart(
  planet: ChartPlanet,
  firstSign: number,
  boundaries: ZhengyuXingxiu[],
): ZhengyuPlanet {
  const degree = planet.longitude % 30;
  const house = houseFor(planet.longitude, firstSign);
  const xingxiu = xingxiuPosition(planet.longitude, boundaries);
  return {
    plant_type: 1,
    name: planet.name,
    lng_type: 0,
    lng_origin: planet.longitude,
    lng: planet.longitude,
    lat: 0,
    degree,
    degree_str: degreeString(degree),
    sign: Math.floor(planet.longitude / 30) + 1,
    speed: planet.speed,
    speed_status: planet.speed < 0 ? 1 : 0,
    status: 0,
    house,
    house_degree: degree,
    house_degree_str: degreeString(degree),
    shishen: -1,
    xingxiu: xingxiu.index,
    xingxiu_degree: xingxiu.degree,
    xingxiu_degree_str: degreeString(xingxiu.degree),
    xingxiu_degree_word: "",
    sign_status: [],
    sign_status_str: "",
  };
}

function extraPlanet(
  name: string,
  longitude: number,
  firstSign: number,
  boundaries: ZhengyuXingxiu[],
  latitude = 0,
  speed = 0,
): ZhengyuPlanet {
  const planet = planetFromChart({
    name: "NorthNode",
    nameZh: name,
    glyph: "northNode",
    longitude,
    adjustedLongitude: longitude,
    degree: longitude % 30,
    degreeString: degreeString(longitude % 30),
    signIndex: Math.floor(longitude / 30),
    house: houseFor(longitude, firstSign),
    speed,
    color: "#555555",
    description: "",
  }, firstSign, boundaries);
  planet.lat = latitude;
  return planet;
}

function axisPlanet(
  name: string,
  longitude: number,
  firstSign: number,
  boundaries: ZhengyuXingxiu[],
) {
  const planet = extraPlanet(name, longitude, firstSign, boundaries);
  planet.name = name;
  return planet;
}

function makePlanets(
  chart: ReturnType<typeof calculateNatalChart>,
  firstSign: number,
  boundaries: ZhengyuXingxiu[],
) {
  const core = chart.planets.filter((planet) => tropicalBodies.has(planet.name));
  const northNode = chart.planets.find((planet) => planet.name === "NorthNode");
  const planets = core.map((planet) => planetFromChart(planet, firstSign, boundaries));
  if (northNode) {
    planets.push(planetFromChart(northNode, firstSign, boundaries));
    const south = extraPlanet(
      "SouthNode",
      normalizeDegrees(northNode.longitude + 180),
      firstSign,
      boundaries,
    );
    south.name = "SouthNode";
    planets.push(south);
  }
  const shift = chart.zodiac === "sidereal" ? chart.ayanamsaDegrees : 0;
  const lilith = meanLilith(chart.utcDate, shift);
  planets.push(extraPlanet(
    "Lilith",
    lilith.longitude,
    firstSign,
    boundaries,
    lilith.latitude,
    lilith.speed,
  ));
  planets.at(-1)!.name = "Lilith";
  // 紫炁 follows a uniform 28-year cycle. The epoch is identical in all samples.
  const ziqi = normalizeDegrees(
    191.51593565506312 +
      (chart.utcDate.getTime() - referenceDate) / 86_400_000 * ziqiDegreesPerDay,
  );
  planets.push(extraPlanet("Ziqi", ziqi, firstSign, boundaries));
  planets.at(-1)!.name = "Ziqi";
  planets.push(
    axisPlanet("Asc", chart.ascendantLongitude, firstSign, boundaries),
    axisPlanet("Mc", chart.midheavenLongitude, firstSign, boundaries),
    axisPlanet("Des", normalizeDegrees(chart.ascendantLongitude + 180), firstSign, boundaries),
    axisPlanet("Ic", normalizeDegrees(chart.midheavenLongitude + 180), firstSign, boundaries),
  );
  return planets;
}

function makeHouses(firstSign: number, boundaries: ZhengyuXingxiu[]) {
  const houses: Record<string, ZhengyuHouse> = {};
  for (let house = 1; house <= 12; house += 1) {
    const lng = normalizeDegrees((firstSign + house - 1) * 30);
    const xingxiu = xingxiuPosition(lng, boundaries);
    houses[String(house)] = {
      lng_type: 0,
      lng_origin: lng,
      lng,
      lng_str: degreeString(lng),
      sign: Math.floor(lng / 30) + 1,
      degree: lng % 30,
      degree_str: lng % 30 ? degreeString(lng % 30) : "",
      arc: 30,
      zhi: (10 - firstSign - (house - 1) + 24) % 12,
      shensha_list: [],
      xu: false,
      shi: false,
      xingxiu: xingxiu.index,
      xingxiu_degree: xingxiu.degree,
    };
  }
  return houses;
}

function equatorialAtLongitude(longitude: number, obliquity: number) {
  const lambda = longitude * degreesToRadians;
  const epsilon = obliquity * degreesToRadians;
  return {
    rightAscension: normalizeDegrees(
      Math.atan2(Math.sin(lambda) * Math.cos(epsilon), Math.cos(lambda)) *
        radiansToDegrees,
    ),
    declination: Math.asin(Math.sin(lambda) * Math.sin(epsilon)) * radiansToDegrees,
  };
}

function solvePlacidusCusp(
  house: 2 | 3 | 11 | 12,
  lowerLongitude: number,
  upperLongitude: number,
  localSiderealDegrees: number,
  latitude: number,
  obliquity: number,
) {
  const latitudeRadians = latitude * degreesToRadians;
  const residual = (longitude: number) => {
    const equatorial = equatorialAtLongitude(normalizeDegrees(longitude), obliquity);
    const argument = Math.tan(latitudeRadians) *
      Math.tan(equatorial.declination * degreesToRadians);
    if (Math.abs(argument) >= 1) return undefined;
    const difference = Math.asin(argument) * radiansToDegrees;
    const semiDiurnal = 90 + difference;
    const semiNocturnal = 90 - difference;
    const target = house === 11
      ? localSiderealDegrees + semiDiurnal / 3
      : house === 12
        ? localSiderealDegrees + 2 * semiDiurnal / 3
        : house === 2
          ? localSiderealDegrees + semiDiurnal + semiNocturnal / 3
          : localSiderealDegrees + semiDiurnal + 2 * semiNocturnal / 3;
    let rightAscension = equatorial.rightAscension;
    while (rightAscension < localSiderealDegrees) rightAscension += 360;
    return rightAscension - target;
  };

  const lower = lowerLongitude;
  let upper = upperLongitude;
  while (upper <= lower) upper += 360;
  let previousLongitude = lower;
  let previousResidual = residual(lower);
  for (let step = 1; step <= 720; step += 1) {
    const longitude = lower + (upper - lower) * step / 720;
    const currentResidual = residual(longitude);
    if (
      previousResidual !== undefined &&
      currentResidual !== undefined &&
      previousResidual * currentResidual <= 0 &&
      Math.abs(previousResidual - currentResidual) < 20
    ) {
      let left = previousLongitude;
      let right = longitude;
      let leftResidual = previousResidual;
      for (let iteration = 0; iteration < 60; iteration += 1) {
        const middle = (left + right) / 2;
        const middleResidual = residual(middle);
        if (middleResidual === undefined) break;
        if (leftResidual * middleResidual <= 0) {
          right = middle;
        } else {
          left = middle;
          leftResidual = middleResidual;
        }
      }
      return normalizeDegrees((left + right) / 2);
    }
    previousLongitude = longitude;
    previousResidual = currentResidual;
  }
  return undefined;
}

function placidusCusps(
  chart: ReturnType<typeof calculateNatalChart>,
  input: ZhengyuRequest,
) {
  const ascendant = chart.ascendantLongitude;
  const midheaven = chart.midheavenLongitude;
  if (input.hsys === "W") {
    const start = Math.floor(ascendant / 30) * 30;
    return Array.from({ length: 12 }, (_, index) =>
      normalizeDegrees(start + index * 30));
  }
  const time = MakeTime(chart.utcDate);
  const obliquity = e_tilt(time).tobl;
  const localSiderealDegrees = normalizeDegrees(
    SiderealTime(time) * 15 + input.lng,
  );
  const lowerMeridian = normalizeDegrees(midheaven + 180);
  const cusp11 = solvePlacidusCusp(
    11,
    midheaven,
    ascendant,
    localSiderealDegrees,
    input.lat,
    obliquity,
  );
  const cusp12 = cusp11 === undefined ? undefined : solvePlacidusCusp(
    12,
    cusp11,
    ascendant,
    localSiderealDegrees,
    input.lat,
    obliquity,
  );
  const cusp2 = solvePlacidusCusp(
    2,
    ascendant,
    lowerMeridian,
    localSiderealDegrees,
    input.lat,
    obliquity,
  );
  const cusp3 = cusp2 === undefined ? undefined : solvePlacidusCusp(
    3,
    cusp2,
    lowerMeridian,
    localSiderealDegrees,
    input.lat,
    obliquity,
  );
  if (
    cusp2 === undefined ||
    cusp3 === undefined ||
    cusp11 === undefined ||
    cusp12 === undefined
  ) {
    return chart.houses.map((house) => house.longitude);
  }
  return [
    ascendant,
    cusp2,
    cusp3,
    lowerMeridian,
    normalizeDegrees(cusp11 + 180),
    normalizeDegrees(cusp12 + 180),
    normalizeDegrees(ascendant + 180),
    normalizeDegrees(cusp2 + 180),
    normalizeDegrees(cusp3 + 180),
    midheaven,
    cusp11,
    cusp12,
  ];
}

function makeArcHouses(
  chart: ReturnType<typeof calculateNatalChart>,
  input: ZhengyuRequest,
) {
  const cusps = placidusCusps(chart, input);
  const houses: Record<string, ZhengyuHouse> = {};
  for (let index = 0; index < cusps.length; index += 1) {
    const lng = cusps[index];
    const next = cusps[(index + 1) % 12];
    houses[String(index + 1)] = {
      lng_type: 0,
      lng_origin: lng,
      lng,
      lng_str: degreeString(lng),
      sign: Math.floor(lng / 30) + 1,
      degree: lng % 30,
      degree_str: degreeString(lng % 30),
      arc: normalizeDegrees(next - lng),
      zhi: 0,
      shensha_list: null,
      xu: false,
      shi: false,
      xingxiu: 0,
      xingxiu_degree: 0,
    };
  }
  return houses;
}

function makeYaos(
  bazi: ReturnType<typeof calculateBaziData>,
  firstSign: number,
  kind: "transit" | "natal",
) {
  const yearPillar = bazi.sizhu.year_zhu.ganzhi;
  const dayPillar = bazi.sizhu.day_zhu.ganzhi;
  const yearIds = yaoYearPlanetIds[yearPillar] ?? yaoYearPlanetIds[42]!;
  const tenGodIds = tenGodPlanetIds[dayPillar] ?? tenGodPlanetIds[25]!;
  const transformIds = yaoYearTransformIds[yearPillar] ??
    yaoYearTransformIds[42]!;
  const tails = kind === "transit"
    ? transitYaoTailByFirstSign
    : natalYaoTailByFirstSign;
  const tailIds = tails[firstSign] ?? tenGodIds.slice(0, 9);
  const planetIds = [...yearIds, ...transformIds, ...tenGodIds, ...tailIds];
  return yaoDefinitions.map((definition, index) => {
    const planetId = planetIds[index];
    return {
      name: definition.name,
      planet_id: planetId,
      planet_name: yaoPlanetNames[planetId] ?? "",
      type: definition.type,
      top: definition.top,
    };
  });
}

function formatInputDateTime(date: string, time: string) {
  return `${date} ${time}:00`;
}

function civilDate(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute));
}

const dayMilliseconds = 86_400_000;
const tropicalYearDays = 365.2422;

function addLimitYears(date: Date, years: number) {
  const wholeYears = Math.floor(years);
  const result = new Date(date);
  result.setUTCFullYear(result.getUTCFullYear() + wholeYears);
  return new Date(
    result.getTime() + (years - wholeYears) * tropicalYearDays * dayMilliseconds,
  );
}

function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function childLimitDuration(start: Date, end: Date) {
  const cursor = new Date(start);
  let year = end.getUTCFullYear() - start.getUTCFullYear();
  cursor.setUTCFullYear(cursor.getUTCFullYear() + year);
  if (cursor > end) {
    year -= 1;
    cursor.setUTCFullYear(cursor.getUTCFullYear() - 1);
  }
  let month = (end.getUTCFullYear() - cursor.getUTCFullYear()) * 12 +
    end.getUTCMonth() - cursor.getUTCMonth();
  const monthCursor = new Date(cursor);
  monthCursor.setUTCMonth(monthCursor.getUTCMonth() + month);
  if (monthCursor > end) {
    month -= 1;
    monthCursor.setUTCMonth(monthCursor.getUTCMonth() - 1);
  }
  const leapCarry = isLeapYear(start.getUTCFullYear()) && start.getUTCMonth() > 1
    ? 2
    : 0;
  const day = Math.floor(
    (end.getTime() - monthCursor.getTime()) / dayMilliseconds,
  ) + leapCarry;
  return { year, month, day };
}

function formatOffsetDateTime(date: Date, eastOffset: number) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const sign = eastOffset < 0 ? "-" : "+";
  const offset = Math.abs(eastOffset);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-` +
    `${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:` +
    `${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}` +
    `${sign}${pad(Math.floor(offset))}:${pad(Math.round(offset % 1 * 60))}`;
}

interface LimitPeriod {
  big: number;
  start: Date;
  end: Date;
}

interface FlyLimitPeriod {
  periodIndex: number;
  start: number;
  end: number;
}

function makeLimitPeriods(start: Date, mingDegree: number) {
  const periods: LimitPeriod[] = [];
  const childYears = 9 + mingDegree / 3;
  let periodStart = start;
  let periodEnd = addLimitYears(periodStart, childYears);
  periods.push({ big: 1, start: periodStart, end: periodEnd });
  for (const [big, years] of limitYearDurations) {
    periodStart = periodEnd;
    periodEnd = addLimitYears(periodStart, years);
    periods.push({ big, start: periodStart, end: periodEnd });
  }
  return periods;
}

function flyLimitPattern(base: number) {
  const finalOffsets = base % 2 === 0 ? [4, 8] : [8, 4];
  return [base, base, base + 6, base + 6, base + finalOffsets[0],
    base + finalOffsets[1]].map((value) => value % 12);
}

function flyLimitsForYear(
  index: number,
  majorStartIndex: number,
  smallStart: number,
  periods: FlyLimitPeriod[],
) {
  if (index < majorStartIndex) {
    return [flyLimitPattern(smallStart)[index % 6]];
  }
  const branches: number[] = [];
  for (const period of periods) {
    const overlapStart = Math.max(index, period.start);
    const overlapEnd = Math.min(index + 1, period.end);
    if (overlapStart >= overlapEnd) continue;
    const firstPhase = Math.floor(overlapStart - period.start + 1e-8);
    const lastPhase = Math.floor(overlapEnd - period.start - 1e-8);
    for (let phase = firstPhase; phase <= lastPhase; phase += 1) {
      const pattern = flyLimitPattern((smallStart + period.periodIndex) % 12);
      const branch = pattern[phase % pattern.length];
      if (branches.at(-1) !== branch) branches.push(branch);
    }
  }
  return branches.slice(0, 2);
}

function makeYearLimits(
  input: ZhengyuRequest,
  start: Date,
  mingDegree: number,
  smallStart: number,
  birthGanzhi: number,
) {
  const periods = makeLimitPeriods(start, mingDegree);
  let boundaryYear = start.getUTCFullYear();
  let boundary = lunarNewYear(boundaryYear);
  while (boundary <= start) {
    boundaryYear += 1;
    boundary = lunarNewYear(boundaryYear);
  }
  const rows: Array<Record<string, unknown>> = [];
  const segments: Array<{ start: Date; end: Date }> = [];
  let segmentStart = start;
  const birthYear = Number(input.date.slice(0, 4));
  const remainingYears = limitYearDurations.reduce(
    (sum, [, years]) => sum + years,
    0,
  );
  const rowCount = Math.floor(9 + mingDegree / 3 + remainingYears);
  while (rows.length < rowCount) {
    const segmentEnd = boundary;
    const selected = periods.find((period) => segmentEnd <= period.end) ?? periods.at(-1)!;
    let degree = 0;
    for (const period of periods) {
      const overlapStart = Math.max(segmentStart.getTime(), period.start.getTime());
      const overlapEnd = Math.min(segmentEnd.getTime(), period.end.getTime());
      if (overlapEnd > overlapStart) {
        degree += (overlapEnd - overlapStart) * 30 /
          (period.end.getTime() - period.start.getTime());
      }
    }
    const index = rows.length;
    const childOffset = childLimitBranchOffsets[index] ?? 0;
    rows.push({
      year: birthYear + index,
      age: index + 1,
      year_gan_zhi: (birthGanzhi + index) % 60,
      big_limit: selected.big,
      small_limit_zhi: (smallStart - index + 120) % 12,
      child_limit_zhi: segmentStart < periods[0].end
        ? (smallStart + childOffset) % 12
        : null,
      fly_limit_zhi: [],
      degree,
      big_limit_date_time_start: formatOffsetDateTime(selected.start, -input.birth_zone),
      big_limit_date_time_end: formatOffsetDateTime(selected.end, -input.birth_zone),
    });
    segments.push({ start: segmentStart, end: segmentEnd });
    segmentStart = segmentEnd;
    boundaryYear += 1;
    boundary = lunarNewYear(boundaryYear);
  }
  const majorStartIndex = segments.findIndex((segment) =>
    (segment.start.getTime() + segment.end.getTime()) / 2 >=
      periods[1].start.getTime());
  let flyPeriodStart = majorStartIndex;
  const flyPeriods: FlyLimitPeriod[] = limitYearDurations.map(
    ([, duration], periodIndex) => {
      const flyPeriod = {
        periodIndex: periodIndex + 1,
        start: flyPeriodStart,
        end: flyPeriodStart + duration,
      };
      flyPeriodStart = flyPeriod.end;
      return flyPeriod;
    },
  );
  rows.forEach((row, index) => {
    row.fly_limit_zhi = flyLimitsForYear(
      index,
      majorStartIndex,
      smallStart,
      flyPeriods,
    );
  });
  return { periods, rows, segments };
}

function limitProgress(start: Date, end: Date, periods: LimitPeriod[]) {
  let degree = 0;
  for (const period of periods) {
    const overlapStart = Math.max(start.getTime(), period.start.getTime());
    const overlapEnd = Math.min(end.getTime(), period.end.getTime());
    if (overlapEnd > overlapStart) {
      degree += (overlapEnd - overlapStart) * 30 /
        (period.end.getTime() - period.start.getTime());
    }
  }
  return degree;
}

function limitDegreeObject(
  degree: number,
  smallStart: number,
  houses: Record<string, ZhengyuHouse>,
  boundaries: ZhengyuXingxiu[],
) {
  const zhi = (smallStart + Math.floor(degree / 30)) % 12;
  const houseEntry = Object.entries(houses).find(([, house]) => house.zhi === zhi);
  const house = Number(houseEntry?.[0] ?? 1);
  const houseDegree = 30 - normalizeDegrees(degree) % 30;
  const xingxiu = xingxiuPosition(
    normalizeDegrees((houseEntry?.[1].lng ?? 0) + houseDegree),
    boundaries,
  );
  return {
    zhi,
    house,
    house_degree: houseDegree,
    house_degree_str: degreeString(houseDegree),
    xingxiu: xingxiu.index,
    xingxiu_degree: xingxiu.degree,
    xingxiu_degree_str: degreeString(xingxiu.degree),
  };
}

function makeTransitLimit(
  input: ZhengyuRequest,
  transitSolar: Date,
  limitData: ReturnType<typeof makeYearLimits>,
  smallStart: number,
  houses: Record<string, ZhengyuHouse>,
  boundaries: ZhengyuXingxiu[],
  birthMonth: number,
  transitMonth: number,
) {
  const segmentIndex = limitData.segments.findIndex(
    (segment) => transitSolar >= segment.start && transitSolar < segment.end,
  );
  const index = Math.max(0, segmentIndex);
  const degreeStart = limitData.rows.slice(0, index).reduce(
    (sum, row) => sum + Number(row.degree),
    0,
  );
  const segment = limitData.segments[index];
  const degreeEnd = degreeStart + Number(limitData.rows[index].degree);
  const segmentProgress = Math.max(
    0,
    Math.min(
      1,
      (transitSolar.getTime() - segment.start.getTime()) /
        (segment.end.getTime() - segment.start.getTime()),
    ),
  );
  const degree = degreeStart + Number(limitData.rows[index].degree) * segmentProgress;
  const beforeBirthday = input.transit_date.slice(5) < input.date.slice(5);
  const annualIndex = Math.max(
    0,
    Math.min(
      limitData.rows.length - 1,
      Number(input.transit_date.slice(0, 4)) - Number(input.date.slice(0, 4)) -
        (beforeBirthday ? 1 : 0),
    ),
  );
  const annual = limitData.rows[annualIndex];
  const smallLimit = Number(annual.small_limit_zhi);
  return {
    index: 0,
    small_limit_zhi: smallLimit,
    child_limit_zhi: annual.child_limit_zhi,
    month_limit_zhi: (
      smallLimit + birthMonth - transitMonth + (input.birth_zone > 0 ? 11 : 12)
    ) % 12,
    fly_limit_zhi: annual.fly_limit_zhi,
    degree,
    degree_start: degreeStart,
    degree_end: degreeEnd,
    degree_obj: limitDegreeObject(degree, smallStart, houses, boundaries),
    degree_start_obj: limitDegreeObject(degreeStart, smallStart, houses, boundaries),
    degree_end_obj: limitDegreeObject(degreeEnd, smallStart, houses, boundaries),
  };
}

function hourBranch(date: Date) {
  return Math.floor((date.getUTCHours() + 1) / 2) % 12;
}

function sunriseBranch(input: ZhengyuRequest) {
  const observer = new Observer(input.lat, input.lng, 0);
  // The API's rise/set and palace routines use standard time, before DST.
  const localOffset = -input.birth_zone;
  const localMidnight = civilDate(input.date, "00:00");
  const searchStart = new Date(localMidnight.getTime() - localOffset * 3_600_000);
  const sunrise = SearchAltitude(
    Body.Sun,
    observer,
    1,
    searchStart,
    1.5,
    -2,
  )?.date;
  if (!sunrise) return 3;
  const local = new Date(sunrise.getTime() + localOffset * 3_600_000);
  return hourBranch(local);
}

function formatEvent(date: Date, offset: number) {
  return formatDateTime(new Date(date.getTime() + offset * 3_600_000));
}

function riseSet(input: ZhengyuRequest) {
  const observer = new Observer(input.lat, input.lng, 0);
  const standardOffset = -input.birth_zone;
  const localMidnight = civilDate(input.date, "00:00");
  const start = new Date(localMidnight.getTime() - standardOffset * 3_600_000);
  const event = (body: Body, direction: 1 | -1) =>
    SearchRiseSet(body, observer, direction, start, 1.5)?.date;
  // 国内标准 reports apparent-solar clock time: astronomical rise/set converted
  // from standard civil time by the same longitude/equation-of-time correction.
  const apparentNoon = trueSolarDate(
    input.date,
    "12:00",
    input.lng,
    standardOffset,
  );
  const correction = apparentNoon.getTime() - localMidnight.getTime() - 12 * 3_600_000;
  const values: Record<string, string> = {};
  const sunRise = event(Body.Sun, 1);
  const sunSet = event(Body.Sun, -1);
  const moonRise = event(Body.Moon, 1);
  const moonSet = event(Body.Moon, -1);
  const formatApparent = (date: Date) => formatEvent(
    new Date(date.getTime() + correction),
    standardOffset,
  );
  if (sunRise) values.sun_rise = formatApparent(sunRise);
  if (sunSet) values.sun_set = formatApparent(sunSet);
  if (moonRise) values.moon_rise = formatApparent(moonRise);
  if (moonSet) values.moon_set = formatApparent(moonSet);
  return values;
}

function buildZhengyuResult(input: ZhengyuRequest): ZhengyuResult {
  const birthUtc = localDateTimeToUtc({
    date: input.date,
    time: input.time,
    timeZone: -input.birth_zone,
    summer: input.summer,
  });
  const transitUtc = localDateTimeToUtc({
    date: input.transit_date,
    time: input.transit_time,
    timeZone: -input.transit_zone,
    summer: 0,
  });
  const birthSolar = input.is_delta
    ? trueSolarDate(
        input.date,
        input.time,
        input.lng,
        -input.birth_zone,
        input.summer,
      )
    : civilDate(input.date, input.time);
  const transitSolar = input.is_delta
    ? trueSolarDate(
        input.transit_date,
        input.transit_time,
        input.transit_lng,
        -input.transit_zone,
      )
    : civilDate(input.transit_date, input.transit_time);
  const shiftBirth = input.calc_type === 4 ? trueLahiri(birthUtc) : 0;
  const shiftTransit = input.calc_type === 4 ? trueLahiri(transitUtc) : 0;
  const options = (shift: number) => ({
    houseSystem: input.hsys,
    trueNode: input.node_true,
    zodiac: shift ? "sidereal" as const : "tropical" as const,
    ayanamsa: shift ? 255 as const : undefined,
    customAyanamsaDegrees: shift,
  });
  const birthChart = calculateNatalChart({
    date: input.date,
    time: input.time,
    latitude: input.lat,
    longitude: input.lng,
    timeZone: -input.birth_zone,
    summer: input.summer,
    houseSystem: input.hsys,
  }, options(shiftBirth));
  // The captured API applies the natal place to both axis sets.
  const transitChart = calculateNatalChart({
    date: input.transit_date,
    time: input.transit_time,
    latitude: input.lat,
    longitude: input.lng,
    timeZone: -input.transit_zone,
    summer: 0,
    houseSystem: input.hsys,
  }, options(shiftTransit));
  const boundaries = fixedStarBoundaries(birthUtc, shiftBirth);
  const birthBazi = calculateBaziData(birthSolar, input.sex, input.next_day_zi_shi);
  const transitBazi = calculateBaziData(transitSolar, input.sex, input.next_day_zi_shi);
  const natalSun = birthChart.planets.find((planet) => planet.name === "Sun");
  const natalSunLongitude = natalSun?.longitude ?? 0;
  const mingLongitude = input.ming_type === 2
    ? birthChart.ascendantLongitude
    : normalizeDegrees(
        natalSunLongitude +
          (hourBranch(birthSolar) - sunriseBranch(input)) * 30,
      );
  const firstSign = Math.floor(mingLongitude / 30);
  const houses = makeHouses(firstSign, boundaries);
  const birthCusps = placidusCusps(birthChart, input);
  const planets1 = makePlanets(transitChart, firstSign, boundaries);
  const planets2 = makePlanets(birthChart, firstSign, boundaries);
  const shenLongitude = input.shen_type === 1
    ? normalizeDegrees(planets2[1].lng + 30)
    : planets2[1].lng;
  const makeMaster = (
    lng: number,
    house: number,
    includeChou: boolean,
  ) => {
    const xingxiu = xingxiuPosition(lng, boundaries);
    const sign = Math.floor(lng / 30) + 1;
    return {
      lng_type: 0,
      lng,
      degree: lng % 30,
      degree_str: degreeString(lng % 30),
      sign,
      sign_chou: includeChou
        ? [...(mingSignChouBySign[sign] ?? [])]
        : null,
      house,
      xingxiu: xingxiu.index,
      xingxiu_degree: xingxiu.degree,
      xingxiu_degree_str: degreeString(xingxiu.degree),
      xingxiu_degree_word: "",
      xing_xiu_chou: includeChou
        ? [...(mingXingxiuChouByIndex[xingxiu.index] ?? [])]
        : null,
    };
  };
  const rawSunHouse = arcHouseFor(natalSunLongitude, birthCusps);
  const hemisphereSunHouse = input.lat < 0
    ? ((rawSunHouse + 5) % 12) + 1
    : rawSunHouse;
  const mingHouse = input.ming_type === 2
    ? 1
    : ((hemisphereSunHouse + (input.sex === 1 ? 0 : 10)) % 12) + 1;
  const eastOffset = -input.birth_zone;
  const limitStart = new Date(
    birthSolar.getTime() + (eastOffset - 8) * 3_600_000,
  );
  const limitData = makeYearLimits(
    input,
    limitStart,
    mingLongitude % 30,
    houses["1"].zhi,
    birthBazi.sizhu.year_zhu.ganzhi,
  );
  const childEnd = new Date(
    limitData.periods[0].end.getTime() - (eastOffset - 8) * 3_600_000,
  );
  const childDuration = childLimitDuration(
    limitData.periods[0].start,
    limitData.periods[0].end,
  );
  const childLimit = {
    has: true,
    ...childDuration,
    date: `${childEnd.getUTCFullYear()}年${childEnd.getUTCMonth() + 1}月` +
      `${childEnd.getUTCDate()}日`,
  };
  const transitLimit = makeTransitLimit(
    input,
    transitSolar,
    limitData,
    houses["1"].zhi,
    houses,
    boundaries,
    birthBazi.lunar_date.conventional_month ?? birthBazi.lunar_date.month,
    transitBazi.lunar_date.conventional_month ?? transitBazi.lunar_date.month,
  );
  const events = riseSet(input);
  const hour = birthSolar.getUTCHours() + birthSolar.getUTCMinutes() / 60;
  return {
    delta_time: formatDateTime(birthSolar),
    delta_time_transit: formatDateTime(transitSolar),
    bazi_date: birthBazi,
    bazi_data: birthBazi,
    transit_data: transitBazi,
    ke_zhu: keZhu(birthBazi),
    ke_zhu_transit: keZhu(transitBazi),
    date_time1: formatInputDateTime(input.transit_date, input.transit_time),
    date_time2: formatInputDateTime(input.date, input.time),
    planets1,
    planets2,
    houses1: houses,
    houses2: clone(houses),
    xingxiu_list: boundaries,
    yaos1: makeYaos(transitBazi, firstSign, "transit"),
    yaos2: makeYaos(birthBazi, firstSign, "natal"),
    year_limit_list: limitData.rows,
    transit_limit: transitLimit,
    ge_ju_display_mode: input.ge_ju_display_mode,
    ge_ju_list: [],
    ge_ju_items: [],
    ming_shen: {
      ming_zhu: makeMaster(mingLongitude, mingHouse, true),
      shen_zhu: makeMaster(shenLongitude, planets2[1].house, false),
      list: [],
    },
    rise_set: events,
    day_night: hour >= 6 && hour < 18,
    child_limit: childLimit,
    houses_arc: makeArcHouses(birthChart, input),
  };
}

/**
 * Local Zhengyu computation using astronomy-engine and the local calendar code.
 * Server-only 格局/神煞 prose and rules are intentionally absent.
 */
export function calculateZhengyu(input: ZhengyuRequest): ZhengyuResult {
  return buildZhengyuResult(input);
}
