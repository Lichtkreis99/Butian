import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  equatorialToEclipticJ2000,
  gaiaPositionToEclipticParsecs,
  gaiaVelocityToEclipticParsecsPerYear,
} from "../src/lib/coordinates";
import { decodeGaiaCatalog, type GaiaRecord } from "./lib/gaia";
import { RECOVERED_STELLARIUM_STARS } from "./lib/stellarium-recovered";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = resolve(
  projectRoot,
  "data-src/gaia-dr3-best/particles_000000.bin",
);
const skyculturePath = resolve(
  projectRoot,
  "data-src/skycultures/chinese/index.json",
);
const outputDirectory = resolve(projectRoot, "public/data");
const STAR_STRIDE = 40;
const MAGNITUDE_LIMIT = 8.5;

interface StellariumAsterism {
  id: string;
  lines?: number[][];
  common_name?: {
    english?: string;
    native?: string;
    pronounce?: string;
  };
}

interface StellariumSkyculture {
  constellations: StellariumAsterism[];
  common_names: Record<
    string,
    Array<{ english?: string; native?: string; pronounce?: string }>
  >;
}

function colorIndex(packed: number): number {
  const red = packed & 0xff;
  const blue = (packed >>> 16) & 0xff;
  return (red - blue) / 255;
}

function displayName(record: GaiaRecord): string | undefined {
  const first = record.name.split("|")[0]?.trim();
  if (!first || first === `HIP ${record.hip}`) return undefined;
  return first;
}

function romanToInteger(value: string): number | undefined {
  if (!/^[IVXLCDM]+$/.test(value)) return undefined;
  const values: Record<string, number> = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1_000,
  };
  let total = 0;
  let previous = 0;
  for (const character of [...value].reverse()) {
    const current = values[character]!;
    total += current < previous ? -current : current;
    previous = current;
  }
  return total;
}

function chineseInteger(value: number): string {
  const digits = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  if (value < 10) return digits[value]!;
  if (value < 20) return `十${value === 10 ? "" : digits[value - 10]}`;
  if (value < 100) {
    const units = value % 10;
    return `${digits[Math.floor(value / 10)]}十${units ? digits[units] : ""}`;
  }
  return String(value);
}

function wrapBase64(value: string): string {
  const chunks = value.match(/.{1,88}/g) ?? [];
  return chunks.map((chunk) => `    "${chunk}",`).join("\n");
}

function classicDataScript(globalName: string, metadata: object, bytes: Buffer): string {
  const json = JSON.stringify(metadata, null, 2).replace(/\n}/, ",\n");
  return [
    `window.${globalName} = ${json}`,
    "  base64: [",
    wrapBase64(bytes.toString("base64")),
    "  ].join(\"\"),",
    "};",
    "",
  ].join("\n");
}

const catalog = decodeGaiaCatalog(catalogPath);
if (catalog.endOffset !== catalog.byteLength) {
  throw new Error(
    `Decoded ${catalog.endOffset} bytes, expected ${catalog.byteLength}.`,
  );
}

const selected = catalog.records.filter(
  (record) => record.hip !== 0 || record.apparentMagnitude <= MAGNITUDE_LIMIT,
);
const starBytes = Buffer.allocUnsafe(
  (selected.length + RECOVERED_STELLARIUM_STARS.length) * STAR_STRIDE,
);
const names: Record<string, string> = {};
const bayerNames: Record<string, string> = {};
const availableHips = new Set<number>();

selected.forEach((record, index) => {
  const position = gaiaPositionToEclipticParsecs({
    x: record.position[0],
    y: record.position[1],
    z: record.position[2],
  });
  const velocity = gaiaVelocityToEclipticParsecsPerYear({
    x: record.velocity[0],
    y: record.velocity[1],
    z: record.velocity[2],
  });
  const offset = index * STAR_STRIDE;
  const values = [
    position.x,
    position.y,
    position.z,
    velocity.x,
    velocity.y,
    velocity.z,
    record.apparentMagnitude,
    colorIndex(record.packedColor),
  ];
  values.forEach((value, valueIndex) => {
    starBytes.writeFloatLE(value, offset + valueIndex * 4);
  });
  starBytes.writeInt32LE(record.hip, offset + 32);
  starBytes.writeFloatLE(0, offset + 36);
  if (record.hip) {
    availableHips.add(record.hip);
    const name = displayName(record);
    if (name) names[String(record.hip)] = name;
    const bayer = record.name.split("|").map((part) => part.trim())
      .find((part) => /^[a-z]{3} [A-Z][a-zA-Z]{2}$/.test(part));
    if (bayer) bayerNames[String(record.hip)] = bayer;
  }
});

