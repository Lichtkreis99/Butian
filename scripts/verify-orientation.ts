import assert from "node:assert/strict";

import {
  CHART_POLAR_EPSILON,
  chartCameraPose,
  screenAngleFromChartPose,
  westernChartAngle,
  zhengyuChartAngle,
} from "../src/lib/chart-orientation";

const cases = [
  [12.5, 12.5], [47.2, 199.4], [123.75, 302.1], [271.3, 5.6], [359.9, 180.2],
] as const;
let maximum = 0;
for (const [ascendant, longitude] of cases) {
  const chart = westernChartAngle(longitude, ascendant);
  const pose = chartCameraPose(ascendant, 180, "north", 1);
  const screen = screenAngleFromChartPose(longitude, pose);
  const difference = Math.abs(((screen - chart + 540) % 360) - 180);
  maximum = Math.max(maximum, difference);
  assert.ok(difference < 0.5);
}

for (const longitude of cases.map((value) => value[1])) {
  const pose = chartCameraPose(0, 270, "south", 1);
  const screen = screenAngleFromChartPose(longitude, pose);
  const difference = Math.abs(((screen - zhengyuChartAngle(longitude) + 540) % 360) - 180);
  maximum = Math.max(maximum, difference);
  assert.ok(difference < 0.5);
  assert.ok(Math.abs(pose.polar - (Math.PI - CHART_POLAR_EPSILON)) < 1e-12);
}

console.log(
  `verify-orientation: PASS — ${cases.length * 2} actual camera-pose cases; ` +
  `polar ε ${CHART_POLAR_EPSILON}; max screen/SVG Δ ${maximum.toFixed(6)}°`,
);
