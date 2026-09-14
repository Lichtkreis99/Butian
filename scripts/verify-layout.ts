import assert from "node:assert/strict";
import { layoutMeasurementPasses } from "../src/lib/layout-verification";

const valid = {
  container: { width: 800, height: 600 },
  canvas: { width: 800.4, height: 599.5 },
  drawingBuffer: { width: 1600, height: 1200 },
  devicePixelRatio: 2,
  cameraAspect: 4 / 3,
  labelsOutside: 0,
  offendingLabels: [],
};
assert.equal(layoutMeasurementPasses(valid), true);
assert.equal(layoutMeasurementPasses({ ...valid, labelsOutside: 1 }), false);
assert.equal(layoutMeasurementPasses({
  ...valid,
  canvas: { width: 798, height: 600 },
}), false);
assert.equal(layoutMeasurementPasses({ ...valid, cameraAspect: 1.4 }), false);
assert.equal(layoutMeasurementPasses({
  ...valid,
  drawingBuffer: { width: 1596, height: 1200 },
}), false);
console.log("verify-layout: 5 layout cases passed; visible-offender diagnostics supported");
