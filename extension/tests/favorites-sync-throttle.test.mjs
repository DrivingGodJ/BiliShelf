import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  createFavoritesSyncThrottleState,
  resolveFavoritesFailurePolicy,
  resolveFavoritesCooldownPolicy,
  resolveFavoritesFolderGapMs,
  resolveFavoritesPageGapMs,
  resolveRiskPausePolicy,
  resolveSuccessfulRetryAttempt,
  resolveTransientRetryPolicy,
  updateFavoritesSyncThrottleState,
} from "../shared/favorites-sync-throttle.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");

test("large folders back off more than small folders on page pacing", () => {
  const small = createFavoritesSyncThrottleState({ folderMediaCount: 80 });
  const large = createFavoritesSyncThrottleState({ folderMediaCount: 8000 });

  assert.ok(resolveFavoritesPageGapMs(large) > resolveFavoritesPageGapMs(small));
});

test("slow responses increase the next page gap", () => {
  const base = createFavoritesSyncThrottleState({ folderMediaCount: 600 });
  const slow = updateFavoritesSyncThrottleState(base, {
    responseMs: 2400,
    pageMediaCount: 20,
    totalVideosProcessed: 20,
  });

  assert.ok(resolveFavoritesPageGapMs(slow) > resolveFavoritesPageGapMs(base));
});

test("folder transitions add a non-zero delay", () => {
  const state = createFavoritesSyncThrottleState({ folderMediaCount: 1200 });

  assert.ok(resolveFavoritesFolderGapMs(state) > 0);
});

test("cooldown policy scales with heavier sync pressure", () => {
  const relaxed = resolveFavoritesCooldownPolicy(
    createFavoritesSyncThrottleState({ folderMediaCount: 150 })
  );
  const pressured = resolveFavoritesCooldownPolicy(
    updateFavoritesSyncThrottleState(
      createFavoritesSyncThrottleState({ folderMediaCount: 8000 }),
      {
        responseMs: 2600,
        pageMediaCount: 20,
        totalVideosProcessed: 2400,
      }
    )
  );

  assert.ok(pressured.thresholdVideos < relaxed.thresholdVideos);
  assert.ok(pressured.delayMs > relaxed.delayMs);
});

test("transient retry delay grows exponentially, applies bounded jitter, and caps", () => {
  const firstLow = resolveTransientRetryPolicy({
    attempt: 1,
    detectedAt: 1_000,
    random: () => 0,
  });
  const firstHigh = resolveTransientRetryPolicy({
    attempt: 1,
    detectedAt: 1_000,
    random: () => 1,
  });
  const second = resolveTransientRetryPolicy({
    attempt: 2,
    detectedAt: 1_000,
    random: () => 0.5,
  });
  const capped = resolveTransientRetryPolicy({
    attempt: 30,
    detectedAt: 1_000,
    random: () => 1,
  });

  assert.equal(firstLow.delayMs, 1_500);
  assert.equal(firstHigh.delayMs, 2_500);
  assert.equal(second.delayMs, 4_000);
  assert.equal(capped.delayMs, 300_000);
  assert.equal(second.nextRetryAt, 5_000);
  assert.equal(second.automatic, true);
});

test("Retry-After takes precedence over exponential jitter", () => {
  const policy = resolveTransientRetryPolicy({
    attempt: 8,
    detectedAt: 5_000,
    retryAfterMs: 42_000,
    random: () => 0,
  });

  assert.equal(policy.delayMs, 42_000);
  assert.equal(policy.nextRetryAt, 47_000);
  assert.equal(policy.reason, "retry-after");
});

test("risk control pauses without automatic retry", () => {
  const policy = resolveRiskPausePolicy({
    detectedAt: 10_000,
    previousRiskCount: 1,
    random: () => 0.5,
  });
  const failure = resolveFavoritesFailurePolicy({
    status: 412,
    message: "risk control",
    attempt: 2,
    detectedAt: 10_000,
    previousRiskCount: 1,
    random: () => 0.5,
  });

  assert.equal(policy.automatic, false);
  assert.equal(policy.nextRetryAt, 1_810_000);
  assert.equal(failure.phase, "paused");
  assert.equal(failure.automatic, false);
  assert.equal(failure.reason, "risk-control");
});

test("429, timeout, and 5xx failures schedule observable automatic retries", () => {
  for (const input of [
    { status: 429, message: "rate limited" },
    { status: 504, message: "timeout" },
    { status: 503, message: "unavailable" },
    { status: 0, message: "network timeout" },
  ]) {
    const policy = resolveFavoritesFailurePolicy({
      ...input,
      attempt: 1,
      detectedAt: 100,
      random: () => 0.5,
    });
    assert.equal(policy.phase, "waiting");
    assert.equal(policy.automatic, true);
    assert.ok(policy.nextRetryAt > 100);
  }
});

