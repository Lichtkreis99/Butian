import assert from "node:assert/strict";

import * as portChart from "../src/lib/aizhanxing-chart/index";
import * as portZhengyu from "../src/lib/aizhanxing-zhengyu/index";
import * as portAlmuten from "../src/lib/almuten/calculations";
import * as portBazi from "../src/lib/pcbz/bazi";

const refChartPath = "../refs/aizhanxing-chart/index.ts";
const refZhengyuPath = "../refs/aizhanxing-zhengyu/index.ts";
const refAlmutenPath = "../refs/almuten/calculations.ts";
const refBaziPath = "../refs/pcbz/bazi.ts";
const refChart = await import(refChartPath) as typeof portChart;
const refZhengyu = await import(refZhengyuPath) as typeof portZhengyu;
const refAlmuten = await import(refAlmutenPath) as typeof portAlmuten;
const refBazi = await import(refBaziPath) as typeof portBazi;

interface Sample {
  date: string;
  time: string;
  latitude: number;
  longitude: number;
  zone: number;
}

let seed = 0x58555945;
function random(): number {
  seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
  return seed / 0x1_0000_0000;
}

const fixedLocations = [
  { latitude: -33.8688, longitude: 151.2093 },
  { latitude: 40.7128, longitude: -74.006 },
  { latitude: 67.2804, longitude: 14.4049 },
] as const;

