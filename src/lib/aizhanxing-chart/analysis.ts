// @ts-nocheck -- vendored reference engine; calculation logic intentionally unchanged.
import { ASPECT_DEGREES, SIGN_NAMES } from "./constants";
import { angularDistance, normalizeDegrees } from "./math";
import type {
  AspectType,
  ChartAspect,
  ChartBodyName,
  ChartPlanet,
  NatalChartResult,
  PlanetaryRulerName,
} from "./types";

const TEN_PLANETS: readonly ChartBodyName[] = [
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
];

const TRADITIONAL_PLANETS: readonly PlanetaryRulerName[] = [
  "Sun",
  "Moon",
  "Mercury",
  "Venus",
  "Mars",
  "Jupiter",
  "Saturn",
];

const DIURNAL_PLANETS: readonly PlanetaryRulerName[] = ["Sun", "Jupiter", "Saturn"];

const SIGN_DIGNITIES: readonly SignDignity[] = [
  { domicile: "Mars", exaltation: "Sun", detriment: "Venus", fall: "Saturn" },
  { domicile: "Venus", exaltation: "Moon", detriment: "Mars", fall: null },
  { domicile: "Mercury", exaltation: null, detriment: "Jupiter", fall: null },
  { domicile: "Moon", exaltation: "Jupiter", detriment: "Saturn", fall: "Mars" },
  { domicile: "Sun", exaltation: null, detriment: "Saturn", fall: null },
  { domicile: "Mercury", exaltation: "Mercury", detriment: "Jupiter", fall: "Venus" },
  { domicile: "Venus", exaltation: "Saturn", detriment: "Mars", fall: "Sun" },
  { domicile: "Mars", exaltation: null, detriment: "Venus", fall: "Moon" },
  { domicile: "Jupiter", exaltation: null, detriment: "Mercury", fall: null },
  { domicile: "Saturn", exaltation: "Mars", detriment: "Moon", fall: "Jupiter" },
  { domicile: "Saturn", exaltation: null, detriment: "Sun", fall: null },
  { domicile: "Jupiter", exaltation: "Venus", detriment: "Mercury", fall: "Mercury" },
];

const MODERN_RULERS: readonly (readonly ChartBodyName[])[] = [
  ["Mars"],
  ["Venus"],
  ["Mercury"],
  ["Moon"],
  ["Sun"],
  ["Mercury"],
  ["Venus"],
  ["Pluto", "Mars"],
  ["Jupiter"],
  ["Saturn"],
  ["Uranus", "Saturn"],
  ["Neptune", "Jupiter"],
];

const TRIPLICITY_RULERS: readonly (readonly PlanetaryRulerName[])[] = [
  ["Sun", "Jupiter", "Saturn"],
  ["Venus", "Moon", "Mars"],
  ["Saturn", "Mercury", "Jupiter"],
  ["Venus", "Mars", "Moon"],
  ["Sun", "Jupiter", "Saturn"],
  ["Venus", "Moon", "Mars"],
  ["Saturn", "Mercury", "Jupiter"],
  ["Venus", "Mars", "Moon"],
  ["Sun", "Jupiter", "Saturn"],
  ["Venus", "Moon", "Mars"],
  ["Saturn", "Mercury", "Jupiter"],
  ["Venus", "Mars", "Moon"],
];

const FACE_RULERS: readonly (readonly PlanetaryRulerName[])[] = [
  ["Mars", "Sun", "Venus"],
  ["Mercury", "Moon", "Saturn"],
  ["Jupiter", "Mars", "Sun"],
  ["Venus", "Mercury", "Moon"],
  ["Saturn", "Jupiter", "Mars"],
  ["Sun", "Venus", "Mercury"],
  ["Moon", "Saturn", "Jupiter"],
  ["Mars", "Sun", "Venus"],
  ["Mercury", "Moon", "Saturn"],
  ["Jupiter", "Mars", "Sun"],
  ["Venus", "Mercury", "Moon"],
  ["Saturn", "Jupiter", "Mars"],
];

