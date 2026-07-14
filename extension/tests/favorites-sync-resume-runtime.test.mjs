import test from "node:test";
import assert from "node:assert/strict";

import { runBackgroundScenario } from "./helpers/background-runtime-harness.mjs";

test("resuming after a 412 preserves relationships imported on earlier pages", () => {
  const payload = runBackgroundScenario({
    exports: ["syncFromBilibiliToState"],
    setupSource: `
      globalThis.__syncPhase = 1;
      const media = (bvid, title) => ({
        bvid,
        title,
        cover: "",
        upper: { name: "UP" },
        intro: "",
        link: "",
        fav_time: 200,
        pubtime: 100,
      });
      const pageOne = [media("BVPAGE1A", "Page 1 A"), media("BVPAGE1B", "Page 1 B")];
      const pageTwo = [media("BVPAGE2A", "Page 2 A"), media("BVPAGE2B", "Page 2 B")];
      globalThis.fetch = async (request) => {
        const url = String(request);
        let data;
        if (url.includes("/x/web-interface/nav")) {
          data = { isLogin: true, mid: 1 };
        } else if (url.includes("/x/v3/fav/folder/created/list-all")) {
          data = { list: [{ id: 99, title: "Remote", media_count: 4 }] };
        } else if (url.includes("/x/v3/fav/resource/list")) {
          const page = Number(url.match(/[?&]pn=(\\d+)/)?.[1] || 1);
          if (globalThis.__syncPhase === 1 && page === 2) {
            return new Response(JSON.stringify({ code: -412, message: "risk" }), { status: 412 });
          }
          data = {
            medias: page === 1 ? pageOne : pageTwo,
            has_more: globalThis.__syncPhase === 1 && page === 1,
            info: { media_count: 4 },
          };
        } else {
          throw new Error("Unexpected URL: " + url);
        }
        return new Response(JSON.stringify({ code: 0, data }), { status: 200 });
      };
    `,
    scenarioSource: `
      const state = {
        counters: { folder: 1, video: 1, folderItem: 1, tag: 1, videoTag: 1 },
        folders: [],
        videos: [],
        folderItems: [],
        tags: [],
        videoTags: [],
        followedUps: [],
        syncMeta: {},
        ai: {},
      };
      const first = await syncFromBilibiliToState(state, {
        selectedRemoteFolderIds: [99],
      });
      globalThis.__syncPhase = 2;
      const second = await syncFromBilibiliToState(state, {
        selectedRemoteFolderIds: [99],
        resumePageByFolder: first.resumePageByFolder,
      });
      const activeBvids = state.folderItems
        .map((item) => state.videos.find((video) => video.id === item.videoId)?.bvid)
        .filter(Boolean)
        .sort();
      return {
        firstRiskBlocked: first.riskBlocked,
        firstResume: first.resumePageByFolder,
        secondRiskBlocked: second.riskBlocked,
        activeBvids,
      };
    `,
  });

  assert.equal(payload.result.firstRiskBlocked, true);
  assert.deepEqual(payload.result.firstResume, { 99: 2 });
  assert.equal(payload.result.secondRiskBlocked, false);
  assert.deepEqual(payload.result.activeBvids, [
    "BVPAGE1A",
    "BVPAGE1B",
    "BVPAGE2A",
    "BVPAGE2B",
  ]);
});
