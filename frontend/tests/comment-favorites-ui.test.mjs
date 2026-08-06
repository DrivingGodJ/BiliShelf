import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(__dirname, "..", "src");
const readSource = (...parts) => readFile(path.join(srcRoot, ...parts), "utf8");

test("manager exposes a responsive saved-comment route and navigation entry", async () => {
  const [router, app, header, panel] = await Promise.all([
    readSource("router", "index.ts"),
    readSource("App.vue"),
    readSource("components", "layout", "ManagerHeader.vue"),
    readSource("components", "panels", "CommentsPanel.vue"),
  ]);

  assert.match(router, /path: "\/comments"/);
  assert.match(app, /const commentsMode = computed\(\(\) => route\.name === "comments"\)/);
  assert.match(app, /v-else-if="commentsMode"/);
  assert.match(app, /v-if="!followingUpsMode && !commentsMode"/);
  assert.match(header, /emit\('open-comments'\)/);
  assert.match(panel, /content-card-grid items-start/);
  assert.match(panel, /--content-card-width/);
  assert.match(panel, /emit\("change-page"/);
  assert.match(panel, /comment\.sourceUrl/);
  assert.match(panel, /class="ml-auto flex w-full max-w-2xl gap-2"/);
  assert.match(panel, /comments\.savedAt/);
  assert.match(panel, /comment\.contentImageUrls/);
  assert.match(panel, /object-contain/);
  assert.match(panel, /function commentSourceUrl\(comment: FavoriteComment\)/);
  assert.match(panel, /url\.hash = `reply\$\{rpid \|\| rootRpid\}`/);
  assert.doesNotMatch(panel, /comment\.authorAvatarUrl/);
  assert.doesNotMatch(panel, /comment\.authorName/);
  assert.doesNotMatch(panel, /comment\.publishedAt/);
  assert.doesNotMatch(panel, /comment\.replyToName/);
  assert.doesNotMatch(panel, /comment\.likeCount/);
});

test("empty saved-comment view tells users where the Bilibili action lives", async () => {
  const i18n = await readSource("lib", "manager-i18n.ts");

  assert.match(i18n, /评论操作栏中的“收藏评论”/);
});

test("saved-comment manager uses paged API search and explicit local deletion", async () => {
  const [api, app] = await Promise.all([
    readSource("lib", "api.ts"),
    readSource("App.vue"),
  ]);

  assert.match(api, /export async function fetchFavoriteComments/);
  assert.match(api, /params\.set\("page",/);
  assert.match(api, /params\.set\("pageSize",/);
  assert.match(api, /export async function deleteFavoriteComment/);
  assert.match(app, /async function loadFavoriteComments\(\)/);
  assert.match(app, /await deleteFavoriteComment\(comment\.id\)/);
  assert.match(app, /comments\.deleteDescription/);
});
