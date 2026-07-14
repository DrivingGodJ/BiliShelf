import test from "node:test";
import assert from "node:assert/strict";

import { runBackgroundScenario } from "./helpers/background-runtime-harness.mjs";

const emptyStateSource = `({
  counters: { folder: 1, video: 1, folderItem: 1, tag: 1, videoTag: 1 },
  folders: [],
  videos: [],
  folderItems: [],
  tags: [],
  videoTags: [],
  followedUps: [],
  syncMeta: {},
  ai: {},
})`;

function existingFolderStateSource(bvids) {
  const videos = bvids.map((bvid, index) => ({
    id: index + 1,
    bvid,
    title: bvid,
    coverUrl: "",
    uploader: "UP",
    uploaderSpaceUrl: null,
    description: "",
    partition: "",
    publishAt: null,
    bvidUrl: `https://www.bilibili.com/video/${bvid}`,
    isInvalid: false,
    deletedAt: null,
    createdAt: 1,
    updatedAt: 1,
  }));
  const folderItems = bvids.map((_bvid, index) => ({
    id: index + 1,
    folderId: 1,
    videoId: index + 1,
    addedAt: 1,
  }));
  return JSON.stringify({
    counters: {
      folder: 2,
      video: videos.length + 1,
      folderItem: folderItems.length + 1,
      tag: 1,
      videoTag: 1,
    },
    folders: [{
      id: 1,
      name: "Remote",
      description: null,
      remoteMediaId: 99,
      sortOrder: 1,
      deletedAt: null,
      createdAt: 1,
      updatedAt: 1,
    }],
    videos,
    folderItems,
    tags: [],
    videoTags: [],
    followedUps: [],
    syncMeta: {},
    ai: {},
  });
}

test("zero-item remote favorites are materialized locally", () => {
  const payload = runBackgroundScenario({
    exports: ["syncFromBilibiliToState"],
    setupSource: `
      globalThis.fetch = async (request) => {
        const url = String(request);
        const data = url.includes("/x/web-interface/nav")
          ? { isLogin: true, mid: 1 }
          : url.includes("/x/v3/fav/folder/created/list-all")
            ? { list: [{ id: 99, title: "Empty remote", media_count: 0 }] }
            : url.includes("/x/v3/fav/resource/list")
              ? { medias: [], has_more: false, info: { media_count: 0 } }
              : null;
        if (data === null) throw new Error("Unexpected URL: " + url);
        return new Response(JSON.stringify({ code: 0, data }), { status: 200 });
      };
    `,
    scenarioSource: `
      const state = ${emptyStateSource};
      const result = await syncFromBilibiliToState(state, {});
      return {
        foldersDetected: result.summary.foldersDetected,
        localFolders: state.folders.map((folder) => ({
          name: folder.name,
          remoteMediaId: folder.remoteMediaId,
        })),
      };
    `,
  });

  assert.equal(payload.result.foldersDetected, 1);
  assert.deepEqual(payload.result.localFolders, [{
    name: "Empty remote",
    remoteMediaId: 99,
  }]);
});

test("missing BV identities resolve through the view endpoint when aid is available", () => {
  const payload = runBackgroundScenario({
    exports: ["syncFromBilibiliToState"],
    setupSource: `
      globalThis.__viewRequests = 0;
      globalThis.fetch = async (request) => {
        const url = String(request);
        let data;
        if (url.includes("/x/web-interface/nav")) {
          data = { isLogin: true, mid: 1 };
        } else if (url.includes("/x/v3/fav/folder/created/list-all")) {
          data = { list: [{ id: 99, title: "Remote", media_count: 1 }] };
        } else if (url.includes("/x/v3/fav/resource/list")) {
          data = {
            medias: [{ id: 123, title: "Missing BV", upper: { name: "UP" } }],
            has_more: false,
            info: { media_count: 1 },
          };
        } else if (url.includes("/x/web-interface/view") && url.includes("aid=123")) {
          globalThis.__viewRequests += 1;
          data = { bvid: "BVRESOLVED123" };
        } else {
          throw new Error("Unexpected URL: " + url);
        }
        return new Response(JSON.stringify({ code: 0, data }), { status: 200 });
      };
    `,
    scenarioSource: `
      const state = ${emptyStateSource};
      const result = await syncFromBilibiliToState(state, {});
      return {
        viewRequests: globalThis.__viewRequests,
        bvids: state.videos.map((video) => video.bvid),
        unresolved: result.unresolvedItems,
      };
    `,
  });

  assert.equal(payload.result.viewRequests, 1);
  assert.deepEqual(payload.result.bvids, ["BVRESOLVED123"]);
  assert.deepEqual(payload.result.unresolved, []);
});

test("unresolved identities are reported and block destructive reconciliation", () => {
  const payload = runBackgroundScenario({
    exports: ["syncFromBilibiliToState"],
    setupSource: `
      globalThis.fetch = async (request) => {
        const url = String(request);
        const data = url.includes("/x/web-interface/nav")
          ? { isLogin: true, mid: 1 }
          : url.includes("/x/v3/fav/folder/created/list-all")
            ? { list: [{ id: 99, title: "Remote", media_count: 1 }] }
            : url.includes("/x/v3/fav/resource/list")
              ? {
                  medias: [{ title: "No identity" }],
                  has_more: false,
                  info: { media_count: 1 },
                }
              : null;
        if (data === null) throw new Error("Unexpected URL: " + url);
        return new Response(JSON.stringify({ code: 0, data }), { status: 200 });
      };
    `,
    scenarioSource: `
      const state = ${existingFolderStateSource(["BVKEEP"])};
      const result = await syncFromBilibiliToState(state, {
        selectedRemoteFolderIds: [99],
      });
      return {
        relationCount: state.folderItems.length,
        unresolved: result.unresolvedItems,
        incomplete: result.incompleteFolders,
      };
    `,
  });

  assert.equal(payload.result.relationCount, 1);
  assert.equal(payload.result.unresolved.length, 1);
  assert.equal(payload.result.unresolved[0].title, "No identity");
  assert.equal(payload.result.incomplete.length, 1);
});

