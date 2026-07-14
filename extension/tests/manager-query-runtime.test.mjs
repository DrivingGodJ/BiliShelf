import test from "node:test";
import assert from "node:assert/strict";

import { runBackgroundScenario } from "./helpers/background-runtime-harness.mjs";

test("unfiltered manager pagination maps only the requested page", () => {
  const payload = runBackgroundScenario({
    exports: ["handleReadOnlyApi"],
    instrumentMapVideo: true,
    input: { videoCount: 50_000, page: 7, pageSize: 30 },
    scenarioSource: `
      const now = 1_800_000_000_000;
      const state = {
        counters: { folder: 2, video: input.videoCount + 1, folderItem: input.videoCount + 1, tag: 1, videoTag: 1 },
        folders: [{ id: 1, name: "Large", description: null, remoteMediaId: null, sortOrder: 0, deletedAt: null, createdAt: now, updatedAt: now }],
        videos: Array.from({ length: input.videoCount }, (_, index) => ({
          id: index + 1,
          bvid: "BV" + String(index + 1).padStart(10, "0"),
          title: "Video " + (index + 1),
          coverUrl: "",
          uploader: "Uploader",
          uploaderSpaceUrl: null,
          description: "",
          partition: "",
          publishAt: null,
          bvidUrl: "",
          isInvalid: false,
          deletedAt: null,
          createdAt: now - index,
          updatedAt: now - index,
        })),
        folderItems: Array.from({ length: input.videoCount }, (_, index) => ({
          id: index + 1,
          folderId: 1,
          videoId: index + 1,
          addedAt: now - index,
        })),
        tags: [],
        videoTags: [],
        followedUps: [],
        syncMeta: {},
        ai: {},
      };
      resetMapVideoCallCount();
      const params = new URLSearchParams({
        folderId: "1",
        page: String(input.page),
        pageSize: String(input.pageSize),
      });
      const response = handleReadOnlyApi(state, "/videos", params);
      return {
        mapped: getMapVideoCallCount(),
        itemCount: response.data.items.length,
        total: response.data.pagination.total,
      };
    `,
  });

  assert.equal(payload.result.itemCount, 30);
  assert.equal(payload.result.total, 50_000);
  assert.ok(
    payload.result.mapped <= 30,
    `expected at most 30 DTO mappings, received ${payload.result.mapped}`,
  );
});
