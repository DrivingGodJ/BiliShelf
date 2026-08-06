import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(__dirname, "..", "src");
const readSource = (...parts) => readFile(path.join(srcRoot, ...parts), "utf8");

test("article favorites have a paged manager route, panel, and navigation action", async () => {
  const [router, app, header, panel, api] = await Promise.all([
    readSource("router", "index.ts"),
    readSource("App.vue"),
    readSource("components", "layout", "ManagerHeader.vue"),
    readSource("components", "panels", "FavoriteArticlesPanel.vue"),
    readSource("lib", "api.ts"),
  ]);

  assert.match(router, /path: "\/articles"/);
  assert.match(app, /const articlesMode = computed\(\(\) => route\.name === "articles"\)/);
  assert.match(app, /v-else-if="articlesMode"/);
  assert.match(app, /<FavoriteArticlesPanel/);
  assert.match(header, /emit\('open-articles'\)/);
  assert.match(header, /header\.articles/);
  assert.match(panel, /articles\.title/);
  assert.doesNotMatch(panel, /articles\.classify/);
  assert.doesNotMatch(panel, /update-folders|toggleArticleFolder|Checkbox/);
  assert.doesNotMatch(app, /@update-folders="updateArticleFolders"/);
  assert.match(app, /const articleFolders = ref<ArticleFolder\[\]>\(\[\]\)/);
  assert.match(app, /articlesMode\.value \? articleFolders\.value : folders\.value/);
  assert.match(app, /fetchArticleFolders/);
  assert.match(app, /createArticleFolder/);
  assert.match(app, /deleteArticleFolder/);
  assert.match(app, /folderId: selectedFolderId\.value/);
  assert.match(panel, /article\.savedAt/);
  assert.match(panel, /article\.sourceUrl/);
  assert.match(panel, /emit\('delete', article\)/);
  assert.match(api, /export async function fetchFavoriteArticles/);
  assert.match(api, /export async function deleteFavoriteArticle/);
  assert.match(api, /export async function fetchArticleFolders/);
  assert.match(api, /export async function createArticleFolder/);
  assert.match(api, /export async function reorderArticleFolders/);
});

test("manager header groups article, comment, following-up, and data actions", async () => {
  const [header, i18n] = await Promise.all([
    readSource("components", "layout", "ManagerHeader.vue"),
    readSource("lib", "manager-i18n.ts"),
  ]);

  assert.match(header, /header\.groupContent/);
  assert.match(header, /header\.groupData/);
  assert.match(header, /header\.groupTools/);
  assert.match(header, /open-following-ups/);
  assert.match(header, /open-comments/);
  assert.match(header, /open-articles/);
  assert.match(header, /open-webdav-settings/);
  assert.match(header, /sync-import/);
  assert.match(i18n, /"header\.articles"/);
  assert.match(i18n, /"header\.groupContent"/);
  assert.match(i18n, /"header\.groupData"/);
  assert.match(i18n, /"header\.groupTools"/);
  assert.match(header, /\.action-group-content,[\s\S]*\.action-group-data,[\s\S]*\.action-group-tools/);
  assert.match(header, /background: hsl\(var\(--card\) \/ 0\.58\)/);
  assert.match(header, /header\.exportCsvWarningTitle/);
  assert.match(header, /header\.exportCsvWarningDescription/);
  assert.match(i18n, /CSV 不会导出关注 UP、评论收藏、专栏收藏、专栏文件夹及其关系/);
});

test("settings stay top-anchored and following-up search stays right-aligned", async () => {
  const [settings, following] = await Promise.all([
    readSource("components", "dialogs", "AiSettingsDialog.vue"),
    readSource("components", "panels", "FollowingUpPanel.vue"),
  ]);

  assert.match(settings, /top-\[6dvh\][^\"]*translate-y-0/);
  assert.match(following, /class="relative ml-auto w-full max-w-sm"/);
});
