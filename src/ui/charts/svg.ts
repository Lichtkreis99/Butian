export const SIGNS = [
  "白羊", "金牛", "双子", "巨蟹", "狮子", "处女",
  "天秤", "天蝎", "射手", "摩羯", "水瓶", "双鱼",
] as const;

const SIGN_PATHS = [
  "M-8 8C-10-7-2-10 0 0C2-10 10-7 8 8M0 0V11",
  "M-8-8C-7-2-3 0 0 0C3 0 7-2 8-8M-7 7A7 7 0 1 0 7 7A7 7 0 1 0-7 7",
  "M-7-9C-2-5 2-5 7-9M-7 9C-2 5 2 5 7 9M-5-6V6M5-6V6",
  "M-8-4C-4-9 2-8 2-3C2 2-4 3-8 0M8 4C4 9-2 8-2 3C-2-2 4-3 8 0",
  "M-8 7C-8-3-1-10 6-7C11-5 9 3 4 3C0 3-2 0 0-2C2-4 5-2 5 1",
  "M-9-8V8M-9-2C-5-8 0-6 0 1V8M0-1C3-7 8-5 8 1V8M5 8L8 11L11 8",
  "M-9 3H9M-6 3C-6-7 6-7 6 3M-9 8H9",
  "M-8-8V4C-8 10-1 10 1 4V-8M1 2C2 8 8 8 8 2V-3M5-3L8 0L11-3",
  "M-8 8L8-8M1-8H8V-1M-5 5L-1 9M-8 8L-4 4",
  "M-9-8C-3-4 1 1 1 8M9-8C4-7 1-2 1 8M1 1C5-2 8-2 10 1",
  "M-9-5C-6-9-2-1 1-5C4-9 7-1 10-5M-9 2C-6-2-2 6 1 2C4-2 7 6 10 2",
  "M-8-7C-4-11 1-6 0-1C-1 4-6 6-9 9M8 7C4 11-1 6 0 1C1-4 6-6 9-9",
] as const;

const BODY_PATHS: Readonly<Record<string, string>> = {
  Sun: "M0-8A8 8 0 1 0 0 8A8 8 0 1 0 0-8M0-2A2 2 0 1 0 0 2A2 2 0 1 0 0-2",
  Moon: "M4-9A9 9 0 1 0 4 9A7 9 0 0 1 4-9",
  Mercury: "M-5-9C-4-4 4-4 5-9M0-4A6 6 0 1 0 0 8A6 6 0 1 0 0-4M0 8V13M-4 11H4",
  Venus: "M0-9A7 7 0 1 0 0 5A7 7 0 1 0 0-9M0 5V13M-4 9H4",
  Mars: "M-7 7A7 7 0 1 0 0-7A7 7 0 1 0-7 7M5-5L12-12M6-12H12V-6",
  Jupiter: "M-8-4C-2-10 5-8 1 1L-3 8M-8 3H7M5-9V10",
  Saturn: "M-7-7H3M-2-11V8C4 3 8 5 5 11",
  Uranus: "M0-10V10M-8-7V4M8-7V4M-8-2H8M0 7A3 3 0 1 0 0 13A3 3 0 1 0 0 7",
  Neptune: "M0-10V10M-8-7C-6-1-3 1 0-3C3 1 6-1 8-7M-4 10H4",
  Pluto: "M0-10A5 5 0 1 0 0 0A5 5 0 1 0 0-10M-7 2A7 7 0 0 0 7 2M0 9V13M-4 11H4",
  NorthNode: "M-9 4A9 7 0 0 1 9 4M-7 4A3 3 0 1 0-1 4A3 3 0 1 0-7 4M1 4A3 3 0 1 0 7 4A3 3 0 1 0 1 4",
  SouthNode: "M-9-4A9 7 0 0 0 9-4M-7-4A3 3 0 1 1-1-4M1-4A3 3 0 1 1 7-4",
  Lilith: "M0-10A6 6 0 1 0 0 2A5 6 0 0 1 0-10M0 2V12M-4 8H4",
};

export function chartGlyph(id: string | number, x: number, y: number): string {
  const path = typeof id === "number" ? SIGN_PATHS[id] : BODY_PATHS[id];
  if (!path) return `<text x="${x}" y="${y}" class="planet-name">${id}</text>`;
  return `<g class="path-glyph" transform="translate(${x} ${y})"><path d="${path}"/></g>`;
}

export function inlineGlyph(id: string): string {
  const path = BODY_PATHS[id];
  return path ? `<svg class="inline-glyph" viewBox="-14 -14 28 28" aria-hidden="true">` +
    `<path d="${path}"/></svg>` : "";
}

export const BODY_NAMES: Readonly<Record<string, string>> = {
  Sun: "日",
  Moon: "月",
  Mercury: "水",
  Venus: "金",
  Mars: "火",
  Jupiter: "木",
  Saturn: "土",
  Uranus: "天王",
  Neptune: "海王",
  Pluto: "冥王",
  NorthNode: "罗睺",
  SouthNode: "计都",
  Lilith: "月孛",
  Ziqi: "紫气",
  Asc: "升",
  Mc: "中天",
  Des: "降",
  Ic: "天底",
};

export function polar(longitude: number, radius: number, center = 220): [number, number] {
  const angle = (longitude - 90) * Math.PI / 180;
  return [center + Math.cos(angle) * radius, center + Math.sin(angle) * radius];
}

export function spoke(longitude: number, inner: number, outer: number): string {
  const first = polar(longitude, inner);
  const second = polar(longitude, outer);
  return `<line x1="${first[0]}" y1="${first[1]}" x2="${second[0]}" ` +
    `y2="${second[1]}"/>`;
}

export function dataLink(kind: string, id: string | number): string {
  return `data-link-kind="${kind}" data-link-id="${id}" tabindex="0"`;
}

export function formatLongitude(longitude: number): string {
  const normalized = ((longitude % 360) + 360) % 360;
  const degree = normalized % 30;
  const whole = Math.floor(degree);
  const minute = Math.round((degree - whole) * 60);
  return `${whole}°${String(minute).padStart(2, "0")}′`;
}

export function localParts(date: Date, timeZone: string): {
  date: string;
  time: string;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    time: `${value("hour")}:${value("minute")}`,
  };
}
