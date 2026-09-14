import { regions } from "./regions";

export interface PlaceResult {
  label: string;
  longitude: number;
  latitude: number;
  timeZone: string;
}

const places: PlaceResult[] = regions.flatMap((province) =>
  province.cities.flatMap((city) =>
    city.districts.map((district) => ({
      label: `${province.name} · ${city.name} · ${district.name}`,
      longitude: district.lng,
      latitude: district.lat,
      timeZone: "Asia/Shanghai",
    })),
  ),
);

export function searchPlaces(query: string, limit = 8): PlaceResult[] {
  const normalized = query.trim().toLocaleLowerCase("zh-CN");
  if (!normalized) return [];
  const terms = normalized.split(/\s+/);
  const starts: PlaceResult[] = [];
  const contains: PlaceResult[] = [];
  for (const place of places) {
    const label = place.label.toLocaleLowerCase("zh-CN");
    if (!terms.every((term) => label.includes(term))) continue;
    if (label.startsWith(normalized) || label.includes(`· ${normalized}`)) starts.push(place);
    else contains.push(place);
    if (starts.length + contains.length >= limit * 4) break;
  }
  return [...starts, ...contains].slice(0, limit);
}

export const DEFAULT_PLACE: PlaceResult = {
  label: "北京市 · 北京市 · 东城区",
  longitude: 116.41,
  latitude: 39.9316,
  timeZone: "Asia/Shanghai",
};