for (const [recoveredIndex, record] of RECOVERED_STELLARIUM_STARS.entries()) {
  const ra = record.ra * Math.PI / 180;
  const dec = record.dec * Math.PI / 180;
  const distance = record.parallaxMas > 0 ? 1_000 / record.parallaxMas : 1_000;
  const equatorial = {
    x: distance * Math.cos(dec) * Math.cos(ra),
    y: distance * Math.cos(dec) * Math.sin(ra),
    z: distance * Math.sin(dec),
  };
  const position = equatorialToEclipticJ2000(equatorial);
  const offset = (selected.length + recoveredIndex) * STAR_STRIDE;
  const values = [
    position.x,
    position.y,
    position.z,
    0,
    0,
    0,
    record.magnitude,
    record.colorIndex,
  ];
  values.forEach((value, valueIndex) => {
    starBytes.writeFloatLE(value, offset + valueIndex * 4);
  });
  starBytes.writeInt32LE(record.hip, offset + 32);
  starBytes.writeFloatLE(record.parallaxMas > 0 ? 1 : 2, offset + 36);
  availableHips.add(record.hip);
}

const skyculture = JSON.parse(
  readFileSync(skyculturePath, "utf8"),
) as StellariumSkyculture;
const sourceLineHips = new Set<number>();
for (const asterism of skyculture.constellations) {
  for (const line of asterism.lines ?? []) {
    for (const hip of line) sourceLineHips.add(hip);
  }
}
const unavailableHips = [...sourceLineHips]
  .filter((hip) => !availableHips.has(hip))
  .sort((first, second) => first - second);

const asterisms = skyculture.constellations.map((asterism) => ({
  id: asterism.id,
  nameZh: asterism.common_name?.native ?? asterism.common_name?.english ?? asterism.id,
  nameEn: asterism.common_name?.english ?? "",
  lines: asterism.lines ?? [],
}));

const asterismTranslations = asterisms
  .filter((asterism) => asterism.nameEn && asterism.nameZh !== asterism.nameEn)
  .map((asterism) => ({ english: asterism.nameEn, chinese: asterism.nameZh }))
  .sort((first, second) => second.english.length - first.english.length);

function chineseSkycultureName(
  entries: Array<{ english?: string; native?: string }>,
): string {
  const explicit = entries.find((entry) => entry.native)?.native;
  if (explicit) return explicit;
  for (const entry of entries) {
    if (!entry.english) continue;
    for (const translation of asterismTranslations) {
      if (entry.english === translation.english) return translation.chinese;
      if (!entry.english.startsWith(`${translation.english} `)) continue;
      const suffix = entry.english.slice(translation.english.length + 1);
      const ordinal = romanToInteger(suffix);
      if (ordinal !== undefined) return `${translation.chinese}${chineseInteger(ordinal)}`;
    }
  }
  return "";
}

const commonNames: Record<string, { nameZh: string; nameEn: string }> = {};
for (const [key, entries] of Object.entries(skyculture.common_names)) {
  const match = /^HIP (\d+)$/.exec(key);
  if (!match) continue;
  const hip = Number(match[1]);
  if (!availableHips.has(hip)) continue;
  const chinese = chineseSkycultureName(entries);
  const english = entries[0]?.english ?? "";
  if (chinese || english) commonNames[String(hip)] = { nameZh: chinese, nameEn: english };
}

const skycultureOutput = Buffer.from(
  JSON.stringify({ asterisms, commonNames, unavailableHips }),
  "utf8",
);
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(
  resolve(outputDirectory, "stars.js"),
  classicDataScript(
    "__XUANYE_STARS__",
    {
      version: 1,
      count: selected.length + RECOVERED_STELLARIUM_STARS.length,
      sourceCount: catalog.header.count,
      stride: STAR_STRIDE,
      epoch: 2016,
      frame: "heliocentric J2000 mean ecliptic",
      units: { position: "pc", velocity: "pc/year" },
      fields: [
        "x", "y", "z", "vx", "vy", "vz", "magnitude", "color", "hip",
        "distanceSource",
      ],
      names,
      bayerNames,
    },
    starBytes,
  ),
);
writeFileSync(
  resolve(outputDirectory, "skyculture-chinese.js"),
  classicDataScript(
    "__XUANYE_SKYCULTURE_CHINESE__",
    { version: 1, encoding: "base64-json-utf8" },
    skycultureOutput,
  ),
);

console.log(
  `build-stars: ${catalog.header.count} decoded, ` +
    `${selected.length + RECOVERED_STELLARIUM_STARS.length} selected, ` +
    `${availableHips.size} HIP stars`,
);
console.log(
  `build-stars: ${sourceLineHips.size - unavailableHips.length} skyculture HIP stars retained, ` +
    `${unavailableHips.length} absent from source catalog`,
);