const EGYPTIAN_TERMS: readonly (readonly TermBoundary[])[] = [
  terms([6, "Jupiter"], [6, "Venus"], [8, "Mercury"], [5, "Mars"], [5, "Saturn"]),
  terms([8, "Venus"], [6, "Mercury"], [8, "Jupiter"], [5, "Saturn"], [3, "Mars"]),
  terms([6, "Mercury"], [6, "Jupiter"], [5, "Venus"], [7, "Mars"], [6, "Saturn"]),
  terms([7, "Mars"], [6, "Venus"], [6, "Mercury"], [7, "Jupiter"], [4, "Saturn"]),
  terms([6, "Jupiter"], [5, "Venus"], [7, "Saturn"], [6, "Mercury"], [6, "Mars"]),
  terms([7, "Mercury"], [10, "Venus"], [4, "Jupiter"], [7, "Mars"], [2, "Saturn"]),
  terms([6, "Saturn"], [8, "Mercury"], [7, "Jupiter"], [7, "Venus"], [2, "Mars"]),
  terms([7, "Mars"], [4, "Venus"], [8, "Mercury"], [5, "Jupiter"], [6, "Saturn"]),
  terms([12, "Jupiter"], [5, "Venus"], [4, "Mercury"], [5, "Saturn"], [4, "Mars"]),
  terms([7, "Mercury"], [7, "Jupiter"], [8, "Venus"], [4, "Saturn"], [4, "Mars"]),
  terms([7, "Mercury"], [6, "Venus"], [7, "Jupiter"], [5, "Mars"], [5, "Saturn"]),
  terms([12, "Venus"], [4, "Jupiter"], [3, "Mercury"], [9, "Mars"], [2, "Saturn"]),
];

const AVERAGE_SPEEDS: Readonly<Partial<Record<ChartBodyName, number>>> = {
  Sun: 0.985555556,
  Moon: 13.17638889,
  Mercury: 1.217222222,
  Venus: 1.040555556,
  Mars: 0.566111111,
  Jupiter: 0.133055556,
  Saturn: 0.069444444,
};

const PLANETARY_JOYS: Readonly<Partial<Record<ChartBodyName, number>>> = {
  Sun: 9,
  Moon: 3,
  Mercury: 1,
  Venus: 5,
  Mars: 6,
  Jupiter: 11,
  Saturn: 12,
};

interface SignDignity {
  domicile: PlanetaryRulerName;
  exaltation: PlanetaryRulerName | null;
  detriment: PlanetaryRulerName;
  fall: PlanetaryRulerName | null;
}

interface TermBoundary {
  length: number;
  ruler: PlanetaryRulerName;
}

export type AspectDirection = 0 | 1 | 2;

export interface AnalyzedAspect extends ChartAspect {
  direction: AspectDirection;
  directionLabel: "-" | "入相" | "出相";
  degreeString: string;
}

export interface PlanetDignity {
  planet: ChartBodyName;
  signIndex: number;
  domicile: PlanetaryRulerName;
  exaltation: PlanetaryRulerName | null;
  triplicity: readonly PlanetaryRulerName[];
  term: PlanetaryRulerName;
  face: PlanetaryRulerName;
  fall: PlanetaryRulerName | null;
  detriment: PlanetaryRulerName;
  score: number;
}

export interface PlanetStatus {
  planet: ChartBodyName;
  house: number;
  ruledHouses: number[];
  speed: "逆行" | "快" | "慢" | "平均" | "";
  sect: "得时" | "失时" | "-" | "";
  solarOrientation: "东出" | "西入" | "-" | "";
  solarCondition: "日核" | "焦伤" | "日光下" | "-" | "";
  joy: "喜乐" | "-" | "";
}

export interface HouseAnalysis {
  house: number;
  signIndex: number;
  modernRulers: readonly ChartBodyName[];
  classicalRuler: PlanetaryRulerName;
  planets: ChartBodyName[];
}

