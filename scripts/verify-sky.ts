import assert from "node:assert/strict";
import fs from "node:fs";

import {
  bortleLimitingMagnitude,
  deepSkyBrightness,
  extinctionMagnitude,
  fovLimitingMagnitude,
  fovLabelCap,
  inertiaAfterFrames,
  interpolateLogFov,
  milkyWayBrightness,
  saemundssonRefraction,
  starLabelMagnitude,
} from "../src/lib/sky-appearance";
import { searchSkyEntries } from "../src/lib/sky-search";
import { decodeStellariumDsoEph } from "./lib/stellarium-dso";

assert.ok(Math.abs(bortleLimitingMagnitude(1) - 7.6) < 1e-12);
assert.ok(Math.abs(bortleLimitingMagnitude(9) - 4) < 1e-12);
assert.ok(fovLimitingMagnitude(180, 1) < fovLimitingMagnitude(10, 1));
assert.ok(starLabelMagnitude(180, 0.5) < starLabelMagnitude(10, 0.5));
assert.equal(fovLabelCap(81, 180), 25);
assert.ok(fovLabelCap(81, 10) > fovLabelCap(81, 90));
assert.ok(extinctionMagnitude(60) < extinctionMagnitude(20));
assert.ok(extinctionMagnitude(20) < extinctionMagnitude(5));
assert.ok(saemundssonRefraction(0) > saemundssonRefraction(20));
assert.ok(inertiaAfterFrames(1, 60) < 0.01);
const zoom = Array.from({ length: 11 }, (_, index) => interpolateLogFov(120, 20, index / 10));
assert.ok(zoom.every((value, index) => index === 0 || value < zoom[index - 1]!));
assert.ok(Math.abs(zoom.at(-1)! - 20) < 1e-12);
assert.ok(milkyWayBrightness({ bortle: 1, fov: 60, sunAltitude: -30,
  moonAltitude: -20, atmosphere: true }) > 0);
assert.equal(milkyWayBrightness({ bortle: 9, fov: 60, sunAltitude: 30,
  moonAltitude: -20, atmosphere: true }), 0);
assert.equal(deepSkyBrightness(30, -20, true), 0);
assert.equal(deepSkyBrightness(30, -20, false), 1);
const entries = [
  { kind: "star" as const, id: 27989, label: "参宿四",
    aliases: ["Betelgeuse", "HIP 27989", "猎户座 α", "alf Ori"] },
  { kind: "dso" as const, id: "M 42", label: "猎户座大星云",
    aliases: ["M42", "M 42"] },
  { kind: "body" as const, id: "Mars", label: "火星", aliases: ["Mars"] },
  { kind: "asterism" as const, id: "ORI", label: "参宿", aliases: ["Shen"] },
];
for (const query of [
  "参宿四", "Betelgeuse", "HIP 27989", "猎户座 α", "火星", "M42", "参宿",
]) {
  assert.ok(searchSkyEntries(entries, query)[0], `search failed: ${query}`);
}
const dso = fs.readFileSync("data-src/stellarium-dso/Norder0/Dir0/Npix5.eph");
const decoded = decodeStellariumDsoEph(dso);
const m42 = decoded.find((item) => item.ids.includes("M 42"));
assert.ok(m42);
assert.ok(Math.abs(m42.ra * 180 / Math.PI - 83.82208) < 1e-4);
assert.ok(Math.abs(m42.dec * 180 / Math.PI + 5.39111) < 1e-4);
assert.equal(fs.readdirSync("data-src/stellarium-milkyway/Norder0/Dir0")
  .filter((file) => file.endsWith(".webp")).length, 12);
console.log(
  "verify-sky: PASS — Bortle/FOV limits, extinction/refraction, inertia, zoom, " +
    "multilingual search, 12 Milky Way tiles and decoded M42",
);
