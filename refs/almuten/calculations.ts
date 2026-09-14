import {
  Body,
  Ecliptic,
  GeoVector,
  MakeTime,
  Observer,
  SearchRiseSet,
  SiderealTime,
  e_tilt,
} from "astronomy-engine";

export const bodyGlyphs = [
  "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "‹",
] as const;
export const signGlyphs = [
  "a", "s", "d", "f", "g", "h", "j", "k", "l", "z", "x", "c",
] as const;
export const signElements = [
  "fire", "earth", "air", "water", "fire", "earth",
  "air", "water", "fire", "earth", "air", "water",
] as const;

export type HouseSystem =
  | "P" | "K" | "O" | "R" | "C" | "E" | "W" | "B" | "M" | "U" | "Y";
export type Direction = "E" | "W" | "N" | "S";

export interface ChartInput {
  name: string;
  month: number;
  day: number;
  year: number;
  hour: number;
  minute: number;
  location: string;
  longitudeDegrees: number;
  longitudeDirection: "E" | "W";
  longitudeMinutes: number;
  latitudeDegrees: number;
  latitudeDirection: "N" | "S";
  latitudeMinutes: number;
  timezoneOffset: number;
  houseSystem: HouseSystem;
}

export interface Position {
  id: string;
  glyph: string;
  longitude: number;
  speed: number;
  retrograde: boolean;
  house: number;
}

export interface Dignity {
  domicile: string;
  exaltation: string;
  triplicity: [string, string, string];
  bound: string;
  face: string;
  detriment: string;
  fall: string;
  score: number | null;
  almuten: string;
}

export interface Aspect {
  first: number;
  second: number;
  angle: 0 | 60 | 90 | 120 | 180;
  glyph: "q" | "e" | "w" | "t" | "r";
  color: string;
  orb: number;
  applying: boolean;
}

export interface Period {
  ruler: string;
  subRuler?: string;
  date: string;
  loosingBond?: boolean;
}

export interface ChartResult {
  input: ChartInput;
  utcDate: Date;
  longitude: number;
  latitude: number;
  ascendant: number;
  midheaven: number;
  houses: number[];
  positions: Position[];
  aspects: Aspect[];
  dignities: Dignity[];
  lots: {
    fortune: number;
    spirit: number;
    basis: number;
    marriageMale: number;
    marriageFemale: number;
    children: number;
  };
  isDayChart: boolean;
  planetaryHour: string;
  warning?: string;
  firdaria: Period[];
  profections: Array<{ year: number; house: number; ruler: string }>;
  fortuneAphesis: Period[];
  spiritAphesis: Period[];
}

const DEG = Math.PI / 180;
const YEAR_DAYS = 365.2422;

export function normalize(value: number): number {
  return ((value % 360) + 360) % 360;
}

function signedAngle(value: number): number {
  return ((value + 540) % 360) - 180;
}

function circularDistance(a: number, b: number): number {
  return Math.abs(signedAngle(a - b));
}

function eclipticRa(longitude: number, obliquity: number): number {
  const longitudeRad = longitude * DEG;
  return normalize(
    Math.atan2(
      Math.sin(longitudeRad) * Math.cos(obliquity * DEG),
      Math.cos(longitudeRad),
    ) / DEG,
  );
}

function raToEcliptic(ra: number, obliquity: number): number {
  const raRad = ra * DEG;
  return normalize(Math.atan2(Math.sin(raRad) / Math.cos(obliquity * DEG), Math.cos(raRad)) / DEG);
}

function declination(longitude: number, obliquity: number): number {
  return Math.asin(Math.sin(longitude * DEG) * Math.sin(obliquity * DEG)) / DEG;
}

export function toUtcDate(input: ChartInput): Date {
  const localTime = Date.UTC(
    input.year,
    input.month - 1,
    input.day,
    input.hour,
    input.minute,
  );
  return new Date(localTime - input.timezoneOffset * 60_000);
}

