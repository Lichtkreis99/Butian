import assert from "node:assert/strict";

import {
  LABEL_PRIORITY,
  compareLabelPriority,
  estimateLabelSize,
  labelAnchorVisible,
  labelCap,
  labelFitsViewport,
  labelsCollide,
  layoutLabels,
  type LabelCandidate,
  type LabelPriority,
} from "../src/lib/label-layout";

const viewport = { width: 320, height: 180 };
const candidate = (
  id: string,
  anchorX: number,
  anchorY: number,
  priority: LabelPriority = LABEL_PRIORITY.brightStar,
  order = 0,
): LabelCandidate => ({
  id,
  anchorX,
  anchorY,
  width: 30,
  height: 12,
  offsetX: 4,
  offsetY: -4,
  priority,
  order,
  valid: true,
});

assert.equal(labelCap(0), 28);
assert.equal(labelCap(1), 124);
assert.equal(labelCap(-1), 28);
assert.equal(labelCap(2), 124);
assert.ok(estimateLabelSize("角宿", 10, 3, 1).width >
  estimateLabelSize("ASC", 10, 3, 1).width);
assert.equal(labelAnchorVisible(candidate("outside", -1, 40), viewport), false);
assert.equal(labelAnchorVisible({ ...candidate("behind", 40, 40), valid: false }, viewport), false);
assert.equal(labelFitsViewport({ left: 1, top: 20, right: 30, bottom: 32 }, viewport), false);
assert.equal(labelsCollide(
  { left: 20, top: 20, right: 50, bottom: 32 },
  { left: 48, top: 18, right: 78, bottom: 30 },
), true);

const laidOut = layoutLabels([
  candidate("star", 80, 60, LABEL_PRIORITY.brightStar),
  candidate("selected", 80, 60, LABEL_PRIORITY.interactive),
  candidate("body", 140, 60, LABEL_PRIORITY.involvedBody),
  candidate("mansion", 200, 60, LABEL_PRIORITY.ringOrMansion),
  candidate("edge", 316, 60, LABEL_PRIORITY.interactive),
], viewport, 3);
assert.deepEqual(laidOut.map((item) => item.id), ["selected", "body", "mansion"]);
assert.ok(compareLabelPriority(
  candidate("selected", 0, 0, LABEL_PRIORITY.interactive),
  candidate("star", 0, 0, LABEL_PRIORITY.brightStar),
) < 0);

console.log(
  "verify-labels: PASS — priority, density cap, anchor/domain, edge and collision rules",
);