export interface Reception {
  planetA: PlanetaryRulerName;
  planetB: PlanetaryRulerName;
  typesA: string[];
  typesB: string[];
  mutualReception: boolean;
  receptionA: boolean;
  receptionB: boolean;
}

export interface ChartFeature {
  planet: ChartBodyName;
  type: "anaretic" | "critical-degree" | "via-combusta";
  label: string;
}

export interface DistributionAnalysis {
  /** Fire, Earth, Air, Water. */
  elements: [number, number, number, number];
  /** Cardinal, Fixed, Mutable. */
  qualities: [number, number, number];
  /** Masculine, Feminine signs. */
  polarities: [number, number];
  /** Houses 7–12, 1–6, 4–9, 10–3. Mirrors the API's orientations order. */
  hemispheres: [number, number, number, number];
}

export interface ChartAnalysis {
  aspects: AnalyzedAspect[];
  houses: HouseAnalysis[];
  dignities: PlanetDignity[];
  statuses: PlanetStatus[];
  receptions: Reception[];
  features: ChartFeature[];
  interceptedSignIndexes: number[];
  repeatedCuspSignIndexes: number[];
  distributions: DistributionAnalysis;
  isDayChart: boolean;
}

export interface ChartAnalysisOptions {
  /** The source defaults to counting all three triplicity rulers for dignity. */
  triplicityMode?: "all" | "sect";
  /** The source's reception modes: full, domicile/exaltation only, or weighted. */
  receptionMode?: "full" | "major-only" | "weighted";
}

function terms(...items: readonly (readonly [number, PlanetaryRulerName])[]) {
  return items.map(([length, ruler]) => ({ length, ruler }));
}

function isTraditional(name: ChartBodyName): name is PlanetaryRulerName {
  return TRADITIONAL_PLANETS.includes(name as PlanetaryRulerName);
}

function orbAtOffset(first: ChartPlanet, second: ChartPlanet, type: AspectType, days: number) {
  const firstLongitude = normalizeDegrees(first.longitude + first.speed * days);
  const secondLongitude = normalizeDegrees(second.longitude + second.speed * days);
  return Math.abs(angularDistance(firstLongitude, secondLongitude) - ASPECT_DEGREES[type]);
}

export function getAspectDirection(
  aspect: ChartAspect,
  first: ChartPlanet,
  second: ChartPlanet,
): AspectDirection {
  const now = orbAtOffset(first, second, aspect.type, 0);
  const future = orbAtOffset(first, second, aspect.type, 0.001);
  if (Math.abs(future - now) < 1e-10) return 0;
  return future < now ? 1 : 2;
}

function formatDegree(value: number) {
  const totalMinutes = Math.round(value * 60);
  return `${Math.floor(totalMinutes / 60)}°${String(totalMinutes % 60).padStart(2, "0")}'`;
}

function termRuler(signIndex: number, degree: number) {
  let boundary = 0;
  for (const term of EGYPTIAN_TERMS[signIndex]) {
    boundary += term.length;
    if (degree < boundary) return term.ruler;
  }
  return EGYPTIAN_TERMS[signIndex][4].ruler;
}

function faceRuler(signIndex: number, degree: number) {
  return FACE_RULERS[signIndex][Math.min(2, Math.floor(degree / 10))];
}

function dignityFor(
  planet: ChartPlanet,
  isDayChart: boolean,
  triplicityMode: "all" | "sect",
): PlanetDignity {
  const sign = SIGN_DIGNITIES[planet.signIndex];
  const triplicity = TRIPLICITY_RULERS[planet.signIndex];
  const term = termRuler(planet.signIndex, planet.degree);
  const face = faceRuler(planet.signIndex, planet.degree);
  let score = 0;
  if (sign.domicile === planet.name) score += 5;
  if (sign.exaltation === planet.name) score += 4;
  if (sign.detriment === planet.name) score -= 5;
  if (sign.fall === planet.name) score -= 4;
  const triplicityMatches = triplicityMode === "all"
    ? triplicity.includes(planet.name as PlanetaryRulerName)
    : triplicity[isDayChart ? 0 : 1] === planet.name;
  if (triplicityMatches) score += 3;
  if (term === planet.name) score += 2;
  if (face === planet.name) score += 1;
  return {
    planet: planet.name,
    signIndex: planet.signIndex,
    domicile: sign.domicile,
    exaltation: sign.exaltation,
    triplicity,
    term,
    face,
    fall: sign.fall,
    detriment: sign.detriment,
    score,
  };
}