export function validateChartInput(input: ChartInput): string | null {
  if (!Number.isInteger(input.year) || input.year < 1 || input.year > 9999) {
    return "年份必須介於 1 到 9999。";
  }
  if (!Number.isInteger(input.month) || input.month < 1 || input.month > 12) {
    return "月份超出範圍。";
  }
  if (!Number.isInteger(input.day) || input.day < 1 || input.day > 31) {
    return "日期超出範圍。";
  }
  if (!Number.isInteger(input.hour) || input.hour < 0 || input.hour > 23) {
    return "小時超出範圍。";
  }
  if (!Number.isInteger(input.minute) || input.minute < 0 || input.minute > 59) {
    return "分鐘超出範圍。";
  }
  if (
    !Number.isFinite(input.longitudeDegrees)
    || input.longitudeDegrees < 0
    || input.longitudeDegrees > 180
  ) {
    return "經度必須介於 0 到 180 度。";
  }
  if (
    !Number.isFinite(input.longitudeMinutes)
    || input.longitudeMinutes < 0
    || input.longitudeMinutes >= 60
  ) {
    return "經度分必須介於 0 到 59。";
  }
  if (
    !Number.isFinite(input.latitudeDegrees)
    || input.latitudeDegrees < 0
    || input.latitudeDegrees > 90
  ) {
    return "緯度必須介於 0 到 90 度。";
  }
  if (
    !Number.isFinite(input.latitudeMinutes)
    || input.latitudeMinutes < 0
    || input.latitudeMinutes >= 60
  ) {
    return "緯度分必須介於 0 到 59。";
  }
  if (input.latitudeDegrees === 90 && input.latitudeMinutes !== 0) {
    return "緯度不可超過 90 度。";
  }
  const check = new Date(Date.UTC(input.year, input.month - 1, input.day));
  if (
    check.getUTCFullYear() !== input.year
    || check.getUTCMonth() !== input.month - 1
    || check.getUTCDate() !== input.day
  ) {
    return "出生日期不存在。";
  }
  return null;
}

function geographic(input: ChartInput): { longitude: number; latitude: number } {
  const longitude = (input.longitudeDegrees + input.longitudeMinutes / 60)
    * (input.longitudeDirection === "W" ? -1 : 1);
  const latitude = (input.latitudeDegrees + input.latitudeMinutes / 60)
    * (input.latitudeDirection === "S" ? -1 : 1);
  return { longitude, latitude };
}

function angles(date: Date, longitude: number, latitude: number) {
  const time = MakeTime(date);
  const obliquity = e_tilt(time).tobl;
  const ramc = normalize(SiderealTime(time) * 15 + longitude);
  const theta = ramc * DEG;
  const epsilon = obliquity * DEG;
  const phi = latitude * DEG;
  const eastern = normalize(
    Math.atan2(
      -Math.cos(theta),
      Math.sin(theta) * Math.cos(epsilon) + Math.tan(phi) * Math.sin(epsilon),
    ) / DEG,
  );
  const ascendant = normalize(eastern + 180);
  const midheaven = normalize(
    Math.atan2(Math.sin(theta), Math.cos(theta) * Math.cos(epsilon)) / DEG,
  );
  return { time, obliquity, ramc, ascendant, midheaven };
}

function oppositeCusps(firstSix: number[]): number[] {
  return [...firstSix, ...firstSix.map((value) => normalize(value + 180))];
}

function rootLongitude(
  fn: (longitude: number) => number,
  start: number,
  end: number,
): number {
  let best = normalize(start);
  let bestValue = Number.POSITIVE_INFINITY;
  const span = normalize(end - start);
  for (let index = 0; index <= 720; index += 1) {
    const longitude = normalize(start + span * index / 720);
    const value = Math.abs(fn(longitude));
    if (value < bestValue) { best = longitude; bestValue = value; }
  }
  let step = 0.5;
  for (let pass = 0; pass < 28; pass += 1) {
    const left = normalize(best - step);
    const right = normalize(best + step);
    const lv = Math.abs(fn(left));
    const rv = Math.abs(fn(right));
    if (lv < bestValue) {
      best = left;
      bestValue = lv;
    }
    if (rv < bestValue) {
      best = right;
      bestValue = rv;
    }
    step /= 2;
  }
  return best;
}

