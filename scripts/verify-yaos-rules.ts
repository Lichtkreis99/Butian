import assert from "node:assert/strict";

import { calculateZhengyuFor } from "../src/lib/zhengyu";
import { sexagenaryName, zhengyuYaoRuleRows } from "../src/lib/zhengyu-yaos";

const chart = calculateZhengyuFor({
  date: new Date("2000-03-01T08:03:00Z"),
  timeZone: "Asia/Shanghai",
  location: { latitude: 39.9316, longitude: 116.41 },
  gender: "male",
});
const rows = zhengyuYaoRuleRows(chart);
assert.equal(rows.length, chart.yaos1.length + chart.yaos2.length);
assert.equal(sexagenaryName(0), "甲子");
assert.equal(sexagenaryName(16), "庚辰");

for (const row of rows) {
  assert.ok(row.rule.includes(row.name));
  assert.ok(row.rule.includes(row.planetName));
  assert.ok(row.rule.startsWith("以"));
  assert.equal(row.source, "本地七政引擎 makeYaos 查表");
}

const natal = rows.filter((row) => row.scope === "本命");
assert.ok(natal[0]!.rule.includes(sexagenaryName(chart.bazi_data.sizhu.year_zhu.ganzhi)));
assert.ok(natal[31]!.rule.includes(sexagenaryName(chart.bazi_data.sizhu.day_zhu.ganzhi)));
assert.ok(natal[41]!.rule.includes("命宫首宫查"));

console.log(
  `verify-yaos-rules: PASS — ${rows.length} 本命/流年 rows match year, day and ` +
    "first-palace lookup selectors",
);
