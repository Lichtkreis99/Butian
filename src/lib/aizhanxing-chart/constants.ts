// @ts-nocheck -- vendored reference engine; calculation logic intentionally unchanged.
import { Body } from "astronomy-engine";

import type { AspectType, ChartBodyName, PlanetaryRulerName } from "./types";

export const DEFAULT_BODY_NAMES: readonly ChartBodyName[] = [
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
  "NorthNode",
  "Asc",
];

export const ASTRONOMY_BODIES: Readonly<
  Record<Exclude<ChartBodyName, "NorthNode" | "Asc">, Body>
> = {
  Sun: Body.Sun,
  Moon: Body.Moon,
  Mercury: Body.Mercury,
  Venus: Body.Venus,
  Mars: Body.Mars,
  Jupiter: Body.Jupiter,
  Saturn: Body.Saturn,
  Uranus: Body.Uranus,
  Neptune: Body.Neptune,
  Pluto: Body.Pluto,
};

export const ASPECT_DEGREES: Readonly<Record<AspectType, number>> = {
  1: 0,
  2: 180,
  3: 120,
  4: 90,
  5: 60,
  6: 30,
  7: 150,
  8: 45,
  9: 135,
  10: 72,
};

export const ASPECT_ORBS: Readonly<Record<AspectType, number>> = {
  1: 7,
  2: 6,
  3: 6,
  4: 6,
  5: 6,
  6: 3,
  7: 3,
  8: 3,
  9: 3,
  10: 3,
};

/**
 * The site's `orbsLight` defaults (`zD` in index-DNKV1GVw.js). These are
 * planetary diameters; a pair's classical cap is the mean of both values.
 */
export const ASPECT_LIGHT_ORBS: Readonly<
  Record<ChartBodyName | "Mc", number>
> = {
  Sun: 15,
  Moon: 12,
  Mercury: 7,
  Venus: 7,
  Mars: 8,
  Jupiter: 9,
  Saturn: 9,
  Uranus: 5,
  Neptune: 5,
  Pluto: 5,
  NorthNode: 5,
  Asc: 5,
  Mc: 5,
};

/** The backend's default sample expands aspect-type orbs by 1° for a luminary. */
export const LUMINARY_ASPECT_ORB_EXTENSION = 1;

export const SIGN_NAMES = [
  "白羊座",
  "金牛座",
  "双子座",
  "巨蟹座",
  "狮子座",
  "处女座",
  "天秤座",
  "天蝎座",
  "射手座",
  "摩羯座",
  "水瓶座",
  "双鱼座",
] as const;

export const BODY_PRESENTATION: Readonly<
  Record<ChartBodyName, { nameZh: string; glyph: string; color: string }>
> = {
  Sun: { nameZh: "太阳", glyph: "sun", color: "#f5627a" },
  Moon: { nameZh: "月亮", glyph: "moon", color: "#628bf5" },
  Mercury: { nameZh: "水星", glyph: "mercury", color: "#3dcc91" },
  Venus: { nameZh: "金星", glyph: "venus", color: "#f5bc49" },
  Mars: { nameZh: "火星", glyph: "mars", color: "#f5627a" },
  Jupiter: { nameZh: "木星", glyph: "jupiter", color: "#f5627a" },
  Saturn: { nameZh: "土星", glyph: "saturn", color: "#f5bc49" },
  Uranus: { nameZh: "天王星", glyph: "uranus", color: "#3dcc91" },
  Neptune: { nameZh: "海王星", glyph: "neptune", color: "#628bf5" },
  Pluto: { nameZh: "冥王星", glyph: "pluto", color: "#628bf5" },
  NorthNode: { nameZh: "北交点", glyph: "northNode", color: "#628bf5" },
  Asc: { nameZh: "上升点", glyph: "asc", color: "#f5627a" },
};

export const CHALDEAN_ORDER: readonly PlanetaryRulerName[] = [
  "Saturn",
  "Jupiter",
  "Mars",
  "Sun",
  "Venus",
  "Mercury",
  "Moon",
];

export const WEEKDAY_RULERS: readonly PlanetaryRulerName[] = [
  "Sun",
  "Moon",
  "Mars",
  "Mercury",
  "Jupiter",
  "Venus",
  "Saturn",
];
