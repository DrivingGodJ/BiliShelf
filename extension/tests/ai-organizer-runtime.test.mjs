import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runBackgroundScenario } from "./helpers/background-runtime-harness.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backgroundPath = path.resolve(__dirname, "..", "entrypoints", "background.ts");

function baseState() {
  return {
    counters: { folder: 3, video: 4, folderItem: 3, tag: 2, videoTag: 2 },
    folders: [
      { id: 1, name: "Remote", remoteMediaId: 10, deletedAt: null },
      { id: 2, name: "Local", remoteMediaId: null, deletedAt: null },
    ],
    videos: [
      { id: 1, bvid: "BV1", title: "One", deletedAt: null, isInvalid: false },
      { id: 2, bvid: "BV2", title: "Two", deletedAt: null, isInvalid: true },
      { id: 3, bvid: "BV3", title: "Three", deletedAt: null, isInvalid: false },
    ],
    folderItems: [
      { id: 1, folderId: 1, videoId: 1, addedAt: 1 },
      { id: 2, folderId: 1, videoId: 2, addedAt: 1 },
    ],
    tags: [{ id: 1, name: "Tag", type: "custom", archivedAt: null }],
    videoTags: [{ id: 1, videoId: 1, tagId: 1 }],
    followedUps: [],
    syncMeta: {},
    ai: {},
  };
}

test("organizer source selection supports full-library and folder scopes", () => {
  const payload = runBackgroundScenario({
    exports: ["buildAiOrganizerSourceSelection"],
    input: { state: baseState() },
    scenarioSource: `
      return {
        all: buildAiOrganizerSourceSelection(input.state, {
          scope: "all",
          folderId: null,
        }),
        folder: buildAiOrganizerSourceSelection(input.state, {
          scope: "folder",
          folderId: 1,
        }),
      };
    `,
  });

  assert.deepEqual(payload.result.all.sourceVideoIds, [1, 3]);
  assert.equal(payload.result.all.skippedInvalid, 1);
  assert.deepEqual(payload.result.folder.sourceVideoIds, [1]);
  assert.equal(payload.result.folder.sourceFolderName, "Remote");
  assert.equal(payload.result.folder.skippedInvalid, 1);
});

test("organizer conflict hash ignores tag/manual metadata but tracks AI relations", () => {
  const payload = runBackgroundScenario({
    exports: ["computeAiOrganizerSourceHash"],
    input: { state: baseState() },
    scenarioSource: `
      const original = await computeAiOrganizerSourceHash(input.state, [1]);
      const manualChange = structuredClone(input.state);
      manualChange.tags[0].name = "Changed tag";
      manualChange.folderItems.push({ id: 9, folderId: 2, videoId: 1, addedAt: 2 });
      const afterManual = await computeAiOrganizerSourceHash(manualChange, [1]);
      const aiChange = structuredClone(manualChange);
      aiChange.folders.push({
        id: 9,
        name: "AI",
        deletedAt: null,
        origin: "ai",
        organizerId: "other",
        taxonomyKey: "ai",
      });
      aiChange.folderItems.push({
        id: 10,
        folderId: 9,
        videoId: 1,
        addedAt: 3,
        origin: "ai",
        organizerId: "other",
      });
      const afterAi = await computeAiOrganizerSourceHash(aiChange, [1]);
      return { original, afterManual, afterAi };
    `,
  });

  assert.equal(payload.result.original, payload.result.afterManual);
  assert.notEqual(payload.result.original, payload.result.afterAi);
});

test("background wires persisted organizer status, controls, apply, undo, and alarm recovery", async () => {
  const source = await readFile(backgroundPath, "utf8");
  assert.match(source, /AI_ORGANIZER_TASK_KEY = "ai-organizer-task-v1"/);
  assert.match(source, /path === "\/ai\/organizer\/status"/);
  assert.match(source, /path === "\/ai\/organizer\/preview"/);
  assert.match(source, /path === "\/ai\/organizer\/assignments"/);
  assert.match(source, /path === "\/ai\/organizer\/start"/);
  assert.match(source, /path === "\/ai\/organizer\/pause"/);
  assert.match(source, /path === "\/ai\/organizer\/resume"/);
  assert.match(source, /path === "\/ai\/organizer\/cancel"/);
  assert.match(source, /path === "\/ai\/organizer\/apply"/);
  assert.match(source, /path === "\/ai\/organizer\/undo"/);
  assert.match(source, /alarm\.name === AI_ORGANIZER_ALARM/);
  assert.match(source, /writeStateAndStoredValue\(/);
  assert.match(source, /AI_ORGANIZER_REQUEST_TIMEOUT_MS = 90_000/);
  assert.match(source, /scheduleAiOrganizerRequestWatchdog\(\)/);
  assert.match(source, /persistedSnapshot\?\.runId !== id/);
  assert.match(source, /aiOrganizerStartPending \|\| aiOrganizerApplyPending/);
});
