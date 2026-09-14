import type { SolarBodyId } from "./ephemeris";
import type { ChartTabId } from "../ui/charts/types";

export type WesternMode = "modern" | "classical";

export interface ContextProfile {
  tab: ChartTabId;
  tropicalRing: boolean;
  mansionRing: boolean;
  palaceRing: boolean;
  projectionLines: boolean;
  solarTerms: boolean;
  earthRotationDial: boolean;
  fourPoints: boolean;
  emphasizeAsterisms: boolean;
  labelAllBodies: boolean;
  involvedBodies: readonly string[];
  starFilter: "all" | "dim" | "members" | "members-and-mansions";
  allowHideUninvolved: boolean;
}

const ALL_BODIES: readonly SolarBodyId[] = [
  "Sun", "Moon", "Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn",
  "Uranus", "Neptune", "Pluto",
];
const SEVEN = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"];
const NODES = ["NorthNode", "SouthNode"];

export const CONTEXT_PROFILES: Readonly<Record<ChartTabId, ContextProfile>> = {
  observation: {
    tab: "observation", tropicalRing: false, mansionRing: false, palaceRing: false,
    projectionLines: false, solarTerms: false, earthRotationDial: false,
    fourPoints: false, emphasizeAsterisms: false, labelAllBodies: true,
    involvedBodies: ALL_BODIES, starFilter: "all", allowHideUninvolved: false,
  },
  astrology: {
    tab: "astrology", tropicalRing: true, mansionRing: false, palaceRing: false,
    projectionLines: true, solarTerms: false, earthRotationDial: false,
    fourPoints: false, emphasizeAsterisms: false, labelAllBodies: false,
    involvedBodies: [...ALL_BODIES.filter((id) => id !== "Earth"), ...NODES],
    starFilter: "dim", allowHideUninvolved: true,
  },
  zhengyu: {
    tab: "zhengyu", tropicalRing: false, mansionRing: true, palaceRing: true,
    projectionLines: true, solarTerms: false, earthRotationDial: false,
    fourPoints: true, emphasizeAsterisms: false, labelAllBodies: false,
    involvedBodies: [...SEVEN, "NorthNode", "SouthNode", "Lilith"],
    starFilter: "members-and-mansions", allowHideUninvolved: true,
  },
  bazi: {
    tab: "bazi", tropicalRing: false, mansionRing: false, palaceRing: false,
    projectionLines: false, solarTerms: true, earthRotationDial: true,
    fourPoints: false, emphasizeAsterisms: false, labelAllBodies: false,
    involvedBodies: ["Sun", "Earth"], starFilter: "dim", allowHideUninvolved: true,
  },
  gaitian: {
    tab: "gaitian", tropicalRing: false, mansionRing: false, palaceRing: false,
    projectionLines: false, solarTerms: false, earthRotationDial: false,
    fourPoints: false, emphasizeAsterisms: true, labelAllBodies: false,
    involvedBodies: ["Sun", "Moon"], starFilter: "members", allowHideUninvolved: true,
  },
};

export function contextProfile(tab: ChartTabId, westernMode: WesternMode): ContextProfile {
  if (tab !== "astrology" || westernMode === "modern") return CONTEXT_PROFILES[tab];
  return { ...CONTEXT_PROFILES.astrology, involvedBodies: [...SEVEN, ...NODES] };
}
