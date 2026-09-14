import { resolve } from "node:path";

import {
  cartesianToSpherical,
  eclipticToEquatorialJ2000,
  gaiaPositionToEclipticParsecs,
} from "../src/lib/coordinates";
import { decodeGaiaCatalog, GAIA_RECORD_COUNT } from "./lib/gaia";
import { readClassicBase64, readClassicNumber } from "./lib/generated-data";

const root = resolve(import.meta.dirname, "..");
const rawPath = resolve(root, "data-src/gaia-dr3-best/particles_000000.bin");
const starsPath = resolve(root, "public/data/stars.js");
const skyculturePath = resolve(root, "public/data/skyculture-chinese.js");

const fixtures = [
  { name: "天狼", hip: 32349, ra: 101.287, dec: -16.716, minPc: 2.59, maxPc: 2.69 },
  { name: "南门二 A", hip: 71683, ra: 219.90, dec: -60.83, minPc: 1.31, maxPc: 1.37 },
  { name: "织女一", hip: 91262, ra: 279.23, dec: 38.78, minPc: 7.58, maxPc: 7.78 },
  { name: "北极星", hip: 11767, ra: 37.95, dec: 89.26, minPc: 80, maxPc: 140 },
  { name: "参宿四", hip: 27989, ra: 88.79, dec: 7.41, minPc: 100, maxPc: 250 },
] as const;

function angularDifference(first: number, second: number): number {
  return Math.abs(((first - second + 540) % 360) - 180);
}

const catalog = decodeGaiaCatalog(rawPath);
if (catalog.header.count !== GAIA_RECORD_COUNT || catalog.records.length !== GAIA_RECORD_COUNT) {
  throw new Error(`Expected ${GAIA_RECORD_COUNT} Gaia records, got ${catalog.records.length}.`);
}
if (catalog.endOffset !== catalog.byteLength) {
  throw new Error(`Decoder ended at ${catalog.endOffset}; file has ${catalog.byteLength} bytes.`);
}

const recordsByHip = new Map(
  catalog.records.filter((record) => record.hip).map((record) => [record.hip, record]),
);
for (const fixture of fixtures) {
  const record = recordsByHip.get(fixture.hip);
  if (!record) throw new Error(`${fixture.name} HIP ${fixture.hip} was not decoded.`);
  const ecliptic = gaiaPositionToEclipticParsecs({
    x: record.position[0],
    y: record.position[1],
    z: record.position[2],
  });
  const equatorial = cartesianToSpherical(eclipticToEquatorialJ2000(ecliptic));
  if (angularDifference(equatorial.longitude, fixture.ra) > 0.05) {
    throw new Error(`${fixture.name} right ascension ${equatorial.longitude} is outside tolerance.`);
  }
  if (Math.abs(equatorial.latitude - fixture.dec) > 0.05) {
    throw new Error(`${fixture.name} declination ${equatorial.latitude} is outside tolerance.`);
  }
  if (equatorial.radius < fixture.minPc || equatorial.radius > fixture.maxPc) {
    throw new Error(`${fixture.name} distance ${equatorial.radius} pc is outside tolerance.`);
  }
}

const starBytes = readClassicBase64(starsPath);
const outputCount = readClassicNumber(starsPath, "count");
const stride = readClassicNumber(starsPath, "stride");
if (starBytes.byteLength !== outputCount * stride) {
  throw new Error("Generated star byte length does not match count × stride.");
}
const outputHips = new Set<number>();
let stellariumParallaxCount = 0;
let unknownDistanceCount = 0;
for (let offset = 0; offset < starBytes.byteLength; offset += stride) {
  const hip = starBytes.readInt32LE(offset + 32);
  if (hip) outputHips.add(hip);
  const distanceSource = starBytes.readFloatLE(offset + 36);
  if (distanceSource === 1) stellariumParallaxCount += 1;
  if (distanceSource === 2) unknownDistanceCount += 1;
}
const skyculture = JSON.parse(readClassicBase64(skyculturePath).toString("utf8")) as {
  asterisms: Array<{ lines: number[][] }>;
};
const usedHips = new Set(skyculture.asterisms.flatMap((item) => item.lines.flat()));
const missing = [...usedHips].filter((hip) => !outputHips.has(hip));
if (missing.length) throw new Error(`Generated skyculture has ${missing.length} missing HIP stars.`);

console.log(
  `verify-stars: PASS — ${catalog.records.length} source records; ${outputCount} selected stars`,
);
console.log(`verify-stars: PASS — ${fixtures.length} coordinate/distance fixtures within tolerance`);
console.log(
  `verify-stars: PASS — ${usedHips.size} skyculture line HIP IDs; ${missing.length} missing`,
);
console.log(
  `verify-stars: PASS — ${stellariumParallaxCount + unknownDistanceCount} Stellarium ` +
  `recoveries; ${stellariumParallaxCount} parallax, ` +
    `${unknownDistanceCount} unknown distance`,
);