test("successful requests reduce the transient failure streak", () => {
  assert.equal(resolveSuccessfulRetryAttempt(4), 3);
  assert.equal(resolveSuccessfulRetryAttempt(1), 0);
  assert.equal(resolveSuccessfulRetryAttempt(0), 0);
});

test("background sync imports the throttle helper instead of fixed favorites pacing constants", async () => {
  const source = await readFile(
    path.join(repoRoot, "extension", "entrypoints", "background.ts"),
    "utf8"
  );

  assert.match(source, /favorites-sync-throttle\.js/);
  assert.doesNotMatch(source, /FAVORITES_COOLDOWN_EVERY_VIDEOS/);
  assert.doesNotMatch(source, /FAVORITES_COOLDOWN_MS/);
  assert.doesNotMatch(source, /FAVORITES_PAGE_GAP_MS/);
  assert.doesNotMatch(source, /FAVORITES_PAGE_GAP_JITTER_MS/);
});

test("background persists retry policy and wires only automatic retries to alarms", async () => {
  const source = await readFile(
    path.join(repoRoot, "extension", "entrypoints", "background.ts"),
    "utf8"
  );

  assert.match(source, /resolveFavoritesFailurePolicy/);
  assert.match(source, /const FAVORITES_SYNC_RETRY_ALARM = "bilishelf-favorites-sync-retry";/);
  assert.match(source, /job\.retry\.automatic/);
  assert.match(source, /chrome\.alarms\.create\(FAVORITES_SYNC_RETRY_ALARM/);
  assert.match(
    source,
    /alarm\.name === FAVORITES_SYNC_RETRY_ALARM[\s\S]*startFavoritesSyncTask\(/
  );
  assert.match(
    source,
    /existingJob\?\.phase === "paused"[\s\S]*existingJob\.retry\.nextRetryAt > now\(\)/
  );
  assert.match(source, /stage === "folderVideos" \? 1 : 3/);
});

test("background startup restores persisted tag enrichment scheduling", async () => {
  const source = await readFile(
    path.join(repoRoot, "extension", "entrypoints", "background.ts"),
    "utf8"
  );

  assert.match(source, /void restoreTagEnrichmentTask\(\)/);
  assert.match(
    source,
    /current\.phase === "running"[\s\S]*current\.phase = "waiting"[\s\S]*TAG_ENRICH_RESTORE_DELAY_MS/
  );
});

test("completed favorites sync schedules low-frequency tag enrichment", async () => {
  const source = await readFile(
    path.join(repoRoot, "extension", "entrypoints", "background.ts"),
    "utf8"
  );

  assert.match(
    source,
    /result\.summary\.videosProcessed > 0[\s\S]{0,240}startTagEnrichmentTask\(\{ immediate: false \}\)/
  );
});

test("background alarm resumes only persisted waiting tag tasks", async () => {
  const source = await readFile(
    path.join(repoRoot, "extension", "entrypoints", "background.ts"),
    "utf8"
  );

  assert.match(
    source,
    /alarm\.name === TAG_ENRICH_ALARM[\s\S]*meta\.phase !== "waiting"[\s\S]*await triggerTagEnrichment\(\)/
  );
});

test("tag enrichment schedules persisted next-run timestamps", async () => {
  const source = await readFile(
    path.join(repoRoot, "extension", "entrypoints", "background.ts"),
    "utf8"
  );

  assert.match(source, /function scheduleTagEnrichment\(meta: TagEnrichmentMeta \| null\)/);
  assert.match(source, /chrome\.alarms\.create\(TAG_ENRICH_ALARM, \{[\s\S]*meta\.nextRunAt/);
  assert.match(source, /TAG_ENRICH_BATCH_DELAY_MIN_MS = 20_000/);
  assert.match(source, /TAG_ENRICH_BATCH_DELAY_JITTER_MS = 10_000/);
});

test("background tag enrichment status bypasses the serialized withState queue", async () => {
  const source = await readFile(
    path.join(repoRoot, "extension", "entrypoints", "background.ts"),
    "utf8"
  );

  assert.match(
    source,
    /Fast-path status endpoints must bypass withState queue[\s\S]*if \(method === "GET" && path === "\/sync\/bilibili\/tag-enrichment\/status"\) \{[\s\S]*return ok\(getTagEnrichmentStatus\(snapshot\)\);[\s\S]*\}/
  );
  assert.doesNotMatch(
    source,
    /return await withState\(async \(state\) => \{[\s\S]*if \(method === "GET" && path === "\/sync\/bilibili\/tag-enrichment\/status"\) \{/
  );
});
