import type { ObserverLocation, SolarBodyId } from "../../lib/ephemeris";
import type {
  AspectOrbSettings,
  ChartTextMode,
  NameStyle,
} from "../../lib/settings-store";

export type ChartTabId = "observation" | "astrology" | "zhengyu" | "bazi" | "gaitian";
export type ChartGender = "male" | "female";

export interface ChartContext {
  date: Date;
  timeZone: string;
  location: ObserverLocation;
  gender: ChartGender;
}

export type VirtualBodyId = "NorthNode" | "SouthNode" | "Lilith" | "Ziqi";

export type ChartLink =
  | { kind: "body"; id: SolarBodyId | VirtualBodyId }
  | { kind: "house"; id: number }
  | { kind: "sign"; id: number }
  | { kind: "mansion"; id: number }
  | { kind: "asterism"; id: string }
  | { kind: "sky"; id: string };

export type ChartLinkWithLongitude = ChartLink & { longitude?: number };

export interface ChartRenderOptions {
  selectedBody?: string;
  textMode?: ChartTextMode;
  nameStyle?: NameStyle;
  zhengyuCalcType?: 0 | 4;
  zhengyuMingType?: 0 | 2;
  zhengyuShenType?: 0 | 1;
  zhengyuNodeTrue?: boolean;
  baziTrueSolarTime?: boolean;
  aspectOrbs?: AspectOrbSettings;
}

export interface ChartRenderer {
  render(context: ChartContext, options: ChartRenderOptions): string;
}
