import type { ChineseSkyculture } from "../data/catalog";
import type { SolarBodyId } from "./ephemeris";
import type { NameStyle } from "./settings-store";
import type { ChartTabId } from "../ui/charts/types";

export type ConcreteNameStyle = Exclude<NameStyle, "auto">;

export interface BodyNames {
  modernZh: string;
  ancientZh: string;
  english: string;
}

export const BODY_NAME_TABLE: Readonly<Record<SolarBodyId, BodyNames>> = {
  Sun: { modernZh: "太阳", ancientZh: "太阳", english: "Sun" },
  Moon: { modernZh: "月球", ancientZh: "太阴", english: "Moon" },
  Mercury: { modernZh: "水星", ancientZh: "辰星", english: "Mercury" },
  Venus: { modernZh: "金星", ancientZh: "太白", english: "Venus" },
  Mars: { modernZh: "火星", ancientZh: "荧惑", english: "Mars" },
  Jupiter: { modernZh: "木星", ancientZh: "岁星", english: "Jupiter" },
  Saturn: { modernZh: "土星", ancientZh: "镇星", english: "Saturn" },
  Earth: { modernZh: "地球", ancientZh: "地", english: "Earth" },
  Uranus: { modernZh: "天王星", ancientZh: "天王星", english: "Uranus" },
  Neptune: { modernZh: "海王星", ancientZh: "海王星", english: "Neptune" },
  Pluto: { modernZh: "冥王星", ancientZh: "冥王星", english: "Pluto" },
};

export const POINT_NAME_TABLE: Readonly<Record<string, BodyNames>> = {
  NorthNode: { modernZh: "北交点", ancientZh: "罗睺", english: "North Node" },
  SouthNode: { modernZh: "南交点", ancientZh: "计都", english: "South Node" },
  Lilith: { modernZh: "月球远地点", ancientZh: "月孛", english: "Lunar Apogee" },
  Ziqi: { modernZh: "紫气", ancientZh: "紫气", english: "Ziqi" },
};

export const CONSTELLATIONS_ZH: Readonly<Record<string, string>> = {
  And: "仙女座", Ant: "唧筒座", Aps: "天燕座", Aqr: "宝瓶座", Aql: "天鹰座",
  Ara: "天坛座", Ari: "白羊座", Aur: "御夫座", Boo: "牧夫座", Cae: "雕具座",
  Cam: "鹿豹座", Cnc: "巨蟹座", CVn: "猎犬座", CMa: "大犬座", CMi: "小犬座",
  Cap: "摩羯座", Car: "船底座", Cas: "仙后座", Cen: "半人马座", Cep: "仙王座",
  Cet: "鲸鱼座", Cha: "蝘蜓座", Cir: "圆规座", Col: "天鸽座", Com: "后发座",
  CrA: "南冕座", CrB: "北冕座", Crv: "乌鸦座", Crt: "巨爵座", Cru: "南十字座",
  Cyg: "天鹅座", Del: "海豚座", Dor: "剑鱼座", Dra: "天龙座", Equ: "小马座",
  Eri: "波江座", For: "天炉座", Gem: "双子座", Gru: "天鹤座", Her: "武仙座",
  Hor: "时钟座", Hya: "长蛇座", Hyi: "水蛇座", Ind: "印第安座", Lac: "蝎虎座",
  Leo: "狮子座", LMi: "小狮座", Lep: "天兔座", Lib: "天秤座", Lup: "豺狼座",
  Lyn: "天猫座", Lyr: "天琴座", Men: "山案座", Mic: "显微镜座", Mon: "麒麟座",
  Mus: "苍蝇座", Nor: "矩尺座", Oct: "南极座", Oph: "蛇夫座", Ori: "猎户座",
  Pav: "孔雀座", Peg: "飞马座", Per: "英仙座", Phe: "凤凰座", Pic: "绘架座",
  Psc: "双鱼座", PsA: "南鱼座", Pup: "船尾座", Pyx: "罗盘座", Ret: "网罟座",
  Sge: "天箭座", Sgr: "人马座", Sco: "天蝎座", Scl: "玉夫座", Sct: "盾牌座",
  Ser: "巨蛇座", Sex: "六分仪座", Tau: "金牛座", Tel: "望远镜座", Tri: "三角座",
  TrA: "南三角座", Tuc: "杜鹃座", UMa: "大熊座", UMi: "小熊座", Vel: "船帆座",
  Vir: "室女座", Vol: "飞鱼座", Vul: "狐狸座",
};

export function constellationChineseName(iau: string): string {
  return CONSTELLATIONS_ZH[iau] ?? iau;
}

const GREEK: Readonly<Record<string, string>> = {
  alf: "α", bet: "β", gam: "γ", del: "δ", eps: "ε", zet: "ζ", eta: "η",
  tet: "θ", iot: "ι", kap: "κ", lam: "λ", mu: "μ", nu: "ν", ksi: "ξ",
  omi: "ο", pi: "π", rho: "ρ", sig: "σ", tau: "τ", ups: "υ", phi: "φ",
  chi: "χ", psi: "ψ", ome: "ω",
};

export function resolveNameStyle(
  style: NameStyle,
  tab: ChartTabId,
  kind: "body" | "star" = "body",
): ConcreteNameStyle {
  if (style !== "auto") return style;
  if (tab === "astrology") return "modern-zh";
  if (tab === "zhengyu") return "ancient-zh";
  return kind === "star" ? "ancient-zh" : "modern-zh";
}

export function bodyName(id: SolarBodyId | string, style: ConcreteNameStyle): string {
  const names = BODY_NAME_TABLE[id as SolarBodyId] ?? POINT_NAME_TABLE[id];
  if (!names) return id;
  return style === "modern-zh" ? names.modernZh
    : style === "ancient-zh" ? names.ancientZh : names.english;
}

export function modernStarName(bayer: string | undefined): string | undefined {
  const match = bayer?.match(/^([a-z]{3}) ([A-Z][a-zA-Z]{2})$/);
  if (!match) return undefined;
  const letter = GREEK[match[1]!];
  const constellation = CONSTELLATIONS_ZH[match[2]!];
  return letter && constellation ? `${constellation} ${letter}` : undefined;
}

export function starName(
  hip: number,
  style: ConcreteNameStyle,
  bayer: string | undefined,
  skyculture: ChineseSkyculture,
  english: string | undefined,
): string {
  const traditional = skyculture.commonNames[String(hip)]?.nameZh;
  if (style === "modern-zh") return modernStarName(bayer) ?? traditional ?? `HIP ${hip}`;
  if (style === "ancient-zh") return traditional ?? `HIP ${hip}`;
  return english ?? skyculture.commonNames[String(hip)]?.nameEn ?? `HIP ${hip}`;
}

export function hasNoAncientName(id: SolarBodyId): boolean {
  return id === "Uranus" || id === "Neptune" || id === "Pluto";
}
