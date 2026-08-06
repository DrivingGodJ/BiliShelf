import test from "node:test";
import assert from "node:assert/strict";

import { runBackgroundScenario } from "./helpers/background-runtime-harness.mjs";

const databaseSetup = `
  globalThis.__scheduledAlarms = [];
  globalThis.__clearedAlarms = [];
  globalThis.__storedState = structuredClone(input.state);
  chrome.alarms.create = (name, info) => {
    globalThis.__scheduledAlarms.push({ name, ...info });
  };
  chrome.alarms.clear = (name) => {
    globalThis.__clearedAlarms.push(name);
  };
  const database = {
    objectStoreNames: { contains() { return true; } },
    transaction() {
      const transaction = {
        objectStore() {
          return {
            get() {
              const request = {};
              queueMicrotask(() => {
                request.result = { key: "state", value: structuredClone(globalThis.__storedState) };
                request.onsuccess?.();
              });
              return request;
            },
            put(record) {
              const request = {};
              queueMicrotask(() => {
                globalThis.__storedState = structuredClone(record.value);
                request.onsuccess?.();
                transaction.oncomplete?.();
              });
              return request;
            },
          };
        },
      };
      return transaction;
    },
  };
  globalThis.indexedDB = {
    open() {
      const request = { result: database };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
  };
`;

function stateWithVideos(videos, tagEnrichment = {}) {
  return {
    counters: { folder: 1, video: videos.length + 1, folderItem: 1, tag: 1, videoTag: 1 },
    folders: [],
    videos: videos.map((video, index) => ({
      id: index + 1,
      bvid: video.bvid,
      title: video.bvid,
      coverUrl: "",
      uploader: "UP",
      uploaderSpaceUrl: null,
      description: "",
      partition: "",
      publishAt: null,
      bvidUrl: "",
      isInvalid: false,
      deletedAt: null,
      createdAt: 1,
      updatedAt: 1,
    })),
    folderItems: [],
    tags: [],
    videoTags: [],
    followedUps: [],
    syncMeta: { tagEnrichment },
    ai: {},
  };
}

test("legacy tag state migrates to a durable paused task", () => {
  const payload = runBackgroundScenario({
    exports: ["normalizeTagEnrichmentMeta"],
    scenarioSource: `
      const restored = normalizeTagEnrichmentMeta({
        paused: true,
        cursorAfterVideoId: 42,
        totalMissing: 8,
        lastBatchProcessed: 2,
      });
      return restored;
    `,
  });

  assert.equal(payload.result.phase, "paused");
  assert.equal(payload.result.paused, true);
  assert.equal(payload.result.cursorAfterVideoId, 42);
  assert.equal(payload.result.totalMissing, 8);
  assert.deepEqual(payload.result.checkedEmptyVideoIds, []);
  assert.deepEqual(payload.result.errors, []);
});

test("empty and permanently skipped videos do not re-enter the pending queue", () => {
  const payload = runBackgroundScenario({
    exports: ["collectMissingSystemTagCandidates", "normalizeTagEnrichmentMeta"],
    scenarioSource: `
      const state = ${JSON.stringify(stateWithVideos([
        { bvid: "BVEMPTY" },
        { bvid: "BVSKIPPED" },
        { bvid: "BVPENDING" },
      ]))};
      const meta = normalizeTagEnrichmentMeta({
        checkedEmptyVideoIds: [1],
        skippedVideoIds: [2],
      });
      state.syncMeta.tagEnrichment = meta;
      const result = collectMissingSystemTagCandidates(state, 2, 0, meta);
      return { total: result.total, ids: result.items.map((item) => item.id) };
    `,
  });

  assert.deepEqual(payload.result, { total: 1, ids: [3] });
});

test("worker restart restores a running task as a scheduled waiting task", () => {
  const state = stateWithVideos([{ bvid: "BVPENDING" }], {
    phase: "running",
    paused: false,
    total: 1,
    totalMissing: 1,
    startedAt: 100,
  });
  const payload = runBackgroundScenario({
    exports: ["restoreTagEnrichmentTask", "readState", "getTagEnrichmentStatus"],
    input: { state },
    preImportSource: databaseSetup,
    scenarioSource: `
      await restoreTagEnrichmentTask();
      const status = getTagEnrichmentStatus(await readState());
      return { status, alarms: globalThis.__scheduledAlarms };
    `,
  });

  assert.equal(payload.result.status.phase, "waiting");
  assert.ok(payload.result.status.nextRunAt > 0);
  assert.equal(payload.result.alarms.at(-1).name, "bilishelf-tag-enrich");
  assert.ok(payload.result.alarms.at(-1).when > 0);
});

