export type ChartBodyName =
  | "Sun"
  | "Moon"
  | "Mercury"
  | "Venus"
  | "Mars"
  | "Jupiter"
  | "Saturn"
  | "Uranus"
  | "Neptune"
  | "Pluto"
  | "NorthNode"
  | "Asc";

export type PlanetaryRulerName =
  | "Sun"
  | "Moon"
  | "Mercury"
  | "Venus"
  | "Mars"
  | "Jupiter"
  | "Saturn";

export type AspectType = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type AspectCalculationType = 0 | 1;
export type AspectLightBodyName = ChartBodyName | "Mc" | "Other";

export type FixedUtcOffset = number;
export type ChartTimeZone = string | FixedUtcOffset;

export type HouseSystem =
  | "P"
  | "K"
  | "W"
  | "A"
  | "B"
  | "R"
  | "D"
  | "M"
  | "O"
  | "S"
  | "T"
  | "X"
  | "C"
  | "L"
  | "U";

export type ZodiacType = "tropical" | "sidereal";
export type Ayanamsa = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 29 | 255;

export interface NatalChartOptions {
  houseSystem?: HouseSystem;
  zodiac?: ZodiacType;
  /** Swiss Ephemeris sidereal-mode identifier. */
  ayanamsa?: Ayanamsa;
  /** Used when `ayanamsa` is the custom mode (`255`). */
  customAyanamsaDegrees?: number;
  trueNode?: boolean;
  /** `0` uses per-aspect orbs; `1` uses classical per-body light orbs. */
  aspectCalculationType?: AspectCalculationType;
  aspectOrbs?: Partial<Record<AspectType, number>>;
  aspectLightOrbs?: Partial<Record<AspectLightBodyName, number>>;
  visibleAspectTypes?: readonly AspectType[];
}

export interface NatalChartInput {
  /** Local Gregorian calendar date in YYYY-MM-DD form. */
  date: string;
  /** Local civil time in HH:mm form. */
  time: string;
  latitude: number;
  longitude: number;
  /** IANA zone name, or conventional UTC offset hours (east is positive). */
  timeZone: ChartTimeZone;
  /** The site's daylight-saving flag. Applied only to fixed-offset input. */
  summer: 0 | 1;
  /** Swiss Ephemeris house-system code. Defaults to Placidus (`P`). */
  houseSystem?: HouseSystem;
}

export interface ChartPlanet {
  name: ChartBodyName;
  nameZh: string;
  glyph:
    | "sun"
    | "moon"
    | "mercury"
    | "venus"
    | "mars"
    | "jupiter"
    | "saturn"
    | "uranus"
    | "neptune"
    | "pluto"
    | "northNode"
    | "asc";
  /** Absolute ecliptic longitude in the result's selected zodiac. */
  longitude: number;
  /** Absolute longitude after the site's 7-degree label collision pass. */
  adjustedLongitude: number;
  degree: number;
  degreeString: string;
  signIndex: number;
  house: number;
  speed: number;
  status?: "逆行";
  color: string;
  description: string;
}

export interface HouseCusp {
  house: number;
  longitude: number;
  signIndex: number;
  degreeString: string;
}

export interface ChartAspect {
  planet1: ChartBodyName;
  planet2: ChartBodyName;
  type: AspectType;
  /** Distance from exactitude, in degrees. */
  orb: number;
  /** Backwards-compatible alias used by the existing wheel data shape. */
  degree: number;
}

export interface PlanetaryHost {
  sunrise: string;
  sunset: string;
  dayRuler: PlanetaryRulerName;
  hourRuler: PlanetaryRulerName;
}

export interface NatalChartResult {
  utcDate: Date;
  ascendantLongitude: number;
  midheavenLongitude: number;
  houseSystem: HouseSystem;
  zodiac: ZodiacType;
  ayanamsaDegrees: number;
  houseFallback?: "Porphyry";
  planets: ChartPlanet[];
  houses: HouseCusp[];
  aspects: ChartAspect[];
  planetaryHost?: PlanetaryHost;
}
