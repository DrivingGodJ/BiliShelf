import assert from "node:assert/strict";
import test from "node:test";
import {
  FAVORITE_REMOVAL_SYNC_VERSION,
  MAX_FAVORITE_SYNC_PAGES,
  shouldContinueFavoriteSync,
  shouldReconcileFavoriteSync,
} from "../src/memory/sync-pagination.js";

test("continues when Bilibili reports has_more even if a page contains fewer than 40 items", () => {
  assert.equal(shouldContinueFavoriteSync({ hasMore: true, page: 26 }), true);
});

test("reconciles removals for the migration baseline or a later remote count decrease", () => {
  assert.equal(
    shouldReconcileFavoriteSync({
      mode: "quick",
      previousRemoteCount: 2416,
      remoteCount: 2415,
      removalSyncVersion: FAVORITE_REMOVAL_SYNC_VERSION,
    }),
    true,
  );
  assert.equal(
    shouldReconcileFavoriteSync({
      mode: "quick",
      previousRemoteCount: 2416,
      remoteCount: 2416,
      removalSyncVersion: FAVORITE_REMOVAL_SYNC_VERSION,
    }),
    false,
  );
  assert.equal(
    shouldReconcileFavoriteSync({
      mode: "quick",
      previousRemoteCount: 2416,
      remoteCount: 2417,
      removalSyncVersion: FAVORITE_REMOVAL_SYNC_VERSION,
    }),
    false,
  );
  assert.equal(
    shouldReconcileFavoriteSync({
      mode: "full",
      previousRemoteCount: 2416,
      remoteCount: 2415,
      removalSyncVersion: 0,
    }),
    false,
  );
  assert.equal(
    shouldReconcileFavoriteSync({
      mode: "quick",
      previousRemoteCount: 2416,
      remoteCount: 2416,
      removalSyncVersion: 0,
    }),
    true,
  );
});

test("stops only when Bilibili ends pagination or the safety cap is reached", () => {
  assert.equal(shouldContinueFavoriteSync({ hasMore: false, page: 26 }), false);
  assert.equal(
    shouldContinueFavoriteSync({ hasMore: true, page: MAX_FAVORITE_SYNC_PAGES }),
    false,
  );
});
