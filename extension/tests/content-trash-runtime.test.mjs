import test from "node:test";
import assert from "node:assert/strict";

import { runBackgroundScenario } from "./helpers/background-runtime-harness.mjs";

test("comment trash preserves images and supports restore and permanent deletion", () => {
  const result = runBackgroundScenario({
    exports: [
      "moveFavoriteCommentToTrash",
      "restoreFavoriteCommentFromTrash",
      "purgeFavoriteCommentFromTrash",
      "queryFavoriteComments",
    ],
    scenarioSource: `
      const state = {
        comments: [{
          id: 8,
          sourceKey: "rpid:888",
          rpid: "888",
          rootRpid: "888",
          bvid: "BV1COMMENT",
          videoTitle: "Source",
          videoUrl: "https://www.bilibili.com/video/BV1COMMENT/",
          sourceUrl: "https://www.bilibili.com/video/BV1COMMENT/#reply888",
          content: "image comment",
          contentImageUrls: ["https://i0.hdslb.com/comment.png"],
          authorName: "Author",
          authorMid: "42",
          authorAvatarUrl: "",
          authorSpaceUrl: "",
          replyToName: "",
          likeCount: 0,
          publishedAt: null,
          publishedAtText: "",
          savedAt: 100,
          updatedAt: 100,
          deletedAt: null,
        }],
      };
      const moved = moveFavoriteCommentToTrash(state, 8, 200);
      const activeWhileDeleted = queryFavoriteComments(state, new URLSearchParams("page=1&pageSize=20"));
      const snapshot = structuredClone(state.comments[0]);
      const restored = restoreFavoriteCommentFromTrash(state, 8, 300);
      const activeAfterRestore = queryFavoriteComments(state, new URLSearchParams("page=1&pageSize=20"));
      moveFavoriteCommentToTrash(state, 8, 400);
      const purged = purgeFavoriteCommentFromTrash(state, 8);
      return { moved, activeWhileDeleted, snapshot, restored, activeAfterRestore, purged, remaining: state.comments.length };
    `,
  }).result;

  assert.equal(result.moved, true);
  assert.equal(result.activeWhileDeleted.pagination.total, 0);
  assert.deepEqual(result.snapshot.contentImageUrls, ["https://i0.hdslb.com/comment.png"]);
  assert.equal(result.restored, true);
  assert.equal(result.activeAfterRestore.pagination.total, 1);
  assert.equal(result.purged, true);
  assert.equal(result.remaining, 0);
});

test("article trash preserves its folder relationships through restore", () => {
  const result = runBackgroundScenario({
    exports: [
      "moveFavoriteArticleToTrash",
      "restoreFavoriteArticleFromTrash",
      "purgeFavoriteArticleFromTrash",
      "queryFavoriteArticles",
    ],
    scenarioSource: `
      const state = {
        articles: [{
          id: 5,
          sourceKey: "opus:555",
          opusId: "555",
          title: "Article",
          summary: "Summary",
          content: "Content",
          coverUrl: "https://i0.hdslb.com/cover.png",
          authorName: "Author",
          authorMid: "42",
          authorAvatarUrl: "",
          sourceUrl: "https://www.bilibili.com/opus/555",
          folderIds: [2, 3],
          savedAt: 100,
          updatedAt: 100,
          deletedAt: null,
        }],
      };
      const moved = moveFavoriteArticleToTrash(state, 5, 200);
      const activeWhileDeleted = queryFavoriteArticles(state, new URLSearchParams("page=1&pageSize=20"));
      const foldersWhileDeleted = [...state.articles[0].folderIds];
      const restored = restoreFavoriteArticleFromTrash(state, 5, 300);
      const activeAfterRestore = queryFavoriteArticles(state, new URLSearchParams("page=1&pageSize=20"));
      const foldersAfterRestore = [...state.articles[0].folderIds];
      moveFavoriteArticleToTrash(state, 5, 400);
      const purged = purgeFavoriteArticleFromTrash(state, 5);
      return { moved, activeWhileDeleted, foldersWhileDeleted, restored, activeAfterRestore, foldersAfterRestore, purged, remaining: state.articles.length };
    `,
  }).result;

  assert.equal(result.moved, true);
  assert.equal(result.activeWhileDeleted.pagination.total, 0);
  assert.deepEqual(result.foldersWhileDeleted, [2, 3]);
  assert.equal(result.restored, true);
  assert.equal(result.activeAfterRestore.pagination.total, 1);
  assert.deepEqual(result.foldersAfterRestore, [2, 3]);
  assert.equal(result.purged, true);
  assert.equal(result.remaining, 0);
});

test("trashed articles do not inflate active article folder counts", () => {
  const result = runBackgroundScenario({
    exports: ["listActiveArticleFoldersWithCounts"],
    scenarioSource: `
      const state = {
        articleFolders: [{
          id: 2,
          name: "Reading",
          description: null,
          sortOrder: 1,
          deletedAt: null,
          createdAt: 1,
          updatedAt: 1,
        }],
        articles: [
          { id: 1, folderIds: [2], deletedAt: null },
          { id: 2, folderIds: [2], deletedAt: 200 },
        ],
      };
      return listActiveArticleFoldersWithCounts(state);
    `,
  }).result;

  assert.equal(result.length, 1);
  assert.equal(result[0].itemCount, 1);
});
