import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { calculateZhengyu, type ZhengyuRequest } from
  "../src/lib/aizhanxing-zhengyu";
import { evaluateGeju, gejuImplementationCount } from
  "../src/lib/zhengyu-geju";
import { GEJU_CATALOGUE } from "../src/lib/zhengyu-geju/catalogue";
import { GEJU_QUALITY } from "../src/lib/zhengyu-geju/quality";

const SAMPLE_DIR = path.resolve("data-src/aizhanxing-zhengyu-samples");
const SHOWN_MINIMUM = { truePositive: 3, precision: 0.9, recall: 0.8 } as const;

interface SampleResponse {
  data: {
    ge_ju_items: Array<{ name: string; group: string; note: string }>;
    ge_ju_list: string[][];
  };
}

interface RequestCapture {
  body: ZhengyuRequest;
}

interface Counts {
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
}

interface SampleResult {
  file: string;
  split: "tuning" | "held-out";
  expected: Set<string>;
  actual: Set<string>;
}

function emptyCounts(): Counts {
  return { truePositive: 0, falsePositive: 0, falseNegative: 0 };
}

function precision(counts: Counts): number {
  const predicted = counts.truePositive + counts.falsePositive;
  return predicted === 0 ? 1 : counts.truePositive / predicted;
}

function recall(counts: Counts): number {
  const expected = counts.truePositive + counts.falseNegative;
  return expected === 0 ? 1 : counts.truePositive / expected;
}

function addResult(counts: Counts, expected: boolean, actual: boolean): void {
  if (expected && actual) counts.truePositive += 1;
  else if (actual) counts.falsePositive += 1;
  else if (expected) counts.falseNegative += 1;
}

function isComparable(request: ZhengyuRequest): boolean {
  return [0, 4].includes(request.calc_type) && [0, 2].includes(request.ming_type) &&
    [0, 1].includes(request.shen_type) && ["P", "W"].includes(request.hsys) &&
    request.is_mean === false && request.node_type === 0 && request.ziqi_type === 0 &&
    request.xingxiu_fixed_star_type === 0 && request.rise_set_type === 0;
}

function splitFor(file: string): "tuning" | "held-out" {
  const match = file.match(/^zy-n(\d+)/);
  return match && Number(match[1]) >= 31 ? "held-out" : "tuning";
}

function selectedCounts(results: SampleResult[], names?: Set<string>): Counts {
  const counts = emptyCounts();
  for (const result of results) {
    const allNames = new Set([...result.expected, ...result.actual]);
    for (const name of allNames) {
      if (!names || names.has(name)) {
        addResult(counts, result.expected.has(name), result.actual.has(name));
      }
    }
  }
  return counts;
}

const files = fs.readdirSync(SAMPLE_DIR)
  .filter((file) => file.endsWith(".json") && !file.endsWith(".request.json"))
  .sort();
const catalogueNames = new Set(GEJU_CATALOGUE.map((entry) => entry.name));
assert.equal(catalogueNames.size, 207, "catalogue must cover every distinct sample name");

const comparable: SampleResult[] = [];
const unsupported: string[] = [];
for (const file of files) {
  const response = JSON.parse(
    fs.readFileSync(path.join(SAMPLE_DIR, file), "utf8"),
  ) as SampleResponse;
  const requestName = file.replace(/\.json$/, ".request.json");
  const request = JSON.parse(
    fs.readFileSync(path.join(SAMPLE_DIR, requestName), "utf8"),
  ) as RequestCapture;
  for (const item of response.data.ge_ju_items) {
    const entry = GEJU_CATALOGUE.find((candidate) => candidate.name === item.name);
    assert.ok(entry, `catalogue missing ${item.name}`);
    assert.equal(entry.group, item.group, `${item.name} group changed`);
    assert.equal(entry.note, item.note, `${item.name} condition note changed`);
  }
  if (!isComparable(request.body)) {
    unsupported.push(`${file} (calc_type ${request.body.calc_type})`);
    continue;
  }
  const expected = new Set(response.data.ge_ju_list.flat());
  const actual = new Set(evaluateGeju(calculateZhengyu(request.body))
    .filter((item) => item.evidence)
    .map((item) => item.name));
  comparable.push({ file, expected, actual, split: splitFor(file) });
}

assert.equal(comparable.length, 46, "expected 46 comparable samples");
assert.equal(unsupported.length, 20, "expected 20 unsupported calculation systems");