function placidusCusps(
  asc: number,
  mc: number,
  ramc: number,
  latitude: number,
  obliquity: number,
): number[] | null {
  const phi = latitude * DEG;
  const semiarc = (longitude: number) => {
    const argument = -Math.tan(phi)
      * Math.tan(declination(longitude, obliquity) * DEG);
    if (Math.abs(argument) > 1) return null;
    return Math.acos(argument) / DEG;
  };
  const upper = [1 / 3, 2 / 3].map((fraction) => rootLongitude(
    (longitude) => {
      const arc = semiarc(longitude);
      return arc === null
        ? 999
        : signedAngle(eclipticRa(longitude, obliquity) - ramc) - fraction * arc;
    },
    mc,
    asc,
  ));
  const lower = [2 / 3, 1 / 3].map((fraction) => rootLongitude(
    (longitude) => {
      const arc = semiarc(longitude);
      if (arc === null) return 999;
      const nocturnalArc = 180 - arc;
      return signedAngle(
        eclipticRa(longitude, obliquity) - normalize(ramc + 180),
      ) + fraction * nocturnalArc;
    },
    asc,
    normalize(mc + 180),
  ));
  if ([...upper, ...lower].some((value) => !Number.isFinite(value))) return null;
  return [
    asc,
    lower[0],
    lower[1],
    normalize(mc + 180),
    normalize(upper[0] + 180),
    normalize(upper[1] + 180),
    normalize(asc + 180),
    normalize(lower[0] + 180),
    normalize(lower[1] + 180),
    mc,
    upper[0],
    upper[1],
  ];
}

function regioCusps(ramc: number, latitude: number, obliquity: number): number[] {
  const phi = latitude * DEG;
  const north = [
    -Math.sin(phi) * Math.cos(ramc * DEG),
    -Math.sin(phi) * Math.sin(ramc * DEG),
    Math.cos(phi),
  ];
  const cusp = (offset: number) => {
    const alpha = (ramc + offset) * DEG;
    const q = [Math.cos(alpha), Math.sin(alpha), 0];
    const p = [
      north[1] * q[2] - north[2] * q[1],
      north[2] * q[0] - north[0] * q[2],
      north[0] * q[1] - north[1] * q[0],
    ];
    const value = normalize(
      Math.atan2(
        -p[0],
        p[1] * Math.cos(obliquity * DEG)
          + p[2] * Math.sin(obliquity * DEG),
      ) / DEG,
    );
    return value;
  };
  return Array.from({ length: 12 }, (_, index) => cusp(((index + 3) % 12) * 30));
}

function campanusCusps(ramc: number, latitude: number, obliquity: number): number[] {
  const phi = latitude * DEG;
  const zenith = [
    Math.cos(phi) * Math.cos(ramc * DEG),
    Math.cos(phi) * Math.sin(ramc * DEG),
    Math.sin(phi),
  ];
  const east = [-Math.sin(ramc * DEG), Math.cos(ramc * DEG), 0];
  return Array.from({ length: 12 }, (_, index) => {
    const angle = (90 - index * 30) * DEG;
    const pole = [
      zenith[0] * Math.cos(angle) + east[0] * Math.sin(angle),
      zenith[1] * Math.cos(angle) + east[1] * Math.sin(angle),
      zenith[2] * Math.cos(angle),
    ];
    const p = [
      -pole[1] * Math.sin(obliquity * DEG)
        - pole[2] * Math.cos(obliquity * DEG),
      pole[0] * Math.sin(obliquity * DEG),
      pole[0] * Math.cos(obliquity * DEG),
    ];
    return normalize(Math.atan2(p[1], p[0]) / DEG);
  });
}

function porphyryCusps(asc: number, mc: number): number[] {
  const nocturnal = normalize(mc + 180 - asc);
  const first = [
    asc,
    normalize(asc + nocturnal / 3),
    normalize(asc + 2 * nocturnal / 3),
    normalize(mc + 180),
    0,
    0,
  ];
  first[4] = normalize(first[2] + 180);
  first[5] = normalize(first[1] + 180);
  return oppositeCusps(first);
}