test("manual stop persists and suppresses future alarms", () => {
  const state = stateWithVideos([{ bvid: "BVPENDING" }], {
    phase: "waiting",
    paused: false,
    total: 1,
    totalMissing: 1,
    nextRunAt: Date.now() + 60_000,
  });
  const payload = runBackgroundScenario({
    exports: [
      "pauseTagEnrichmentTask",
      "startTagEnrichmentTask",
      "readState",
      "getTagEnrichmentStatus",
    ],
    input: { state },
    preImportSource: databaseSetup,
    scenarioSource: `
      await pauseTagEnrichmentTask();
      const stopped = getTagEnrichmentStatus(await readState());
      const scheduledWhileStopped = [...globalThis.__scheduledAlarms];
      await startTagEnrichmentTask({ immediate: false, force: true });
      const resumed = getTagEnrichmentStatus(await readState());
      return {
        stopped,
        resumed,
        scheduledWhileStopped,
        scheduledAfterResume: globalThis.__scheduledAlarms,
        cleared: globalThis.__clearedAlarms,
      };
    `,
  });

  assert.equal(payload.result.stopped.phase, "paused");
  assert.equal(payload.result.stopped.paused, true);
  assert.equal(payload.result.stopped.nextRunAt, null);
  assert.deepEqual(payload.result.scheduledWhileStopped, []);
  assert.equal(payload.result.resumed.phase, "waiting");
  assert.equal(payload.result.resumed.paused, false);
  assert.ok(payload.result.resumed.nextRunAt > 0);
  assert.equal(
    payload.result.scheduledAfterResume.at(-1).name,
    "bilishelf-tag-enrich",
  );
  assert.ok(payload.result.cleared.includes("bilishelf-tag-enrich"));
});

test("an empty remote tag response completes once without looping forever", () => {
  const state = stateWithVideos([{ bvid: "BVEMPTY" }], {
    phase: "waiting",
    paused: false,
    total: 1,
    totalMissing: 1,
    nextRunAt: 1,
    startedAt: 1,
  });
  const payload = runBackgroundScenario({
    exports: ["runTagEnrichmentBatch", "readState", "getTagEnrichmentStatus"],
    input: { state },
    preImportSource: `${databaseSetup}
      globalThis.setTimeout = (callback) => {
        queueMicrotask(callback);
        return 0;
      };
      globalThis.fetch = async (request) => {
        const url = String(request);
        if (!url.includes("/x/tag/archive/tags")) {
          throw new Error("Unexpected URL: " + url);
        }
        return new Response(JSON.stringify({ code: 0, data: [] }), { status: 200 });
      };
    `,
    scenarioSource: `
      await runTagEnrichmentBatch();
      return getTagEnrichmentStatus(await readState());
    `,
  });

  assert.equal(payload.result.phase, "completed");
  assert.equal(payload.result.processed, 1);
  assert.equal(payload.result.empty, 1);
  assert.equal(payload.result.totalMissing, 0);
  assert.equal(payload.result.lastBatchProcessed, 1);
});

test("tag batches keep a bounded 20-to-30-second next-run window", () => {
  const payload = runBackgroundScenario({
    exports: ["resolveTagEnrichmentBatchNextRunAt"],
    scenarioSource: `
      return {
        low: resolveTagEnrichmentBatchNextRunAt(1_000, () => 0),
        high: resolveTagEnrichmentBatchNextRunAt(1_000, () => 1),
      };
    `,
  });

  assert.deepEqual(payload.result, { low: 21_000, high: 31_000 });
});

test("risk control pauses the tag task without scheduling automatic retries", () => {
  const state = stateWithVideos([{ bvid: "BVRISK" }], {
    phase: "waiting",
    paused: false,
    total: 1,
    totalMissing: 1,
    nextRunAt: 1,
    startedAt: 1,
  });
  const payload = runBackgroundScenario({
    exports: ["runTagEnrichmentBatch", "readState", "getTagEnrichmentStatus"],
    input: { state },
    preImportSource: `${databaseSetup}
      globalThis.setTimeout = (callback) => {
        queueMicrotask(callback);
        return 0;
      };
      globalThis.fetch = async () => new Response(
        JSON.stringify({ code: -412, message: "risk control" }),
        { status: 412 },
      );
    `,
    scenarioSource: `
      await runTagEnrichmentBatch();
      return {
        status: getTagEnrichmentStatus(await readState()),
        alarms: globalThis.__scheduledAlarms,
      };
    `,
  });

  assert.equal(payload.result.status.phase, "paused");
  assert.equal(payload.result.status.paused, true);
  assert.equal(payload.result.status.riskCount, 1);
  assert.ok(payload.result.status.nextRunAt > Date.now());
  assert.equal(payload.result.status.totalMissing, 1);
  assert.deepEqual(payload.result.alarms, []);
});

test("rate limits leave the tag task waiting with a persisted retry alarm", () => {
  const state = stateWithVideos([{ bvid: "BVRATE" }], {
    phase: "waiting",
    paused: false,
    total: 1,
    totalMissing: 1,
    nextRunAt: 1,
    startedAt: 1,
  });
  const payload = runBackgroundScenario({
    exports: ["runTagEnrichmentBatch", "readState", "getTagEnrichmentStatus"],
    input: { state },
    preImportSource: `${databaseSetup}
      globalThis.setTimeout = (callback) => {
        queueMicrotask(callback);
        return 0;
      };
      globalThis.fetch = async () => new Response(
        JSON.stringify({ code: -429, message: "rate limited" }),
        { status: 429, headers: { "Retry-After": "2" } },
      );
    `,
    scenarioSource: `
      await runTagEnrichmentBatch();
      return {
        status: getTagEnrichmentStatus(await readState()),
        alarms: globalThis.__scheduledAlarms,
      };
    `,
  });

  assert.equal(payload.result.status.phase, "waiting");
  assert.equal(payload.result.status.paused, false);
  assert.equal(payload.result.status.retryAttempt, 1);
  assert.equal(payload.result.status.totalMissing, 1);
  assert.ok(payload.result.status.nextRunAt > 0);
  assert.equal(payload.result.alarms.at(-1).name, "bilishelf-tag-enrich");
});