const samples: Sample[] = Array.from({ length: 50 }, (_, index) => {
  const fixed = fixedLocations[index];
  const latitude = fixed?.latitude ?? random() * 150 - 75;
  const longitude = fixed?.longitude ?? random() * 360 - 180;
  const year = 1_000 + Math.floor(random() * 1_501);
  const month = 1 + Math.floor(random() * 12);
  const day = 1 + Math.floor(random() * 28);
  const hour = Math.floor(random() * 24);
  const minute = Math.floor(random() * 60);
  return {
    date: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-` +
      String(day).padStart(2, "0"),
    time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    latitude,
    longitude,
    zone: Math.max(-12, Math.min(14, Math.round(longitude / 15))),
  };
});

let numericComparisons = 0;
let textComparisons = 0;
let maximumDifference = 0;

function compare(reference: unknown, port: unknown, path: string): void {
  if (typeof reference === "number" && typeof port === "number") {
    const difference = Math.abs(reference - port);
    maximumDifference = Math.max(maximumDifference, difference);
    numericComparisons += 1;
    assert.ok(difference < 1e-6, `${path}: numeric difference ${difference}`);
    return;
  }
  if (typeof reference === "string" && typeof port === "string") {
    textComparisons += 1;
    assert.equal(port, reference, `${path}: text differs`);
    return;
  }
  if (reference instanceof Date && port instanceof Date) {
    assert.equal(port.getTime(), reference.getTime(), `${path}: date differs`);
    return;
  }
  if (Array.isArray(reference) && Array.isArray(port)) {
    assert.equal(port.length, reference.length, `${path}: array length differs`);
    reference.forEach((value, index) => compare(value, port[index], `${path}[${index}]`));
    return;
  }
  if (reference && port && typeof reference === "object" && typeof port === "object") {
    const referenceRecord = reference as Record<string, unknown>;
    const portRecord = port as Record<string, unknown>;
    assert.deepEqual(Object.keys(portRecord), Object.keys(referenceRecord), `${path}: keys differ`);
    for (const key of Object.keys(referenceRecord)) {
      compare(referenceRecord[key], portRecord[key], `${path}.${key}`);
    }
    return;
  }
  assert.equal(port, reference, `${path}: value differs`);
}

for (const [index, sample] of samples.entries()) {
  const modernInput: portChart.NatalChartInput = {
    date: sample.date,
    time: sample.time,
    latitude: sample.latitude,
    longitude: sample.longitude,
    timeZone: sample.zone,
    summer: 0,
    houseSystem: index % 2 ? "P" : "W",
  };
  compare(
    refChart.calculateNatalChart(modernInput),
    portChart.calculateNatalChart(modernInput),
    `chart[${index}]`,
  );

  const zhengyuInput: portZhengyu.ZhengyuRequest = {
    transit_date: sample.date,
    transit_time: sample.time,
    transit_zone: -sample.zone,
    transit_lat: sample.latitude,
    transit_lng: sample.longitude,
    next_day_zi_shi: false,
    jieqi_type: 0,
    is_delta: false,
    is_mean: false,
    calc_type: 0,
    xingxiu_fixed_star_type: 0,
    rise_set_type: 0,
    ming_type: 0,
    ming_zhi: 0,
    shen_type: 0,
    day_night_type: 0,
    child_limit_type: 0,
    node_true: false,
    lilith_true: false,
    node_type: 0,
    ziqi_type: 0,
    has_arabic: false,
    big_limit_calc_type: 0,
    small_limit_calc_type: 0,
    month_limit_calc_type: 0,
    ge_ju_display_mode: "none",
    hsys: index % 2 ? "P" : "W",
    ayanamsa: 0,
    lat: sample.latitude,
    lng: sample.longitude,
    date: sample.date,
    time: sample.time,
    summer: 0,
    birth_zone: -sample.zone,
    sex: index % 2 ? 1 : 0,
  };
  compare(
    refZhengyu.calculateZhengyu(zhengyuInput),
    portZhengyu.calculateZhengyu(zhengyuInput),
    `zhengyu[${index}]`,
  );

  const longitudeDegrees = Math.floor(Math.abs(sample.longitude));
  const latitudeDegrees = Math.floor(Math.abs(sample.latitude));
  const classicalInput: portAlmuten.ChartInput = {
    name: "parity",
    month: Number(sample.date.slice(5, 7)),
    day: Number(sample.date.slice(8, 10)),
    year: Number(sample.date.slice(0, 4)),
    hour: Number(sample.time.slice(0, 2)),
    minute: Number(sample.time.slice(3, 5)),
    location: "seeded",
    longitudeDegrees,
    longitudeDirection: sample.longitude < 0 ? "W" : "E",
    longitudeMinutes: (Math.abs(sample.longitude) - longitudeDegrees) * 60,
    latitudeDegrees,
    latitudeDirection: sample.latitude < 0 ? "S" : "N",
    latitudeMinutes: (Math.abs(sample.latitude) - latitudeDegrees) * 60,
    timezoneOffset: sample.zone * 60,
    houseSystem: index % 2 ? "P" : "W",
  };
  compare(
    refAlmuten.calculateChart(classicalInput),
    portAlmuten.calculateChart(classicalInput),
    `almuten[${index}]`,
  );

  const baziInput: portBazi.BirthInput = {
    name: "parity",
    gender: index % 2 ? "male" : "female",
    calendar: "solar",
    date: sample.date,
    time: sample.time,
    leapMonth: false,
    place: "seeded",
    trueSolar: true,
    longitude: sample.longitude,
    latitude: sample.latitude,
  };
  compare(
    refBazi.calculateBazi(baziInput),
    portBazi.calculateBazi(baziInput),
    `bazi[${index}]`,
  );
}

const regression = portBazi.calculateBazi({
  name: "回归",
  gender: "male",
  calendar: "solar",
  date: "1990-05-15",
  time: "08:00",
  leapMonth: false,
  place: "北京",
  trueSolar: true,
  longitude: 116.41,
  latitude: 39.93,
});
assert.equal(regression.pillars.map((pillar) => pillar.pillar).join(" "),
  "庚午 辛巳 庚辰 庚辰");

console.log(
  `verify-engines: PASS — 50 seeded cases × 4 engines; ${numericComparisons} numeric + ` +
    `${textComparisons} text comparisons; max Δ ${maximumDifference.toExponential(1)}; ` +
    "bazi regression passed",
);
