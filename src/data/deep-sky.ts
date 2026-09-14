import { equatorialToEclipticJ2000, type Cartesian } from "../lib/coordinates";

export interface DeepSkyObject {
  index: number;
  type: string;
  magnitude: number;
  ra: number;
  dec: number;
  direction: Cartesian;
  majorAxis: number;
  minorAxis: number;
  angle: number;
  morphology: string;
  ids: string[];
  primaryId: string;
  name: string;
  nameZh?: string;
}

const CHINESE_NAMES: Readonly<Record<string, string>> = {
  "M 31": "仙女座大星系",
  "M 42": "猎户座大星云",
  "M 45": "昴星团",
  "M 1": "蟹状星云",
  "M 13": "武仙座球状星团",
  "M 57": "环状星云",
};

function primaryId(ids: string[], index: number): string {
  return ids.find((id) => /^M \d+$/.test(id)) ??
    ids.find((id) => /^NGC \d+$/.test(id)) ??
    ids.find((id) => /^IC \d+$/.test(id)) ?? `DSO ${index + 1}`;
}

export function loadDeepSkyObjects(source = window.__XUANYE_DSO__): DeepSkyObject[] {
  if (!source) return [];
  return source.records.map((record, index) => {
    const equatorial = {
      x: Math.cos(record.d) * Math.cos(record.r),
      y: Math.cos(record.d) * Math.sin(record.r),
      z: Math.sin(record.d),
    };
    const id = primaryId(record.i, index);
    const english = record.i.find((value) => value.startsWith("NAME "))?.slice(5) ?? id;
    return {
      index,
      type: record.t,
      magnitude: record.m,
      ra: record.r,
      dec: record.d,
      direction: equatorialToEclipticJ2000(equatorial),
      majorAxis: record.a,
      minorAxis: record.b,
      angle: record.p,
      morphology: record.o,
      ids: record.i,
      primaryId: id,
      name: english,
      nameZh: CHINESE_NAMES[id],
    };
  });
}

export function deepSkyTypeLabel(type: string): string {
  if (/^G|GiG/.test(type)) return "星系";
  if (/GlC/.test(type)) return "球状星团";
  if (/OpC/.test(type)) return "疏散星团";
  if (/Neb|HII|PN|SNR/.test(type)) return "星云";
  return "深空天体";
}