function raDivisionCusps(asc: number, mc: number, obliquity: number): number[] {
  const raAsc = eclipticRa(asc, obliquity);
  const raMc = eclipticRa(mc, obliquity);
  const arc = normalize(raAsc - raMc);
  const c11 = raToEcliptic(raMc + arc / 3, obliquity);
  const c12 = raToEcliptic(raMc + 2 * arc / 3, obliquity);
  const raIc = normalize(raMc + 180);
  const lowerArc = normalize(raIc - raAsc);
  const c2 = raToEcliptic(raAsc + lowerArc / 3, obliquity);
  const c3 = raToEcliptic(raAsc + 2 * lowerArc / 3, obliquity);
  return [
    asc,
    c2,
    c3,
    normalize(mc + 180),
    normalize(c11 + 180),
    normalize(c12 + 180),
    normalize(asc + 180),
    normalize(c2 + 180),
    normalize(c3 + 180),
    mc,
    c11,
    c12,
  ];
}

function kochCusps(
  asc: number,
  mc: number,
  ramc: number,
  latitude: number,
  obliquity: number,
): number[] | null {
  const ascendantDeclination = declination(asc, obliquity) * DEG;
  const ascensionalDifference = Math.max(
    -1,
    Math.min(1, Math.tan(latitude * DEG) * Math.tan(ascendantDeclination)),
  );
  const ad = Math.asin(ascensionalDifference) / DEG;
  if (!Number.isFinite(ad)) return null;
  const c11 = raToEcliptic(ramc + 30 + ad * 0.335492915, obliquity);
  const c12 = raToEcliptic(ramc + 60 + ad * 0.675998107, obliquity);
  const c2 = raToEcliptic(ramc + 120 + ad * 1.268494442, obliquity);
  const c3 = raToEcliptic(ramc + 150 + ad * 1.337418717, obliquity);
  return [
    asc,
    c2,
    c3,
    normalize(mc + 180),
    normalize(c11 + 180),
    normalize(c12 + 180),
    normalize(asc + 180),
    normalize(c2 + 180),
    normalize(c3 + 180),
    mc,
    c11,
    c12,
  ];
}

export function calculateHouses(
  system: HouseSystem,
  asc: number,
  mc: number,
  ramc: number,
  latitude: number,
  obliquity: number,
): { cusps: number[]; warning?: string } {
  let cusps: number[] | null = null;
  if (system === "W") {
    cusps = Array.from(
      { length: 12 },
      (_, index) => normalize(Math.floor(asc / 30) * 30 + index * 30),
    );
  }
  if (system === "E") {
    cusps = Array.from(
      { length: 12 },
      (_, index) => normalize(asc + index * 30),
    );
  }
  if (system === "O") cusps = porphyryCusps(asc, mc);
  if (system === "R") cusps = regioCusps(ramc, latitude, obliquity);
  if (system === "C") cusps = campanusCusps(ramc, latitude, obliquity);
  if (system === "B") cusps = raDivisionCusps(asc, mc, obliquity);
  if (system === "P") {
    cusps = placidusCusps(asc, mc, ramc, latitude, obliquity);
  }
  if (system === "K") cusps = kochCusps(asc, mc, ramc, latitude, obliquity);
  if (system === "M") {
    cusps = Array.from(
      { length: 12 },
      (_, index) => raToEcliptic(ramc + 90 + index * 30, obliquity),
    );
  }
  if (system === "U" || system === "Y") cusps = porphyryCusps(asc, mc);
  if (!cusps || cusps.some((value) => !Number.isFinite(value))) {
    return {
      cusps: porphyryCusps(asc, mc),
      warning: "此緯度無法計算所選宮位制，已改用 Porphyry 制。",
    };
  }
  return { cusps: cusps.map(normalize) };
}