test("a truncated final page is incomplete and removes no local relationship", () => {
  const payload = runBackgroundScenario({
    exports: ["syncFromBilibiliToState"],
    setupSource: `
      globalThis.fetch = async (request) => {
        const url = String(request);
        let data;
        if (url.includes("/x/web-interface/nav")) {
          data = { isLogin: true, mid: 1 };
        } else if (url.includes("/x/v3/fav/folder/created/list-all")) {
          data = { list: [{ id: 99, title: "Remote", media_count: 2 }] };
        } else if (url.includes("/x/v3/fav/resource/list")) {
          data = {
            medias: [{ bvid: "BVKEEP", title: "Keep", upper: { name: "UP" } }],
            has_more: false,
            info: { media_count: 2 },
          };
        } else {
          throw new Error("Unexpected URL: " + url);
        }
        return new Response(JSON.stringify({ code: 0, data }), { status: 200 });
      };
    `,
    scenarioSource: `
      const state = ${existingFolderStateSource(["BVKEEP", "BVLOCALONLY"])};
      const result = await syncFromBilibiliToState(state, {
        selectedRemoteFolderIds: [99],
      });
      return {
        relationCount: state.folderItems.length,
        incomplete: result.incompleteFolders,
        removed: result.summary.folderLinksRemoved,
      };
    `,
  });

  assert.equal(payload.result.relationCount, 2);
  assert.equal(payload.result.incomplete.length, 1);
  assert.equal(payload.result.incomplete[0].expected, 2);
  assert.equal(payload.result.incomplete[0].observed, 1);
  assert.equal(payload.result.removed, 0);
});

test("risk-blocked scans preserve every pre-existing local relationship", () => {
  const payload = runBackgroundScenario({
    exports: ["syncFromBilibiliToState"],
    setupSource: `
      globalThis.fetch = async (request) => {
        const url = String(request);
        if (url.includes("/x/web-interface/nav")) {
          return new Response(JSON.stringify({
            code: 0,
            data: { isLogin: true, mid: 1 },
          }), { status: 200 });
        }
        if (url.includes("/x/v3/fav/folder/created/list-all")) {
          return new Response(JSON.stringify({
            code: 0,
            data: { list: [{ id: 99, title: "Remote", media_count: 1 }] },
          }), { status: 200 });
        }
        if (url.includes("/x/v3/fav/resource/list")) {
          return new Response(JSON.stringify({ code: -412, message: "risk" }), {
            status: 412,
          });
        }
        throw new Error("Unexpected URL: " + url);
      };
    `,
    scenarioSource: `
      const state = ${existingFolderStateSource(["BVKEEP"])};
      const result = await syncFromBilibiliToState(state, {
        selectedRemoteFolderIds: [99],
      });
      return {
        relationCount: state.folderItems.length,
        riskBlocked: result.riskBlocked,
        removed: result.summary.folderLinksRemoved,
      };
    `,
  });

  assert.equal(payload.result.riskBlocked, true);
  assert.equal(payload.result.relationCount, 1);
  assert.equal(payload.result.removed, 0);
});

test("a local relationship is removed only after two complete remote omissions", () => {
  const payload = runBackgroundScenario({
    exports: ["syncFromBilibiliToState"],
    setupSource: `
      globalThis.fetch = async (request) => {
        const url = String(request);
        const data = url.includes("/x/web-interface/nav")
          ? { isLogin: true, mid: 1 }
          : url.includes("/x/v3/fav/folder/created/list-all")
            ? { list: [{ id: 99, title: "Remote", media_count: 0 }] }
            : url.includes("/x/v3/fav/resource/list")
              ? { medias: [], has_more: false, info: { media_count: 0 } }
              : null;
        if (data === null) throw new Error("Unexpected URL: " + url);
        return new Response(JSON.stringify({ code: 0, data }), { status: 200 });
      };
    `,
    scenarioSource: `
      const state = ${existingFolderStateSource(["BVOMITTED"])};
      const first = await syncFromBilibiliToState(state, {
        selectedRemoteFolderIds: [99],
      });
      const afterFirst = state.folderItems.length;
      const candidatesAfterFirst =
        state.syncMeta.favoritesJob.deletionCandidatesByFolder["99"];
      const second = await syncFromBilibiliToState(state, {
        selectedRemoteFolderIds: [99],
      });
      return {
        afterFirst,
        afterSecond: state.folderItems.length,
        candidatesAfterFirst,
        firstRemoved: first.summary.folderLinksRemoved,
        secondRemoved: second.summary.folderLinksRemoved,
      };
    `,
  });

  assert.equal(payload.result.afterFirst, 1);
  assert.deepEqual(payload.result.candidatesAfterFirst, ["bvomitted"]);
  assert.equal(payload.result.firstRemoved, 0);
  assert.equal(payload.result.afterSecond, 0);
  assert.equal(payload.result.secondRemoved, 1);
});
