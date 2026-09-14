import { Body } from "astronomy-engine";

import { geocentricLongitude } from "../src/lib/ephemeris";

interface ReferencePlanet {
  name: string;
  longitude: number;
}

interface ReferenceChart {
  planets: ReferencePlanet[];
}

type ReferenceCalculator = (input: {
  date: string;
  time: string;
  latitude: number;
  longitude: number;
  timeZone: number;
  summer: 0 | 1;
}) => ReferenceChart;

// A computed URL keeps the read-only reference engine outside the app typecheck while tsx
// still imports and executes that exact source module for parity verification.
const referenceUrl = new URL("../refs/aizhanxing-chart/index.ts", import.meta.url).href;
const referenceModule = await import(referenceUrl) as {
  calculateNatalChart: ReferenceCalculator;
};
const { calculateNatalChart } = referenceModule;

const dates = [
  new Date("1900-01-01T00:00:00.000Z"),
  new Date("1957-10-04T19:28:00.000Z"),
  new Date("2000-01-01T12:00:00.000Z"),
  new Date("2024-04-08T18:18:00.000Z"),
  new Date("2149-07-21T06:45:00.000Z"),
];

const bodies = new Map([
  ["Sun", Body.Sun],
  ["Moon", Body.Moon],
  ["Mercury", Body.Mercury],
  ["Venus", Body.Venus],
  ["Mars", Body.Mars],
  ["Jupiter", Body.Jupiter],
  ["Saturn", Body.Saturn],
  ["Uranus", Body.Uranus],
  ["Neptune", Body.Neptune],
  ["Pluto", Body.Pluto],
] as const);

function difference(first: number, second: number): number {
  return Math.abs(((first - second + 540) % 360) - 180);
}

let maximumDifference = 0;
let comparisons = 0;
for (const date of dates) {
  const chart = calculateNatalChart({
    date: date.toISOString().slice(0, 10),
    time: date.toISOString().slice(11, 16),
    latitude: 0,
    longitude: 0,
    timeZone: 0,
    summer: 0,
  });
  for (const [name, body] of bodies) {
    const reference = chart.planets.find((planet) => planet.name === name);
    if (!reference) throw new Error(`Reference chart omitted ${name}.`);
    const delta = difference(geocentricLongitude(body, date), reference.longitude);
    maximumDifference = Math.max(maximumDifference, delta);
    comparisons += 1;
    if (delta >= 0.01) {
      throw new Error(`${name} differs by ${delta}° at ${date.toISOString()}.`);
    }
  }
}

console.log(
  `verify-ephemeris: PASS — ${dates.length} dates × ${bodies.size} bodies; ` +
    `max Δ ${maximumDifference.toFixed(9)}° (${comparisons} comparisons)`,
);