function dignityTypes(
  dignity: PlanetDignity,
  ruler: PlanetaryRulerName,
  mode: NonNullable<ChartAnalysisOptions["receptionMode"]>,
) {
  if (dignity.fall === ruler || dignity.detriment === ruler) {
    return { score: 0, types: [] as string[] };
  }
  let score = 0;
  const types: string[] = [];
  if (dignity.domicile === ruler) {
    score += 2;
    types.push("本垣");
  } else if (dignity.exaltation === ruler) {
    score += 2;
    types.push("曜升");
  }
  if (mode === "major-only") return { score, types };
  const minorWeight = mode === "weighted" ? 2 : 1;
  if (dignity.triplicity.includes(ruler)) {
    score += minorWeight;
    types.push("三分");
  }
  if (dignity.term === ruler) {
    score += minorWeight;
    types.push("界");
  }
  if (dignity.face === ruler) {
    if (mode !== "weighted") score += 1;
    types.push("十度");
  }
  return { score, types };
}

function analyzeReceptions(
  aspects: readonly ChartAspect[],
  dignities: readonly PlanetDignity[],
  mode: NonNullable<ChartAnalysisOptions["receptionMode"]>,
) {
  const dignityMap = new Map(dignities.map((dignity) => [dignity.planet, dignity]));
  const aspectPairs = new Set(
    aspects
      .filter((aspect) => aspect.type <= 5)
      .map((aspect) => [aspect.planet1, aspect.planet2].sort().join("/")),
  );
  const oneWay: Array<{
    planetA: PlanetaryRulerName;
    planetB: PlanetaryRulerName;
    types: string[];
  }> = [];
  for (const planetA of TRADITIONAL_PLANETS) {
    const dignity = dignityMap.get(planetA);
    if (!dignity) continue;
    for (const planetB of TRADITIONAL_PLANETS) {
      if (planetA === planetB) continue;
      if (!aspectPairs.has([planetA, planetB].sort().join("/"))) continue;
      const result = dignityTypes(dignity, planetB, mode);
      if (result.score >= 2) oneWay.push({ planetA, planetB, types: result.types });
    }
  }

  const receptions: Reception[] = [];
  const used = new Set<string>();
  for (let first = 0; first < TRADITIONAL_PLANETS.length; first += 1) {
    for (let second = first + 1; second < TRADITIONAL_PLANETS.length; second += 1) {
      const planetA = TRADITIONAL_PLANETS[first];
      const planetB = TRADITIONAL_PLANETS[second];
      const dignityA = dignityMap.get(planetA);
      const dignityB = dignityMap.get(planetB);
      if (!dignityA || !dignityB) continue;
      const typesA = dignityTypes(dignityA, planetB, mode);
      const typesB = dignityTypes(dignityB, planetA, mode);
      if (typesA.score < 2 || typesB.score < 2) continue;
      const direct = oneWay.some(
        (item) => item.planetA === planetA && item.planetB === planetB,
      );
      const reverse = oneWay.some(
        (item) => item.planetA === planetB && item.planetB === planetA,
      );
      if (direct) used.add(`${planetA}/${planetB}`);
      if (reverse) used.add(`${planetB}/${planetA}`);
      receptions.push({
        planetA,
        planetB,
        typesA: typesA.types,
        typesB: typesB.types,
        mutualReception: true,
        receptionA: direct,
        receptionB: reverse,
      });
    }
  }
  for (const item of oneWay) {
    if (used.has(`${item.planetA}/${item.planetB}`)) continue;
    receptions.push({
      planetA: item.planetA,
      planetB: item.planetB,
      typesA: item.types,
      typesB: [],
      mutualReception: false,
      receptionA: true,
      receptionB: false,
    });
  }
  return receptions;
}

