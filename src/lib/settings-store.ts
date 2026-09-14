import type { ChartTabId } from "../ui/charts/types";

export type NameStyle = "auto" | "modern-zh" | "ancient-zh" | "english";
export type PlanetariumProjection = "stereographic" | "perspective" | "fisheye";
export type ChartTextMode = "text" | "symbol";
export type SkyCulture = "chinese" | "western";
export type LandscapeMode = "flat" | "photo" | "off";

export interface AspectOrbSettings {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
  6: number;
  7: number;
  8: number;
  9: number;
  10: number;
}

export interface XuanYeSettings {
  version: 1;
  nameStyle: NameStyle;
  involvedLabelsOnly: boolean;
  virtualRadiusDefault: boolean;
  alignChartOrientation: boolean;
  planetariumProjection: PlanetariumProjection;
  ground: boolean;
  atmosphere: boolean;
  horizonGrid: boolean;
  equatorialGrid: boolean;
  eclipticLine: boolean;
  meridianLine: boolean;
  asterismLayers: {
    enclosures: boolean;
    mansions: boolean;
    other: boolean;
  };
  starBrightness: number;
  starRelativeScale: number;
  starAbsoluteScale: number;
  bortleClass: number;
  milkyWay: boolean;
  deepSkyObjects: boolean;
  labelDensity: number;
  lastTab: ChartTabId;
  chartTextMode: ChartTextMode;
  constellationLines: boolean;
  constellationNames: boolean;
  constellationArt: boolean;
  skyCulture: SkyCulture;
  landscape: LandscapeMode;
  cardinalPoints: boolean;
  planetLabels: boolean;
  orbitLines: boolean;
  projectionLines: boolean;
  gridVisible: boolean;
  hideUninvolved: boolean;
  planetVisibility: number;
  starDistanceMin: number;
  starDistanceMax: number;
  zhengyuCalcType: 0 | 4;
  zhengyuMingType: 0 | 2;
  zhengyuShenType: 0 | 1;
  zhengyuNodeTrue: boolean;
  baziTrueSolarTime: boolean;
  aspectOrbs: AspectOrbSettings;
}

export const SETTINGS_KEY = "xuanye:settings:v1";

export const DEFAULT_SETTINGS: Readonly<XuanYeSettings> = Object.freeze({
  version: 1,
  nameStyle: "auto",
  involvedLabelsOnly: true,
  virtualRadiusDefault: false,
  alignChartOrientation: true,
  planetariumProjection: "stereographic",
  ground: true,
  atmosphere: true,
  horizonGrid: false,
  equatorialGrid: false,
  eclipticLine: true,
  meridianLine: false,
  asterismLayers: { enclosures: true, mansions: true, other: true },
  starBrightness: 1,
  starRelativeScale: 0.65,
  starAbsoluteScale: 0.55,
  bortleClass: 3,
  milkyWay: true,
  deepSkyObjects: true,
  labelDensity: 0.55,
  lastTab: "observation",
  chartTextMode: "symbol",
  constellationLines: true,
  constellationNames: true,
  constellationArt: false,
  skyCulture: "chinese",
  landscape: "flat",
  cardinalPoints: true,
  planetLabels: true,
  orbitLines: true,
  projectionLines: true,
  gridVisible: false,
  hideUninvolved: false,
  planetVisibility: 1,
  starDistanceMin: 1,
  starDistanceMax: 5_001,
  zhengyuCalcType: 0,
  zhengyuMingType: 0,
  zhengyuShenType: 0,
  zhengyuNodeTrue: false,
  baziTrueSolarTime: true,
  aspectOrbs: {
    1: 7, 2: 6, 3: 6, 4: 6, 5: 6,
    6: 3, 7: 3, 8: 3, 9: 3, 10: 3,
  },
});

type Listener = (settings: Readonly<XuanYeSettings>) => void;

function clamp(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;
}

function decode(value: unknown): XuanYeSettings {
  if (!value || typeof value !== "object") return structuredClone(DEFAULT_SETTINGS);
  const source = value as Partial<XuanYeSettings>;
  if (source.version !== 1) return structuredClone(DEFAULT_SETTINGS);
  const defaults = DEFAULT_SETTINGS;
  return {
    ...structuredClone(defaults),
    ...source,
    version: 1,
    asterismLayers: { ...defaults.asterismLayers, ...source.asterismLayers },
    aspectOrbs: { ...defaults.aspectOrbs, ...source.aspectOrbs },
    starBrightness: clamp(source.starBrightness, defaults.starBrightness),
    starRelativeScale: clamp(source.starRelativeScale, defaults.starRelativeScale),
    starAbsoluteScale: clamp(source.starAbsoluteScale, defaults.starAbsoluteScale),
    bortleClass: typeof source.bortleClass === "number"
      ? Math.min(9, Math.max(1, Math.round(source.bortleClass))) : defaults.bortleClass,
    labelDensity: clamp(source.labelDensity, defaults.labelDensity),
  };
}

export class SettingsStore {
  private value = this.load();
  private readonly listeners = new Set<Listener>();

  get current(): Readonly<XuanYeSettings> {
    return this.value;
  }

  update(patch: Partial<XuanYeSettings>): void {
    this.value = decode({ ...this.value, ...patch, version: 1 });
    this.save();
    this.emit();
  }

  reset(): void {
    this.value = structuredClone(DEFAULT_SETTINGS);
    this.save();
    this.emit();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.value);
    return () => this.listeners.delete(listener);
  }

  private load(): XuanYeSettings {
    try {
      const raw = window.localStorage.getItem(SETTINGS_KEY);
      return raw ? decode(JSON.parse(raw)) : structuredClone(DEFAULT_SETTINGS);
    } catch {
      return structuredClone(DEFAULT_SETTINGS);
    }
  }

  private save(): void {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.value));
    } catch {
      // file:// privacy modes may disable storage; the in-memory store remains valid.
    }
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.value);
  }
}