const tuning = comparable.filter((sample) => sample.split === "tuning");
const heldOut = comparable.filter((sample) => sample.split === "held-out");
assert.equal(tuning.length, 36);
assert.equal(heldOut.length, 10);
const tuningByRule = new Map<string, Counts>();
const allByRule = new Map<string, Counts>();
for (const entry of GEJU_CATALOGUE) {
  const tuningCounts = emptyCounts();
  const allCounts = emptyCounts();
  for (const sample of comparable) {
    const expected = sample.expected.has(entry.name);
    const actual = sample.actual.has(entry.name);
    addResult(allCounts, expected, actual);
    if (sample.split === "tuning") addResult(tuningCounts, expected, actual);
  }
  tuningByRule.set(entry.name, tuningCounts);
  allByRule.set(entry.name, allCounts);
}

const shown = new Set([...tuningByRule].filter(([, counts]) =>
  counts.truePositive >= SHOWN_MINIMUM.truePositive &&
  precision(counts) >= SHOWN_MINIMUM.precision &&
  recall(counts) >= SHOWN_MINIMUM.recall).map(([name]) => name));
const implementation = gejuImplementationCount();
const storedQuality = new Map(GEJU_QUALITY.map((tuple) => [tuple[0], tuple]));
assert.equal(storedQuality.size, implementation.implemented,
  "every implemented rule must have tuning metrics");
for (const [name, counts] of tuningByRule) {
  const stored = storedQuality.get(name);
  if (!stored) continue;
  assert.deepEqual(stored.slice(1), [counts.truePositive, counts.falsePositive,
    counts.falseNegative], `${name} tuning metrics changed; regenerate quality.ts`);
}

if (process.argv.includes("--write-quality")) {
  const implemented = new Set(evaluateGeju(calculateZhengyu((JSON.parse(
    fs.readFileSync(path.join(SAMPLE_DIR, files[0]!.replace(/\.json$/,
      ".request.json")), "utf8"),
  ) as RequestCapture).body)).filter((item) => item.implemented).map((item) => item.name));
  const rows = [...tuningByRule].filter(([name]) => implemented.has(name)).map(
    ([name, counts]) => `  ["${name}", ${counts.truePositive}, ` +
      `${counts.falsePositive}, ${counts.falseNegative}],`,
  );
  const source = `export type GejuQualityTuple = readonly [\n` +
    `  name: string, truePositive: number, falsePositive: number,\n` +
    `  falseNegative: number,\n];\n\n` +
    `export const GEJU_QUALITY: readonly GejuQualityTuple[] = [\n` +
    `${rows.join("\n")}\n];\n`;
  fs.writeFileSync(path.resolve("src/lib/zhengyu-geju/quality.ts"), source);
}

for (const entry of GEJU_CATALOGUE) {
  const counts = allByRule.get(entry.name)!;
  console.log(`  rule ${entry.name}: ${counts.truePositive} TP, ` +
    `${counts.falsePositive} FP, ${counts.falseNegative} FN`);
}
for (const item of unsupported) console.log(`  不可比 ${item}: 计算制不支持`);

const allCounts = selectedCounts(comparable);
const heldOutCounts = selectedCounts(heldOut);
const shownAll = selectedCounts(comparable, shown);
const shownHeldOut = selectedCounts(heldOut, shown);
const failed = implementation.implemented - shown.size;
assert.ok(precision(shownAll) >= 0.95, "shown-rule precision is below 95%");
assert.ok(recall(shownAll) >= 0.85, "shown-rule recall is below 85%");
console.log(
  `  comparable all predicates: precision ${(precision(allCounts) * 100).toFixed(1)}%, ` +
    `recall ${(recall(allCounts) * 100).toFixed(1)}% (${allCounts.truePositive} TP, ` +
    `${allCounts.falsePositive} FP, ${allCounts.falseNegative} FN)`,
);
console.log(
  `  held-out all predicates: precision ${(precision(heldOutCounts) * 100).toFixed(1)}%, ` +
    `recall ${(recall(heldOutCounts) * 100).toFixed(1)}% ` +
    `(${heldOutCounts.truePositive} TP, ${heldOutCounts.falsePositive} FP, ` +
    `${heldOutCounts.falseNegative} FN)`,
);
console.log(
  `  held-out shown rules: precision ${(precision(shownHeldOut) * 100).toFixed(1)}%, ` +
    `recall ${(recall(shownHeldOut) * 100).toFixed(1)}% ` +
    `(${shownHeldOut.truePositive} TP, ${shownHeldOut.falsePositive} FP, ` +
    `${shownHeldOut.falseNegative} FN)`,
);
console.log(
  `verify-geju: PASS — 46 comparable (36 tuning + 10 held-out), ` +
    `20 不可比; shown ${shown.size}, 核对未过 ${failed}, ` +
    `规则待考 ${implementation.pending}; shown precision ` +
    `${(precision(shownAll) * 100).toFixed(1)}%, recall ` +
    `${(recall(shownAll) * 100).toFixed(1)}% (${shownAll.truePositive} TP, ` +
    `${shownAll.falsePositive} FP, ${shownAll.falseNegative} FN)`,
);
