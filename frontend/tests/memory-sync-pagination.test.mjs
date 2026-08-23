import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_FAVORITE_SYNC_PAGES,
  shouldContinueFavoriteSync,
} from "../src/memory/sync-pagination.js";

test("continues when Bilibili reports has_more even if a page contains fewer than 40 items", () => {
  assert.equal(shouldContinueFavoriteSync({ hasMore: true, page: 26 }), true);
});

test("stops only when Bilibili ends pagination or the safety cap is reached", () => {
  assert.equal(shouldContinueFavoriteSync({ hasMore: false, page: 26 }), false);
  assert.equal(
    shouldContinueFavoriteSync({ hasMore: true, page: MAX_FAVORITE_SYNC_PAGES }),
    false,
  );
});
