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
  assert.equal(payload.result.batchSize, 5);
  assert.equal(payload.result.intervalSeconds, 20);
  assert.deepEqual(payload.result.checkedEmptyVideoIds, []);
  assert.deepEqual(payload.result.errors, []);
});

test("tag task rate settings are normalized to supported limits", () => {
  const payload = runBackgroundScenario({
    exports: ["normalizeTagEnrichmentMeta"],
    scenarioSource: `
      return {
        low: normalizeTagEnrichmentMeta({ batchSize: -4, intervalSeconds: 1 }),
        high: normalizeTagEnrichmentMeta({ batchSize: 99, intervalSeconds: 999 }),
      };
    `,
  });

  assert.equal(payload.result.low.batchSize, 1);
  assert.equal(payload.result.low.intervalSeconds, 20);
  assert.equal(payload.result.high.batchSize, 10);
  assert.equal(payload.result.high.intervalSeconds, 300);
});

test("updating tag task rate persists settings and reschedules a waiting task", () => {
  const state = stateWithVideos([{ bvid: "BVPENDING" }], {
    phase: "waiting",
    paused: false,
    total: 1,
    totalMissing: 1,
    nextRunAt: 1,
  });
  const payload = runBackgroundScenario({
    exports: ["updateTagEnrichmentSettings", "readState"],
    input: { state },
    preImportSource: databaseSetup,
    scenarioSource: `
      const before = Date.now();
      const status = await updateTagEnrichmentSettings({
        batchSize: 99,
        intervalSeconds: 75,
      });
      const persisted = (await readState()).syncMeta.tagEnrichment;
      return {
        before,
        status,
        persisted,
        alarm: globalThis.__scheduledAlarms.at(-1),
      };
    `,
  });

  assert.equal(payload.result.status.batchSize, 10);
  assert.equal(payload.result.status.intervalSeconds, 75);
  assert.equal(payload.result.persisted.batchSize, 10);
  assert.equal(payload.result.persisted.intervalSeconds, 75);
  assert.equal(payload.result.alarm.name, "bilishelf-tag-enrich");
  assert.ok(payload.result.alarm.when >= payload.result.before + 75_000);
  assert.ok(payload.result.alarm.when <= payload.result.before + 85_000);
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

test("tag candidates are limited to selected folders and deduplicated", () => {
  const payload = runBackgroundScenario({
    exports: ["collectMissingSystemTagCandidates", "normalizeTagEnrichmentMeta"],
    scenarioSource: `
      const state = ${JSON.stringify(stateWithVideos([
        { bvid: "BVONE" },
        { bvid: "BVSHARED" },
        { bvid: "BVTWO" },
      ]))};
      state.folders = [
        { id: 1, name: "One", description: null, remoteMediaId: null, sortOrder: 0, deletedAt: null, createdAt: 1, updatedAt: 1 },
        { id: 2, name: "Two", description: null, remoteMediaId: null, sortOrder: 1, deletedAt: null, createdAt: 1, updatedAt: 1 },
      ];
      state.folderItems = [
        { id: 1, folderId: 1, videoId: 1, addedAt: 1 },
        { id: 2, folderId: 1, videoId: 2, addedAt: 1 },
        { id: 3, folderId: 2, videoId: 2, addedAt: 1 },
        { id: 4, folderId: 2, videoId: 3, addedAt: 1 },
      ];
      const meta = normalizeTagEnrichmentMeta({
        phase: "waiting",
        selectedFolderIds: [1],
      });
      const result = collectMissingSystemTagCandidates(state, 10, 0, meta);
      return { total: result.total, ids: result.items.map((item) => item.id) };
    `,
  });

  assert.deepEqual(payload.result, { total: 2, ids: [1, 2] });
});

test("starting and pausing a scoped tag task preserves its selected folders", () => {
  const state = stateWithVideos([{ bvid: "BVONE" }, { bvid: "BVTWO" }]);
  state.counters.folder = 3;
  state.counters.folderItem = 3;
  state.folders = [
    { id: 1, name: "One", description: null, remoteMediaId: null, sortOrder: 0, deletedAt: null, createdAt: 1, updatedAt: 1 },
    { id: 2, name: "Two", description: null, remoteMediaId: null, sortOrder: 1, deletedAt: null, createdAt: 1, updatedAt: 1 },
  ];
  state.folderItems = [
    { id: 1, folderId: 1, videoId: 1, addedAt: 1 },
    { id: 2, folderId: 2, videoId: 2, addedAt: 1 },
  ];
  const payload = runBackgroundScenario({
    exports: [
      "startTagEnrichmentTask",
      "pauseTagEnrichmentTask",
      "getTagEnrichmentStatus",
      "readState",
    ],
    input: { state },
    preImportSource: databaseSetup,
    scenarioSource: `
      await startTagEnrichmentTask({ immediate: false, selectedFolderIds: [2] });
      await pauseTagEnrichmentTask();
      const status = getTagEnrichmentStatus(await readState());
      return status;
    `,
  });

  assert.equal(payload.result.phase, "paused");
  assert.deepEqual(payload.result.selectedFolderIds, [2]);
  assert.equal(payload.result.scopeVideoCount, 1);
  assert.equal(payload.result.totalMissing, 1);
});

test("tag controls persist immediately while favorites sync owns the state queue", () => {
  const state = stateWithVideos([{ bvid: "BVPENDING" }]);
  state.counters.folder = 2;
  state.counters.folderItem = 2;
  state.folders = [
    { id: 1, name: "Scoped", description: null, remoteMediaId: 99, sortOrder: 0, deletedAt: null, createdAt: 1, updatedAt: 1 },
  ];
  state.folderItems = [
    { id: 1, folderId: 1, videoId: 1, addedAt: 1 },
  ];

  const payload = runBackgroundScenario({
    exports: [
      "startFavoritesSyncTask",
      "startTagEnrichmentTask",
      "pauseTagEnrichmentTask",
      "dismissTagEnrichmentStatus",
      "getTagEnrichmentStatus",
      "getFavoritesSyncStatus",
      "readState",
    ],
    input: { state },
    preImportSource: databaseSetup,
    scenarioSource: `
      let releaseFetch;
      let markFetchStarted;
      const fetchStarted = new Promise((resolve) => {
        markFetchStarted = resolve;
      });
      globalThis.fetch = () => {
        markFetchStarted();
        return new Promise((resolve) => {
          releaseFetch = resolve;
        });
      };
      const within = (promise, label) => Promise.race([
        promise,
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error(label + " timed out")), 250);
        }),
      ]);

      await startFavoritesSyncTask({ selectedRemoteFolderIds: [99] });
      await within(fetchStarted, "favorites fetch");

      await within(
        startTagEnrichmentTask({ selectedFolderIds: [1], immediate: true }),
        "tag start",
      );
      const queued = getTagEnrichmentStatus(await readState());

      await within(pauseTagEnrichmentTask(), "tag pause");
      const paused = getTagEnrichmentStatus(await readState());

      await within(
        startTagEnrichmentTask({ immediate: true, force: true }),
        "tag resume",
      );
      await within(dismissTagEnrichmentStatus(), "tag interrupt");
      const interrupted = getTagEnrichmentStatus(await readState());

      releaseFetch(new Response("", { status: 412 }));
      for (let index = 0; index < 100; index += 1) {
        const syncStatus = getFavoritesSyncStatus(await readState());
        if (!syncStatus.running) break;
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      return { queued, paused, interrupted };
    `,
  });

  assert.equal(payload.result.queued.phase, "waiting");
  assert.equal(payload.result.queued.waitingForVideoSync, true);
  assert.deepEqual(payload.result.queued.selectedFolderIds, [1]);
  assert.equal(payload.result.paused.phase, "paused");
  assert.equal(payload.result.paused.waitingForVideoSync, false);
  assert.equal(payload.result.interrupted.phase, "idle");
  assert.equal(payload.result.interrupted.waitingForVideoSync, false);
  assert.ok(payload.result.interrupted.dismissedAt > 0);
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

test("dismissing tag status persists the dismissal and keeps completed queue metadata", () => {
  const state = stateWithVideos(
    [
      { bvid: "BVEMPTY" },
      { bvid: "BVSKIPPED" },
      { bvid: "BVPENDING" },
    ],
    {
      phase: "paused",
      paused: true,
      batchSize: 7,
      intervalSeconds: 75,
      total: 3,
      totalMissing: 1,
      processed: 2,
      checkedEmptyVideoIds: [1],
      skippedVideoIds: [2],
      nextRunAt: Date.now() + 60_000,
      retryAttempt: 2,
      riskCount: 1,
      lastError: "temporary failure",
    },
  );
  const payload = runBackgroundScenario({
    exports: ["dismissTagEnrichmentStatus", "readState"],
    input: { state },
    preImportSource: databaseSetup,
    scenarioSource: `
      const before = Date.now();
      const status = await dismissTagEnrichmentStatus();
      const persisted = (await readState()).syncMeta.tagEnrichment;
      return {
        before,
        status,
        persisted,
        cleared: globalThis.__clearedAlarms,
      };
    `,
  });

  assert.equal(payload.result.status.phase, "idle");
  assert.equal(payload.result.status.paused, false);
  assert.ok(payload.result.status.dismissedAt >= payload.result.before);
  assert.equal(payload.result.persisted.batchSize, 7);
  assert.equal(payload.result.persisted.intervalSeconds, 75);
  assert.deepEqual(payload.result.persisted.checkedEmptyVideoIds, [1]);
  assert.deepEqual(payload.result.persisted.skippedVideoIds, [2]);
  assert.equal(payload.result.persisted.nextRunAt, null);
  assert.equal(payload.result.persisted.retryAttempt, 0);
  assert.equal(payload.result.persisted.riskCount, 0);
  assert.equal(payload.result.persisted.lastError, null);
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

test("tag batches use the configured base interval plus bounded jitter", () => {
  const payload = runBackgroundScenario({
    exports: ["resolveTagEnrichmentBatchNextRunAt"],
    scenarioSource: `
      return {
        low: resolveTagEnrichmentBatchNextRunAt(1_000, () => 0),
        high: resolveTagEnrichmentBatchNextRunAt(1_000, () => 1),
        customLow: resolveTagEnrichmentBatchNextRunAt(1_000, () => 0, 75),
        customHigh: resolveTagEnrichmentBatchNextRunAt(1_000, () => 1, 75),
      };
    `,
  });

  assert.deepEqual(payload.result, {
    low: 21_000,
    high: 31_000,
    customLow: 76_000,
    customHigh: 86_000,
  });
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