function meanNode(date: Date): number {
  const jd = date.getTime() / 86_400_000 + 2_440_587.5;
  const t = (jd - 2_451_545) / 36_525;
  return normalize(
    125.0445479
      - 1934.1362891 * t
      + 0.0020754 * t * t
      + t * t * t / 467441
      - t ** 4 / 60616000,
  );
}

const astronomyBodies = [
  Body.Sun,
  Body.Moon,
  Body.Mercury,
  Body.Venus,
  Body.Mars,
  Body.Jupiter,
  Body.Saturn,
  Body.Uranus,
  Body.Neptune,
  Body.Pluto,
] as const;

function longitudeAt(body: Body, date: Date): number {
  return Ecliptic(GeoVector(body, date, true)).elon;
}

function houseOf(longitude: number, cusps: number[]): number {
  for (let index = 0; index < 12; index += 1) {
    const span = normalize(cusps[(index + 1) % 12] - cusps[index]);
    if (normalize(longitude - cusps[index]) < span) return index + 1;
  }
  return 1;
}

const domicile = ["T", "R", "E", "W", "Q", "E", "R", "T", "Y", "U", "U", "Y"];
const exaltation = ["Q", "W", "", "Y", "", "E", "U", "", "", "T", "", "R"];
const triplicityDay = ["Q", "R", "U", "R"];
const triplicityNight = ["Y", "W", "E", "T"];
const triplicityPartner = ["U", "T", "Y", "W"];
const egyptianBounds: Array<Array<[number, string]>> = [
  [[6, "Y"], [14, "R"], [21, "E"], [26, "T"], [30, "U"]],
  [[8, "R"], [14, "E"], [22, "Y"], [27, "U"], [30, "T"]],
  [[6, "E"], [12, "Y"], [17, "R"], [24, "T"], [30, "U"]],
  [[7, "T"], [13, "R"], [19, "E"], [26, "Y"], [30, "U"]],
  [[6, "Y"], [11, "R"], [18, "U"], [24, "E"], [30, "T"]],
  [[7, "E"], [13, "R"], [18, "Y"], [24, "U"], [30, "T"]],
  [[6, "U"], [14, "E"], [21, "Y"], [28, "R"], [30, "T"]],
  [[7, "T"], [11, "R"], [19, "E"], [24, "Y"], [30, "U"]],
  [[12, "Y"], [17, "R"], [21, "E"], [26, "U"], [30, "T"]],
  [[7, "E"], [14, "Y"], [22, "R"], [26, "U"], [30, "T"]],
  [[7, "E"], [13, "R"], [20, "Y"], [25, "T"], [30, "U"]],
  [[12, "R"], [16, "Y"], [19, "E"], [28, "T"], [30, "U"]],
];
const faceCycle = ["T", "Q", "R", "E", "W", "U", "Y"];

export function calculateDignity(
  longitude: number,
  glyph: string,
  _isDay: boolean,
  scored: boolean,
): Dignity {
  const sign = Math.floor(longitude / 30);
  const degree = longitude % 30;
  const element = sign % 4;
  const bound = egyptianBounds[sign].find(([end]) => degree < end)?.[1] ?? "U";
  const face = faceCycle[Math.floor(longitude / 10) % 7];
  const triplicity: [string, string, string] = [
    triplicityDay[element],
    triplicityNight[element],
    triplicityPartner[element],
  ];
  const det = domicile[(sign + 6) % 12];
  const fall = exaltation[(sign + 6) % 12];
  const candidates = new Map<string, number>();
  const add = (planet: string, points: number) => {
    if (planet) candidates.set(planet, (candidates.get(planet) ?? 0) + points);
  };
  add(domicile[sign], 5);
  add(exaltation[sign], 4);
  triplicity.forEach((planet) => add(planet, 3));
  add(bound, 2);
  add(face, 1);
  let almuten = "";
  let max = -1;
  for (const [planet, points] of candidates) {
    if (points > max) {
      almuten = planet;
      max = points;
    }
  }
  let score: number | null = null;
  if (scored) {
    score = 0;
    if (glyph === domicile[sign]) score += 5;
    if (glyph === exaltation[sign]) score += 4;
    if (triplicity.includes(glyph)) score += 3;
    if (glyph === bound) score += 2;
    if (glyph === face) score += 1;
    if (glyph === det) score -= 5;
    if (glyph === fall) score -= 4;
  }
  return {
    domicile: domicile[sign],
    exaltation: exaltation[sign],
    triplicity,
    bound,
    face,
    detriment: det,
    fall,
    score,
    almuten,
  };
}

