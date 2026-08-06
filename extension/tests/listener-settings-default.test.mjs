import test from "node:test";
import assert from "node:assert/strict";

import { runBackgroundScenario } from "./helpers/background-runtime-harness.mjs";

test("Bilibili-to-local listener defaults on while preserving an explicit opt-out", () => {
  const payload = runBackgroundScenario({
    exports: ["defaultBidirectionalSyncMeta", "normalizeBiliToLocalEnabled"],
    scenarioSource: `
      return {
        defaults: defaultBidirectionalSyncMeta(),
        missing: normalizeBiliToLocalEnabled(undefined),
        enabled: normalizeBiliToLocalEnabled(true),
        disabled: normalizeBiliToLocalEnabled(false),
      };
    `,
  });

  assert.equal(payload.result.defaults.biliToLocalEnabled, true);
  assert.equal(payload.result.defaults.localToBiliEnabled, false);
  assert.equal(payload.result.missing, true);
  assert.equal(payload.result.enabled, true);
  assert.equal(payload.result.disabled, false);
});