function speedStatus(planet: ChartPlanet): PlanetStatus["speed"] {
  if (!isTraditional(planet.name)) return "";
  if (planet.speed < 0) return "逆行";
  const average = AVERAGE_SPEEDS[planet.name];
  if (!average) return "";
  const ratio = (planet.speed - average) / average;
  if (ratio > 0.05) return "快";
  if (ratio < -0.05) return "慢";
  return "平均";
}

function sectStatus(
  planet: ChartPlanet,
  ascendant: ChartPlanet,
  isDayChart: boolean,
): PlanetStatus["sect"] {
  if (!isTraditional(planet.name)) return "";
  let diurnal = DIURNAL_PLANETS.includes(planet.name);
  if (planet.name === "Mercury") diurnal = isDayChart;
  const aboveHorizon = normalizeDegrees(planet.longitude - ascendant.longitude) > 180;
  const oneBasedSign = planet.signIndex + 1;
  if (isDayChart && aboveHorizon && oneBasedSign % 2 === 1) {
    return diurnal ? "得时" : "失时";
  }
  if (!isDayChart && aboveHorizon && oneBasedSign % 2 === 0) {
    return diurnal ? "失时" : "得时";
  }
  return "-";
}

function solarCondition(planet: ChartPlanet, sun: ChartPlanet): PlanetStatus["solarCondition"] {
  if (!isTraditional(planet.name)) return "";
  if (planet.name === "Sun") return "-";
  const distance = angularDistance(planet.longitude, sun.longitude);
  if (distance < 17 / 60) return "日核";
  if (distance < 8.5) return "焦伤";
  if (distance < 17) return "日光下";
  return "-";
}

function distributions(planets: readonly ChartPlanet[]): DistributionAnalysis {
  const counted = TEN_PLANETS.flatMap((name) => {
    const planet = planets.find((item) => item.name === name);
    return planet ? [planet] : [];
  });
  const elements: [number, number, number, number] = [0, 0, 0, 0];
  const qualities: [number, number, number] = [0, 0, 0];
  const polarities: [number, number] = [0, 0];
  const hemispheres: [number, number, number, number] = [0, 0, 0, 0];
  for (const planet of counted) {
    elements[planet.signIndex % 4] += 1;
    qualities[planet.signIndex % 3] += 1;
    polarities[planet.signIndex % 2] += 1;
    hemispheres[planet.house >= 7 ? 0 : 1] += 1;
    hemispheres[planet.house >= 4 && planet.house <= 9 ? 2 : 3] += 1;
  }
  return { elements, qualities, polarities, hemispheres };
}

function chartFeatures(planets: readonly ChartPlanet[]) {
  const result: ChartFeature[] = [];
  for (const planet of planets) {
    if (planet.degree >= 29 && planet.degree <= 30) {
      result.push({
        planet: planet.name,
        type: "anaretic",
        label: "位于岐度（所有星座的29°-30°）",
      });
    }
    const oneBasedSign = planet.signIndex + 1;
    const signType = oneBasedSign % 3;
    const critical = signType === 0
      ? (planet.degree >= 3 && planet.degree <= 5) ||
        (planet.degree >= 16 && planet.degree <= 18)
      : signType === 1
        ? (planet.degree >= 0 && planet.degree <= 2) ||
          (planet.degree >= 12 && planet.degree <= 14) ||
          (planet.degree >= 25 && planet.degree <= 27)
        : (planet.degree >= 8 && planet.degree <= 10) ||
          (planet.degree >= 20 && planet.degree <= 22);
    if (critical) {
      const signTypeLabel = signType === 1
        ? "本位星座"
        : signType === 2 ? "固定星座" : "变动星座";
      result.push({
        planet: planet.name,
        type: "critical-degree",
        label: `位于紧要度数（${planet.degreeString}, ${signTypeLabel}）`,
      });
    }
    if (planet.longitude >= 195 && planet.longitude <= 225) {
      result.push({
        planet: planet.name,
        type: "via-combusta",
        label: "位于燃烧之路",
      });
    }
  }
  return result;
}