const aspectTypes = [
  { angle: 0 as const, glyph: "q" as const, color: "#666", bonus: 0 },
  { angle: 60 as const, glyph: "t" as const, color: "blue", bonus: 0 },
  { angle: 90 as const, glyph: "r" as const, color: "red", bonus: 0 },
  { angle: 120 as const, glyph: "e" as const, color: "#008000", bonus: 0 },
  { angle: 180 as const, glyph: "w" as const, color: "red", bonus: 0 },
];
const aspectOrbs = [15, 12, 7, 7, 8, 9, 9, 5, 5, 5, 5, 5.5, 4.7];

function calculateAspects(positions: Position[]): Aspect[] {
  const result: Aspect[] = [];
  for (let first = 0; first < positions.length; first += 1) {
    for (let second = first + 1; second < positions.length; second += 1) {
      const separation = circularDistance(
        positions[first].longitude,
        positions[second].longitude,
      );
      const type = aspectTypes.reduce((best, candidate) => (
        Math.abs(separation - candidate.angle) < Math.abs(separation - best.angle)
          ? candidate
          : best
      ));
      const orb = Math.abs(separation - type.angle);
      if (orb > (aspectOrbs[first] + aspectOrbs[second]) / 2) continue;

      const futureSeparation = circularDistance(
        positions[first].longitude + positions[first].speed / 24,
        positions[second].longitude + positions[second].speed / 24,
      );
      result.push({
        first,
        second,
        angle: type.angle,
        glyph: type.glyph,
        color: type.color,
        orb,
        applying: Math.abs(futureSeparation - type.angle) < orb,
      });
    }
  }
  return result;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}
