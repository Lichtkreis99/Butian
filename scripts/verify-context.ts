import assert from "node:assert/strict";

import { CONTEXT_PROFILES, contextProfile } from "../src/lib/context-profiles";

assert.equal(CONTEXT_PROFILES.astrology.mansionRing, false);
assert.deepEqual(CONTEXT_PROFILES.bazi.involvedBodies, ["Sun", "Earth"]);
assert.equal(CONTEXT_PROFILES.observation.labelAllBodies, true);
for (const id of ["NorthNode", "SouthNode", "Lilith"]) {
  assert.ok(CONTEXT_PROFILES.zhengyu.involvedBodies.includes(id));
}
assert.ok(!contextProfile("astrology", "classical").involvedBodies.includes("Uranus"));
assert.equal(CONTEXT_PROFILES.observation.allowHideUninvolved, false);
assert.equal(CONTEXT_PROFILES.astrology.starFilter, "dim");
assert.equal(CONTEXT_PROFILES.bazi.starFilter, "dim");
assert.equal(CONTEXT_PROFILES.zhengyu.starFilter, "members-and-mansions");
assert.equal(CONTEXT_PROFILES.gaitian.starFilter, "members");

console.log(
  "verify-context: PASS — 5 profiles; hide rules dim/member/mansion and body sets passed",
);
