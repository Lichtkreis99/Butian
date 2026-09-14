import type { BaziChart, BirthInput, PillarDetail } from "./bazi";
import { normalizeBirthInput } from "./bazi";
import { computeRelations } from "./fortune";

export const HEPAN_STORAGE_KEY = "pcbz-hepan-records:v1";

export interface HepanInputs {
  person1: BirthInput;
  person2: BirthInput;
}

export interface StoredHepanRecord extends HepanInputs {
  id: string;
  createdAt: string;
  updatedAt: string;
  starred: boolean;
}

function one(values: Record<string, string | string[] | undefined>, key: string) {
  const value = values[key];
  return Array.isArray(value) ? value[0] : value;
}

function prefixedInput(
  values: Record<string, string | string[] | undefined>,
  prefix: "p1" | "p2"
) {
  const mapped: Record<string, string | undefined> = {};
  const keys = [
    "name", "gender", "calendar", "date", "time",
    "leap", "place", "trueSolar", "lng", "lat"
  ] as const;
  keys.forEach((key) => {
    mapped[key] = one(values, `${prefix}${key[0].toUpperCase()}${key.slice(1)}`);
  });
  if (!mapped.gender) mapped.gender = prefix === "p1" ? "male" : "female";
  if (!mapped.name) mapped.name = prefix === "p1" ? "案例1" : "案例2";
  return normalizeBirthInput(mapped);
}

export function normalizeHepanInputs(
  values: Record<string, string | string[] | undefined>
): HepanInputs {
  return { person1: prefixedInput(values, "p1"), person2: prefixedInput(values, "p2") };
}

function appendInput(params: URLSearchParams, prefix: "p1" | "p2", input: BirthInput) {
  const set = (key: string, value: string) => params.set(
    `${prefix}${key[0].toUpperCase()}${key.slice(1)}`,
    value
  );
  set("name", input.name);
  set("gender", input.gender);
  set("calendar", input.calendar);
  set("date", input.date);
  set("time", input.time);
  set("place", input.place);
  set("trueSolar", input.trueSolar ? "1" : "0");
  set("lng", String(input.longitude));
  set("lat", String(input.latitude));
  if (input.leapMonth) set("leap", "1");
}

export function hepanResultHref(inputs: HepanInputs, recordId?: string) {
  const params = new URLSearchParams();
  if (recordId) params.set("recordId", recordId);
  appendInput(params, "p1", inputs.person1);
  appendInput(params, "p2", inputs.person2);
  return `/hepan/result?${params.toString()}`;
}

function isBirthInput(value: unknown): value is BirthInput {
  if (!value || typeof value !== "object") return false;
  const input = value as Partial<BirthInput>;
  return typeof input.name === "string"
    && typeof input.date === "string"
    && typeof input.time === "string"
    && (input.gender === "male" || input.gender === "female")
    && (input.calendar === "solar" || input.calendar === "lunar")
    && typeof input.longitude === "number" && typeof input.latitude === "number";
}

function isHepanRecord(value: unknown): value is StoredHepanRecord {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<StoredHepanRecord>;
  return typeof item.id === "string"
    && typeof item.createdAt === "string"
    && typeof item.updatedAt === "string"
    && typeof item.starred === "boolean"
    && isBirthInput(item.person1)
    && isBirthInput(item.person2);
}

export function readHepanRecords(): StoredHepanRecord[] {
  if (typeof window === "undefined") return [];
  const stored = window.localStorage.getItem(HEPAN_STORAGE_KEY);
  if (!stored) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isHepanRecord) : [];
  } catch {
    window.localStorage.removeItem(HEPAN_STORAGE_KEY);
    return [];
  }
}

function writeHepanRecords(records: StoredHepanRecord[]) {
  window.localStorage.setItem(HEPAN_STORAGE_KEY, JSON.stringify(records));
}

function inputKey(input: BirthInput) {
  return [
    input.name,
    input.gender,
    input.calendar,
    input.date,
    input.time,
    input.leapMonth,
    input.place,
    input.trueSolar,
    input.longitude,
    input.latitude
  ].join("|");
}

export function saveHepanRecord(inputs: HepanInputs) {
  const records = readHepanRecords();
  const key = `${inputKey(inputs.person1)}::${inputKey(inputs.person2)}`;
  const existing = records.find(
    (item) => `${inputKey(item.person1)}::${inputKey(item.person2)}` === key
  );
  const now = new Date().toISOString();
  const record: StoredHepanRecord = existing ? { ...existing, ...inputs, updatedAt: now } : {
    ...inputs,
    id: typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: now,
    updatedAt: now,
    starred: false,
  };
  writeHepanRecords([record, ...records.filter((item) => item.id !== record.id)]);
  return record;
}

export function deleteHepanRecords(ids: string[]) {
  const selected = new Set(ids);
  writeHepanRecords(readHepanRecords().filter((item) => !selected.has(item.id)));
}

export function setHepanRecordStarred(id: string, starred: boolean) {
  const now = new Date().toISOString();
  const records = readHepanRecords().map((item) => item.id === id
    ? { ...item, starred, updatedAt: now }
    : item);
  writeHepanRecords(records);
  return records;
}

export function relationBetween(
  first: PillarDetail,
  second: PillarDetail,
  kind: "heaven" | "earth"
) {
  const summary = computeRelations([first, second]);
  const text = kind === "heaven" ? summary.heaven : summary.earth;
  return text === "无合冲关系" ? "/" : text;
}

function pillarHasDoubleCombine(first: PillarDetail, second: PillarDetail) {
  const summary = computeRelations([first, second]);
  return summary.connections.some((item) => item.kind === "heaven" && item.relation.includes("合"))
    && summary.connections.some((item) => item.kind === "earth" && item.relation.includes("合"));
}

export function favorableUnionNotice(first: BaziChart, second: BaziChart) {
  const year = pillarHasDoubleCombine(first.pillars[0], second.pillars[0]);
  const day = pillarHasDoubleCombine(first.pillars[2], second.pillars[2]);
  if (year && day) return "良缘提示：日柱天合地合，年柱天合地合";
  if (year) return "良缘提示：年柱天合地合";
  if (day) return "良缘提示：日柱天合地合";
  return "";
}
