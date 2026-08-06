import test from "node:test";
import assert from "node:assert/strict";

import {
  REVIEW_FOLDER_KEY,
  applyAiOrganizerPlan,
  normalizeAiOrganizerAssignments,
  normalizeAiOrganizerConfig,
  normalizeAiOrganizerTaxonomy,
  resolveAiOrganizerFolderNames,
  undoAiOrganizerPlan,
} from "../shared/ai-organizer.js";

function createState() {
  return {
    counters: { folder: 5, video: 3, folderItem: 5, tag: 1, videoTag: 1 },
    folders: [
      { id: 1, name: "Manual", remoteMediaId: null, deletedAt: null, createdAt: 1, updatedAt: 1 },
      { id: 2, name: "Bilibili", remoteMediaId: 20, deletedAt: null, createdAt: 1, updatedAt: 1 },
      { id: 3, name: "Old AI", remoteMediaId: null, deletedAt: null, createdAt: 1, updatedAt: 1, origin: "ai", organizerId: "old", taxonomyKey: "old" },
      { id: 4, name: "Other AI", remoteMediaId: null, deletedAt: null, createdAt: 1, updatedAt: 1, origin: "ai", organizerId: "other", taxonomyKey: "other" },
    ],
    videos: [
      { id: 1, bvid: "BV1", title: "One", uploader: "UP", description: "", partition: "Tech", deletedAt: null },
      { id: 2, bvid: "BV2", title: "Two", uploader: "UP", description: "", partition: "Life", deletedAt: null },
    ],
    folderItems: [
      { id: 1, folderId: 1, videoId: 1, addedAt: 1 },
      { id: 2, folderId: 2, videoId: 1, addedAt: 1 },
      { id: 3, folderId: 3, videoId: 1, addedAt: 1, origin: "ai", organizerId: "old" },
      { id: 4, folderId: 4, videoId: 2, addedAt: 1, origin: "ai", organizerId: "other" },
    ],
    tags: [],
    videoTags: [],
    followedUps: [],
    syncMeta: {},
    ai: {},
  };
}

test("normalizes a bounded unique taxonomy", () => {
  const taxonomy = normalizeAiOrganizerTaxonomy(
    {
      folders: [
        { key: "tech", name: "技术", description: "Development" },
        { key: "tech", name: "知识", description: "Learning" },
        { key: "ignored", name: "技术" },
      ],
    },
    3,
  );

  assert.deepEqual(taxonomy.map((item) => item.key), ["tech", "tech-2"]);
  assert.deepEqual(taxonomy.map((item) => item.name), ["技术", "知识"]);
});

test("resolves preview folder names against existing folders and localizes review", () => {
  const result = resolveAiOrganizerFolderNames(
    [
      { key: "tech", name: "Tech", description: "Development" },
      { key: "music", name: "Music", description: "Listening" },
    ],
    [
      { name: "Tech", deletedAt: null },
      { name: "Needs review", deletedAt: null },
      { name: "Deleted", deletedAt: 10 },
    ],
    "Needs review",
  );

  assert.deepEqual(
    result.taxonomy.map((item) => item.name),
    ["Tech (AI)", "Music"],
  );
  assert.equal(result.reviewFolderName, "Needs review (AI)");
});

test("normalizes organizer locale for stable prompts and review labels", () => {
  assert.equal(normalizeAiOrganizerConfig({ locale: "en-US" }).locale, "en-US");
  assert.equal(normalizeAiOrganizerConfig({ locale: "unknown" }).locale, "zh-CN");
});

test("missing, duplicate, and unknown AI assignments become review items", () => {
  const expected = [
    { itemKey: "item-1", videoId: 1 },
    { itemKey: "item-2", videoId: 2 },
    { itemKey: "item-3", videoId: 3 },
  ];
  const result = normalizeAiOrganizerAssignments(
    {
      assignments: [
        { itemKey: "item-1", folderKey: "tech", confidence: 0.9 },
        { itemKey: "item-2", folderKey: "tech", confidence: 0.8 },
        { itemKey: "item-2", folderKey: "tech", confidence: 0.7 },
        { itemKey: "item-3", folderKey: "invented", confidence: 1 },
      ],
    },
    expected,
    [{ key: "tech", name: "技术" }],
    0.65,
  );

  assert.equal(result.invalid, 2);
  assert.equal(result.assignments[0].folderKey, "tech");
  assert.equal(result.assignments[0].lowConfidence, false);
  assert.equal(result.assignments[1].folderKey, REVIEW_FOLDER_KEY);
  assert.equal(result.assignments[2].folderKey, REVIEW_FOLDER_KEY);
});

