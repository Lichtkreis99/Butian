import { Body } from "astronomy-engine";

import { geocentricLongitude } from "./ephemeris";

export const SOLAR_TERMS = [
  "春分", "清明", "谷雨", "立夏", "小满", "芒种",
  "夏至", "小暑", "大暑", "立秋", "处暑", "白露",
  "秋分", "寒露", "霜降", "立冬", "小雪", "大雪",
  "冬至", "小寒", "大寒", "立春", "雨水", "惊蛰",
] as const;

export function sunLongitude(date: Date): number {
  return geocentricLongitude(Body.Sun, date);
}

export function currentJieSector(longitude: number): { start: number; end: number } {
  const offset = ((longitude - 315) % 360 + 360) % 360;
  const start = (315 + Math.floor(offset / 30) * 30) % 360;
  return { start, end: (start + 30) % 360 };
}

export function equationOfTimeMinutes(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const day = Math.floor((date.getTime() - start) / 86_400_000) + 1;
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60;
  const gamma = 2 * Math.PI / 365 * (day - 1 + (hours - 12) / 24);
  return 229.18 * (
    0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) -
    0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma)
  );
}

export function apparentSolarHours(date: Date, longitude: number): number {
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3_600;
  const hours = utcHours + longitude / 15 + equationOfTimeMinutes(date) / 60;
  return ((hours % 24) + 24) % 24;
}
