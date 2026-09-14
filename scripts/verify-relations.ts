import assert from "node:assert/strict";

import { calculateBazi } from "../src/lib/pcbz/bazi";
import {
  computeRelations,
  describeShenShaRule,
  shenShaBasisIndices,
} from "../src/lib/pcbz/fortune";
import { layoutRelations, relationType } from "../src/lib/bazi-relations";

const referenceBaziPath = "../refs/pcbz/bazi.ts";
const referenceFortunePath = "../refs/pcbz/fortune.ts";
const referenceBazi = await import(referenceBaziPath) as { calculateBazi: typeof calculateBazi };
const referenceFortune = await import(referenceFortunePath) as {
  computeRelations: typeof computeRelations;
};

const input = {
  name: "回归",
  gender: "male" as const,
  calendar: "solar" as const,
  date: "1990-05-15",
  time: "08:00",
  leapMonth: false,
  place: "北京",
  trueSolar: true,
  longitude: 116.41,
  latitude: 39.93,
};
const chart = calculateBazi(input);
const reference = referenceBazi.calculateBazi(input);
const relations = computeRelations(chart.pillars);
assert.deepEqual(relations, referenceFortune.computeRelations(reference.pillars));
assert.equal(chart.pillars.map((pillar) => pillar.pillar).join(" "),
  "庚午 辛巳 庚辰 庚辰");
assert.equal(relations.heaven, "无合冲关系");
assert.equal(relations.earth, "辰辰相刑");
assert.equal(relationType("申子辰三合水局"), "combine");
assert.equal(relationType("寅卯辰三会木局"), "meeting");
assert.equal(relationType("辰辰相刑"), "punish");

const layout = layoutRelations(chart.pillars, relations.connections);
assert.ok(layout.rows.every((row) =>
  [row.y, row.left, row.right].every(Number.isFinite)));
assert.ok(layout.rows.every((row) => row.left <= row.right));
for (const pillar of chart.pillars) {
  for (const name of pillar.shenSha) {
    const rule = describeShenShaRule(chart.pillars, pillar, chart.input.gender, name);
    assert.ok(rule.includes("查") && (rule.includes(pillar.zhi) ||
      rule.includes(pillar.gan) || rule.includes(pillar.pillar)),
      `${pillar.title} ${name} lacks a concrete rule`);
  }
}
const dayRule = describeShenShaRule(
  chart.pillars,
  chart.pillars[2]!,
  chart.input.gender,
  "国印贵人",
);
assert.ok(dayRule.includes("以日干查：庚见辰"));
assert.deepEqual(shenShaBasisIndices("国印贵人", 3), [2, 3]);
assert.deepEqual(shenShaBasisIndices("华盖", 1), [0, 1, 2]);

console.log(
  `verify-relations: PASS — 1990-05-15 08:00 local/ref match; ` +
    `${relations.connections.length} connections; ${chart.pillars
      .reduce((count, pillar) => count + pillar.shenSha.length, 0)} rule explanations`,
);
