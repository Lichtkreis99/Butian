import assert from "node:assert/strict";

import { BODY_DEFINITIONS } from "../src/lib/ephemeris";
import {
  BODY_NAME_TABLE,
  modernStarName,
  resolveNameStyle,
  starName,
} from "../src/lib/names";

for (const definition of BODY_DEFINITIONS) {
  const names = BODY_NAME_TABLE[definition.id];
  assert.ok(names.modernZh && names.ancientZh && names.english, definition.id);
}
assert.equal(resolveNameStyle("auto", "zhengyu"), "ancient-zh");
assert.equal(resolveNameStyle("auto", "astrology"), "modern-zh");
assert.equal(modernStarName("alf Ori"), "猎户座 α");
assert.equal(starName(
  27989,
  "modern-zh",
  "alf Ori",
  { asterisms: [], commonNames: { "27989": { nameZh: "参宿四", nameEn: "" } },
    unavailableHips: [] },
  "Betelgeuse",
), "猎户座 α");

console.log(
  `verify-names: PASS — ${BODY_DEFINITIONS.length} bodies × 3 styles; ` +
  "auto 七政=古代/星盘=当代; HIP 27989=猎户座 α",
);
