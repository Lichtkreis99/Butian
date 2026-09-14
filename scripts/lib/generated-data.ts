import { readFileSync } from "node:fs";

export function readClassicBase64(path: string): Buffer {
  const source = readFileSync(path, "utf8");
  const section = /base64:\s*\[([\s\S]*?)\]\s*\.join\(""\)/.exec(source)?.[1];
  if (!section) throw new Error(`No base64 array found in ${path}`);
  const chunks = [...section.matchAll(/"([A-Za-z0-9+/=]+)"/g)].map((match) => match[1]);
  return Buffer.from(chunks.join(""), "base64");
}

export function readClassicNumber(path: string, key: string): number {
  const source = readFileSync(path, "utf8");
  const value = new RegExp(`"${key}":\\s*(\\d+)`).exec(source)?.[1];
  if (!value) throw new Error(`No numeric ${key} found in ${path}`);
  return Number(value);
}
