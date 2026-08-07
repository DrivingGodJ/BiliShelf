import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(__dirname, "..", "src");
const readSource = (...parts) => readFile(path.join(srcRoot, ...parts), "utf8");

test("trash manager separates folders, videos, comments, and articles", async () => {
  const [panel, app, store, api] = await Promise.all([
    readSource("components", "panels", "TrashPanel.vue"),
    readSource("App.vue"),
    readSource("stores", "library.ts"),
    readSource("lib", "api.ts"),
  ]);

  for (const tab of ["folders", "videos", "comments", "articles"]) {
    assert.match(panel, new RegExp(`TabsTrigger value="${tab}"`));
    assert.match(panel, new RegExp(`TabsContent value="${tab}"`));
  }
  assert.match(app, /:trash-comments="trashComments"/);
  assert.match(app, /:trash-articles="trashArticles"/);
  assert.match(app, /@restore-comment-from-trash="handleRestoreCommentFromTrash"/);
  assert.match(app, /@purge-article-from-trash="handlePurgeArticleFromTrash"/);
  assert.match(store, /fetchTrashComments/);
  assert.match(store, /fetchTrashArticles/);
  assert.match(api, /export async function restoreTrashComment/);
  assert.match(api, /export async function purgeTrashArticle/);
});

test("video, comment, and article layouts use independent card widths", async () => {
  const [app, comments, articles, settings, i18n] = await Promise.all([
    readSource("App.vue"),
    readSource("components", "panels", "CommentsPanel.vue"),
    readSource("components", "panels", "FavoriteArticlesPanel.vue"),
    readSource("components", "dialogs", "AiSettingsDialog.vue"),
    readSource("lib", "manager-i18n.ts"),
  ]);

  assert.match(app, /:card-width="commentCardWidth"/);
  assert.match(app, /:card-width="articleCardWidth"/);
  assert.match(comments, /cardWidth: number/);
  assert.match(articles, /cardWidth: number/);
  assert.match(comments, /--content-card-width/);
  assert.match(articles, /--content-card-width/);
  assert.match(comments, /repeat\(\s*auto-fit,/);
  assert.match(articles, /repeat\(\s*auto-fit,/);
  assert.match(comments, /minmax\(min\(100%, var\(--content-card-width\)\), 1fr\)/);
  assert.match(articles, /minmax\(min\(100%, var\(--content-card-width\)\), 1fr\)/);
  assert.match(comments, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(articles, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(settings, /localVideoCardWidth/);
  assert.match(i18n, /分别调整卡片宽度/);
});

test("image comments do not stretch neighboring comment cards", async () => {
  const comments = await readSource("components", "panels", "CommentsPanel.vue");

  assert.match(comments, /content-card-grid items-start/);
  assert.match(comments, /align-items: start/);
  assert.match(comments, /comment\.contentImageUrls\.length === 1 \? 'h-52'/);
  assert.doesNotMatch(comments, /class="flex aspect-\[4\/3\]/);
});