export function analyzeNatalChart(
  chart: NatalChartResult,
  options: ChartAnalysisOptions = {},
): ChartAnalysis {
  const planetMap = new Map(chart.planets.map((planet) => [planet.name, planet]));
  const sun = planetMap.get("Sun");
  const ascendant = planetMap.get("Asc");
  if (!sun || !ascendant) throw new Error("Chart analysis requires Sun and Asc planets.");
  const isDayChart = normalizeDegrees(sun.longitude - ascendant.longitude) > 180;
  const triplicityMode = options.triplicityMode ?? "all";
  const dignityRows = TEN_PLANETS.flatMap((name) => {
    const planet = planetMap.get(name);
    return planet ? [dignityFor(planet, isDayChart, triplicityMode)] : [];
  });
  const signCuspCounts = Array.from({ length: 12 }, () => 0);
  for (const house of chart.houses) signCuspCounts[house.signIndex] += 1;
  const houses = chart.houses.map((house) => ({
    house: house.house,
    signIndex: house.signIndex,
    modernRulers: MODERN_RULERS[house.signIndex],
    classicalRuler: SIGN_DIGNITIES[house.signIndex].domicile,
    planets: chart.planets
      .filter((planet) => planet.house === house.house)
      .map((planet) => planet.name),
  }));
  const statuses = TEN_PLANETS.flatMap((name) => {
    const planet = planetMap.get(name);
    if (!planet) return [];
    const ruledHouses = houses
      .filter((house) => house.classicalRuler === planet.name)
      .map((house) => house.house);
    return [{
      planet: planet.name,
      house: planet.house,
      ruledHouses,
      speed: speedStatus(planet),
      sect: sectStatus(planet, ascendant, isDayChart),
      solarOrientation: isTraditional(planet.name)
        ? planet.name === "Sun"
          ? "-" as const
          : normalizeDegrees(planet.longitude - sun.longitude) > 180
            ? "东出" as const
            : "西入" as const
        : "" as const,
      solarCondition: solarCondition(planet, sun),
      joy: isTraditional(planet.name)
        ? PLANETARY_JOYS[planet.name] === planet.house ? "喜乐" as const : "-" as const
        : "" as const,
    }];
  });
  const analyzedAspects = chart.aspects.flatMap((aspect) => {
    const first = planetMap.get(aspect.planet1);
    const second = planetMap.get(aspect.planet2);
    if (!first || !second) return [];
    const direction = getAspectDirection(aspect, first, second);
    const labels = ["-", "入相", "出相"] as const;
    return [{
      ...aspect,
      direction,
      directionLabel: labels[direction],
      degreeString: formatDegree(aspect.orb),
    }];
  });
  return {
    aspects: analyzedAspects,
    houses,
    dignities: dignityRows,
    statuses,
    receptions: analyzeReceptions(
      chart.aspects,
      dignityRows,
      options.receptionMode ?? "full",
    ),
    features: chartFeatures(chart.planets),
    interceptedSignIndexes: signCuspCounts
      .flatMap((count, index) => count === 0 ? [index] : []),
    repeatedCuspSignIndexes: signCuspCounts
      .flatMap((count, index) => count > 1 ? [index] : []),
    distributions: distributions(chart.planets),
    isDayChart,
  };
}

export const chartAnalysisLabels = {
  signs: SIGN_NAMES,
  elements: ["火", "土", "风", "水"],
  qualities: ["本位", "固定", "变动"],
  polarities: ["阳性", "阴性"],
  hemispheres: ["第7–12宫", "第1–6宫", "第4–9宫", "第10–3宫"],
} as const;