function dateText(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function firdariaPeriods(date: Date, isDay: boolean): Period[] {
  // Nocturnal Firdaria places the nodes after Mars, before the solar periods.
  const order = isDay
    ? [
      ["Q", 10],
      ["R", 8],
      ["E", 13],
      ["W", 9],
      ["U", 11],
      ["Y", 12],
      ["T", 7],
      ["‹", 3],
      ["Œ", 2],
    ] as const
    : [
      ["W", 9],
      ["U", 11],
      ["Y", 12],
      ["T", 7],
      ["‹", 3],
      ["Œ", 2],
      ["Q", 10],
      ["R", 8],
      ["E", 13],
    ] as const;
  const periods: Period[] = [];
  let cursorDays = 0;
  let orderIndex = 0;
  while (cursorDays <= YEAR_DAYS * 102) {
    const [major, years] = order[orderIndex % order.length];
    periods.push({ ruler: major, date: dateText(addDays(date, cursorDays)) });
    if (major !== "‹" && major !== "Œ") {
      const traditional = ["Q", "R", "E", "W", "U", "Y", "T"];
      const start = traditional.indexOf(major);
      for (let index = 1; index < 7; index += 1) {
        const subperiodDays = YEAR_DAYS * years * index / 7;
        periods.push({
          ruler: major,
          subRuler: traditional[(start + index) % 7],
          date: dateText(addDays(date, cursorDays + subperiodDays)),
        });
      }
    }
    cursorDays += YEAR_DAYS * years;
    orderIndex += 1;
  }
  return periods;
}

const zodiacYears = [15, 8, 20, 25, 19, 20, 8, 15, 12, 27, 30, 12];
function aphesisPeriods(date: Date, longitude: number): Period[] {
  // Zodiacal releasing uses 360-day years and 30-day months of the sign ruler.
  const periods: Period[] = [];
  const startDate = date;
  let majorSign = Math.floor(longitude / 30);
  let majorStartDays = 0;
  while (majorStartDays <= 102 * 365.25) {
    const majorEndDays = majorStartDays + zodiacYears[majorSign] * 360;
    let displayedMajor = majorSign;
    let subSign = majorSign;
    let cursorDays = majorStartDays;
    let didLoosingBond = false;
    periods.push({
      ruler: signGlyphs[majorSign],
      date: dateText(addDays(startDate, cursorDays)),
    });
    while (true) {
      cursorDays += zodiacYears[subSign] * 30;
      if (cursorDays >= majorEndDays) break;
      subSign = (subSign + 1) % 12;
      if (subSign === majorSign && !didLoosingBond) {
        displayedMajor = (majorSign + 6) % 12;
        subSign = displayedMajor;
        didLoosingBond = true;
        periods.push({
          ruler: signGlyphs[displayedMajor],
          date: dateText(addDays(startDate, cursorDays)),
          loosingBond: true,
        });
      } else {
        periods.push({
          ruler: signGlyphs[displayedMajor],
          subRuler: signGlyphs[subSign],
          date: dateText(addDays(startDate, cursorDays)),
        });
      }
    }
    majorStartDays = majorEndDays;
    majorSign = (majorSign + 1) % 12;
  }
  return periods;
}

function planetaryHour(
  date: Date,
  longitude: number,
  latitude: number,
  timezoneOffset: number,
): string {
  const dayRulers = ["Q","W","T","E","Y","R","U"];
  const chaldean = ["U","Y","T","Q","R","E","W"];
  const observer = new Observer(latitude, longitude, 0);
  const previousRise = SearchRiseSet(Body.Sun, observer, 1, date, -2);
  const previousSet = SearchRiseSet(Body.Sun, observer, -1, date, -2);
  const nextRise = SearchRiseSet(Body.Sun, observer, 1, date, 2);
  const nextSet = SearchRiseSet(Body.Sun, observer, -1, date, 2);
  let ordinal = 0;
  let rulerDate = date;
  if (previousRise && previousSet && nextRise && nextSet) {
    const rise = previousRise.date.getTime();
    const set = previousSet.date.getTime();
    const now = date.getTime();
    if (rise > set) {
      ordinal = Math.min(
        11,
        Math.floor((now - rise) / (nextSet.date.getTime() - rise) * 12),
      );
    } else {
      ordinal = 12 + Math.min(
        11,
        Math.floor((now - set) / (nextRise.date.getTime() - set) * 12),
      );
      rulerDate = previousSet.date;
    }
  } else {
    const localLongitude = (date.getUTCHours() + date.getUTCMinutes() / 60) * 15
      + longitude;
    ordinal = Math.floor(normalize(localLongitude) / 15);
  }
  const localRulerDate = new Date(rulerDate.getTime() + timezoneOffset * 60_000);
  const weekday = localRulerDate.getUTCDay();
  const start = chaldean.indexOf(dayRulers[weekday]);
  return chaldean[(start + ordinal) % 7];
}

export function calculateChart(input: ChartInput): ChartResult {
  const validation = validateChartInput(input);
  if (validation) throw new Error(validation);
  const utcDate = toUtcDate(input);
  const { longitude, latitude } = geographic(input);
  const { obliquity, ramc, ascendant, midheaven } = angles(utcDate, longitude, latitude);
  const houseResult = calculateHouses(
    input.houseSystem,
    ascendant,
    midheaven,
    ramc,
    latitude,
    obliquity,
  );
  const planetData = astronomyBodies.map((body, index) => {
    const current = longitudeAt(body, utcDate);
    const earlier = longitudeAt(body, new Date(utcDate.getTime() - 43_200_000));
    const later = longitudeAt(body, new Date(utcDate.getTime() + 43_200_000));
    const speed = signedAngle(later - earlier);
    return {
      id: Body[body],
      glyph: bodyGlyphs[index],
      longitude: current,
      speed,
      retrograde: speed < 0,
      house: houseOf(current, houseResult.cusps),
    };
  });
  const nodeLongitude = meanNode(utcDate);
  const isDayChart = houseOf(planetData[0].longitude, houseResult.cusps) >= 7;
  // Fortune is Asc + Moon - Sun by day; the luminaries reverse by night.
  const fortuneOffset = isDayChart
    ? planetData[1].longitude - planetData[0].longitude
    : planetData[0].longitude - planetData[1].longitude;
  // Spirit uses the complementary Sun/Moon order.
  const spiritOffset = isDayChart
    ? planetData[0].longitude - planetData[1].longitude
    : planetData[1].longitude - planetData[0].longitude;
  const fortune = normalize(ascendant + fortuneOffset);
  const spirit = normalize(ascendant + spiritOffset);
  const anglesAndLots: Position[] = [
    ...planetData,
    {
      id: "MeanNode",
      glyph: "‹",
      longitude: nodeLongitude,
      speed: -0.05295,
      retrograde: true,
      house: houseOf(nodeLongitude, houseResult.cusps),
    },
    { id: "Ascendant", glyph: "Z", longitude: ascendant, speed: 0, retrograde: false, house: 1 },
    { id: "Midheaven", glyph: "X", longitude: midheaven, speed: 0, retrograde: false, house: 10 },
  ];
  const dignities = anglesAndLots.map((position, index) => calculateDignity(
    position.longitude,
    position.glyph,
    isDayChart,
    index < 7,
  ));
  const profections = Array.from({ length: 101 }, (_, index) => {
    const house = index % 12;
    return {
      year: input.year + index,
      house: house + 1,
      ruler: domicile[Math.floor(houseResult.cusps[house] / 30)],
    };
  });
  const secondHouseRuler = domicile[Math.floor(houseResult.cusps[1] / 30)];
  const secondHouseRulerIndex = bodyGlyphs.indexOf(
    secondHouseRuler as typeof bodyGlyphs[number],
  );
  const secondHouseRulerPosition = planetData[secondHouseRulerIndex]?.longitude
    ?? planetData[0].longitude;
  return {
    input,
    utcDate,
    longitude,
    latitude,
    ascendant,
    midheaven,
    houses: houseResult.cusps,
    positions: anglesAndLots,
    dignities,
    aspects: calculateAspects(anglesAndLots),
    lots: {
      fortune, spirit,
      basis: normalize(ascendant + houseResult.cusps[1] - secondHouseRulerPosition),
      marriageMale: normalize(ascendant + planetData[3].longitude - planetData[6].longitude),
      marriageFemale: normalize(ascendant + planetData[6].longitude - planetData[3].longitude),
      children: normalize(
        ascendant + (
          isDayChart
            ? planetData[5].longitude - planetData[6].longitude
            : planetData[6].longitude - planetData[5].longitude
        ),
      ),
    },
    isDayChart,
    planetaryHour: planetaryHour(
      utcDate,
      longitude,
      latitude,
      input.timezoneOffset,
    ),
    warning: houseResult.warning,
    // The original advances fractional years from the entered local clock time.
    firdaria: firdariaPeriods(
      new Date(Date.UTC(
        input.year,
        input.month - 1,
        input.day,
        input.hour,
        input.minute,
      )),
      isDayChart,
    ),
    profections,
    fortuneAphesis: aphesisPeriods(
      new Date(Date.UTC(input.year, input.month - 1, input.day)),
      fortune,
    ),
    spiritAphesis: aphesisPeriods(
      new Date(Date.UTC(input.year, input.month - 1, input.day)),
      spirit,
    ),
  };
}

export function splitDegree(longitude: number): { sign: number; degree: number; minute: number } {
  const rounded = Math.round(normalize(longitude) * 60);
  return {
    sign: Math.floor(rounded / 1800) % 12,
    degree: Math.floor((rounded % 1800) / 60),
    minute: rounded % 60,
  };
}

export const houseSystemLabels: Record<HouseSystem, string> = {
  P: "普拉西德制",
  K: "Koch制",
  O: "Porphyrius制",
  R: "苪氏分宮制",
  C: "Campanus制",
  E: "等宮制",
  W: "整宮制",
  B: "阿卡比特制",
  M: "Morinus制",
  U: "Krusinski-Pisa",
  Y: "APC 宮位制",
};