test("apply replaces only selected AI relations and undo preserves manual and Bilibili data", () => {
  const original = createState();
  const applied = applyAiOrganizerPlan(
    original,
    {
      runId: "run-1",
      sourceVideoIds: [1],
      taxonomy: [{ key: "tech", name: "技术", description: "Development" }],
      assignments: [
        { videoId: 1, folderKey: "tech", confidence: 0.92, lowConfidence: false },
      ],
      confidenceThreshold: 0.65,
    },
    100,
  );

  assert.equal(original.folders.length, 4, "the input state stays immutable");
  assert.equal(applied.summary.folderLinksRemoved, 1);
  assert.equal(applied.summary.folderLinksAdded, 1);
  assert.equal(applied.state.folders.some((folder) => folder.id === 3), false);
  assert.equal(applied.state.folders.some((folder) => folder.id === 4), true);
  assert.equal(applied.state.folderItems.some((item) => item.id === 1), true);
  assert.equal(applied.state.folderItems.some((item) => item.id === 2), true);
  assert.equal(applied.state.folderItems.some((item) => item.id === 4), true);

  const undone = undoAiOrganizerPlan(applied.state, applied.undo, 200);
  assert.equal(undone.state.folders.some((folder) => folder.id === 3), true);
  assert.equal(undone.state.folderItems.some((item) => item.id === 3), true);
  assert.equal(undone.state.folderItems.some((item) => item.id === 1), true);
  assert.equal(undone.state.folderItems.some((item) => item.id === 2), true);
  assert.equal(
    undone.state.folderItems.some((item) => item.organizerId === "run-1"),
    false,
  );
});

test("apply keeps resolved preview names stable and rejects duplicate assignments", () => {
  const original = createState();
  original.folders[0].name = "Tech";
  const resolved = resolveAiOrganizerFolderNames(
    [{ key: "tech", name: "Tech", description: "Development" }],
    original.folders,
  );
  const applied = applyAiOrganizerPlan(
    original,
    {
      runId: "run-resolved",
      sourceVideoIds: [1],
      taxonomy: resolved.taxonomy,
      assignments: [
        { videoId: 1, folderKey: "tech", confidence: 0.9, lowConfidence: false },
      ],
      confidenceThreshold: 0.65,
      reviewFolderName: resolved.reviewFolderName,
    },
    100,
  );
  assert.equal(
    applied.state.folders.find((folder) => folder.organizerId === "run-resolved").name,
    "Tech (AI)",
  );

  assert.throws(
    () =>
      applyAiOrganizerPlan(original, {
        runId: "run-duplicate",
        sourceVideoIds: [1],
        taxonomy: resolved.taxonomy,
        assignments: [
          { videoId: 1, folderKey: "tech", confidence: 0.9 },
          { videoId: 1, folderKey: "tech", confidence: 0.8 },
        ],
      }),
    /assignments are invalid or duplicated/,
  );
});

test("low-confidence classifications are applied to a review folder", () => {
  const state = createState();
  const applied = applyAiOrganizerPlan(
    state,
    {
      runId: "run-review",
      sourceVideoIds: [1],
      taxonomy: [{ key: "tech", name: "技术", description: "Development" }],
      assignments: [
        { videoId: 1, folderKey: "tech", confidence: 0.4, lowConfidence: true },
      ],
      confidenceThreshold: 0.65,
    },
    100,
  );

  const reviewFolder = applied.state.folders.find(
    (folder) => folder.organizerId === "run-review",
  );
  assert.equal(reviewFolder.taxonomyKey, REVIEW_FOLDER_KEY);
  assert.equal(reviewFolder.name, "待确认");
});

test("undo preserves an AI folder that the user edited after apply", () => {
  const applied = applyAiOrganizerPlan(
    createState(),
    {
      runId: "run-edited",
      sourceVideoIds: [1],
      taxonomy: [{ key: "tech", name: "技术", description: "Development" }],
      assignments: [
        { videoId: 1, folderKey: "tech", confidence: 0.9, lowConfidence: false },
      ],
      confidenceThreshold: 0.65,
    },
    100,
  );
  const editedFolder = applied.state.folders.find(
    (folder) => folder.organizerId === "run-edited",
  );
  editedFolder.name = "我调整过的分类";
  editedFolder.updatedAt = 150;

  const undone = undoAiOrganizerPlan(applied.state, applied.undo, 200);
  const preserved = undone.state.folders.find((folder) => folder.id === editedFolder.id);
  assert.equal(preserved.name, "我调整过的分类");
  assert.equal(preserved.origin, undefined);
  assert.equal(preserved.organizerId, undefined);
});
