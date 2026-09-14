import type { BaziChart, BirthInput } from "./bazi";

export const CASE_STORAGE_KEY = "pcbz-cases:v1";

export interface StoredBaziCase {
  id: string;
  createdAt: string;
  updatedAt: string;
  starred: boolean;
  category: string;
  input: BirthInput;
  solarDate: string;
  lunarDate: string;
  zodiac: string;
  pillars: string[];
}

interface SaveCaseOptions {
  id?: string;
  name: string;
  category: string;
  starred: boolean;
}

function isStoredCase(value: unknown): value is StoredBaziCase {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StoredBaziCase>;
  return typeof candidate.id === "string"
    && typeof candidate.createdAt === "string"
    && typeof candidate.updatedAt === "string"
    && typeof candidate.starred === "boolean"
    && typeof candidate.category === "string"
    && !!candidate.input
    && typeof candidate.input.name === "string"
    && Array.isArray(candidate.pillars);
}

export function readBaziCases(): StoredBaziCase[] {
  if (typeof window === "undefined") return [];
  const stored = window.localStorage.getItem(CASE_STORAGE_KEY);
  if (!stored) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isStoredCase) : [];
  } catch {
    window.localStorage.removeItem(CASE_STORAGE_KEY);
    return [];
  }
}

function writeBaziCases(cases: StoredBaziCase[]) {
  window.localStorage.setItem(CASE_STORAGE_KEY, JSON.stringify(cases));
}

function makeCaseId() {
  return typeof window.crypto?.randomUUID === "function"
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function saveBaziCase(chart: BaziChart, options: SaveCaseOptions) {
  const cases = readBaziCases();
  const existing = options.id ? cases.find((item) => item.id === options.id) : undefined;
  const now = new Date().toISOString();
  const saved: StoredBaziCase = {
    id: existing?.id ?? makeCaseId(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    starred: options.starred,
    category: options.category.trim() || "全部",
    input: { ...chart.input, name: options.name.trim() || chart.input.name },
    solarDate: chart.solarDate,
    lunarDate: chart.lunarDate,
    zodiac: chart.zodiac,
    pillars: chart.pillars.map((pillar) => pillar.pillar),
  };
  const next = existing
    ? cases.map((item) => item.id === existing.id ? saved : item)
    : [saved, ...cases];
  writeBaziCases(next);
  return saved;
}

export function deleteBaziCase(id: string) {
  writeBaziCases(readBaziCases().filter((item) => item.id !== id));
}

export function setBaziCaseStarred(id: string, starred: boolean) {
  const now = new Date().toISOString();
  const next = readBaziCases().map((item) => item.id === id
    ? { ...item, starred, updatedAt: now }
    : item);
  writeBaziCases(next);
  return next;
}

export function baziCaseResultHref(item: StoredBaziCase) {
  const input = item.input;
  const params = new URLSearchParams({
    caseId: item.id,
    name: input.name,
    gender: input.gender,
    calendar: input.calendar,
    date: input.date,
    time: input.time,
    place: input.place,
    trueSolar: input.trueSolar ? "1" : "0",
    lng: String(input.longitude),
    lat: String(input.latitude),
  });
  if (input.leapMonth) params.set("leap", "1");
  return `/paipan/result?${params.toString()}`;
}
