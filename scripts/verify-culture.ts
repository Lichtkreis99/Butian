import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { readClassicBase64, readClassicNumber } from "./lib/generated-data";

const western = JSON.parse(
  readFileSync("data-src/skycultures/western/index.json", "utf8"),
) as { constellations: Array<{ iau: string; common_name: { english: string }; lines: number[][] }> };
const gaia = JSON.parse(readFileSync("data-src/gaia-constellations.json", "utf8")) as {
  objects: Array<{ name: string; ids?: number[][] }>;
};
const buffer = readClassicBase64("public/data/stars.js");
const stride = readClassicNumber("public/data/stars.js", "stride");
const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
const hips = new Set<number>();
for (let offset = 0; offset < buffer.byteLength; offset += stride) {
  const hip = view.getInt32(offset + 32, true);
  if (hip) hips.add(hip);
}
const requested = new Set(western.constellations.flatMap((item) => item.lines.flat()));
const missing = [...requested].filter((hip) => !hips.has(hip)).sort((a, b) => a - b);
assert.equal(missing.length, 0, `western missing HIP IDs: ${missing.join(", ")}`);

const pair = (a: number, b: number) => a < b ? `${a}-${b}` : `${b}-${a}`;
const westernPairs = new Set<string>();
for (const constellation of western.constellations) {
  for (const line of constellation.lines) {
    for (let index = 0; index + 1 < line.length; index += 1) {
      westernPairs.add(pair(line[index]!, line[index + 1]!));
    }
  }
}
const gaiaPairs = new Set(gaia.objects.flatMap((item) => item.ids ?? [])
  .map(([a, b]) => pair(a!, b!)));
const onlyWestern = [...westernPairs].filter((value) => !gaiaPairs.has(value));
const onlyGaia = [...gaiaPairs].filter((value) => !westernPairs.has(value));
console.log(
  `verify-culture: PASS — ${western.constellations.length} western constellations; ` +
  `${requested.size} HIP IDs; 0 missing`,
);
console.log(
  `verify-culture: cross-check — ${westernPairs.size} Stellarium pairs / ` +
  `${gaiaPairs.size} Gaia pairs; mismatches ${onlyWestern.length} + ${onlyGaia.length}`,
);
