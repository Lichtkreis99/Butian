import assert from "node:assert/strict";

import { WesternChart } from "../src/ui/charts/western-chart";
import { ZhengyuChart } from "../src/ui/charts/zhengyu-chart";

const context = {
  date: new Date("1990-05-15T00:00:00Z"),
  timeZone: "UTC",
  location: { latitude: 39.9316, longitude: 116.41 },
  gender: "male" as const,
};
const options = { textMode: "symbol" as const, nameStyle: "auto" as const };
const western = new WesternChart().render(context, options);
const zhengyu = new ZhengyuChart().render(context, options);
const prohibited = /[\u2600-\u27BF\uFE0F]|[\u{1F300}-\u{1FAFF}]/u;
assert.equal(prohibited.test(western), false, "western chart contains a symbol code point");
assert.equal(prohibited.test(zhengyu), false, "zhengyu chart contains a symbol code point");
assert.match(western, /class="path-glyph"/);
assert.match(zhengyu, /class="path-glyph"/);
console.log("verify-glyphs: PASS — western and zhengyu output uses SVG paths; 0 emoji symbols");
