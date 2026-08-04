import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(__dirname, "..", "src");

const readSource = (...parts) => readFile(path.join(srcRoot, ...parts), "utf8");

test("manager folder navigation switches from desktop sidebar to an accessible mobile drawer", async () => {
  const [navigation, mobileBar, app] = await Promise.all([
    readSource("components", "layout", "ManagerFolderNavigation.vue"),
    readSource("components", "layout", "MobileManagerBar.vue"),
    readSource("App.vue"),
  ]);

  assert.match(
    navigation,
    /class="hidden min-h-0 lg:block[^\"]*lg:h-full[^\"]*lg:overflow-hidden"/,
  );
  assert.match(navigation, /class="lg:hidden"/);
  assert.match(navigation, /<Dialog :open="drawerOpen"/);
  assert.match(navigation, /<DialogDescription>/);
  assert.match(navigation, /left-0 top-0 h-\[100dvh\]/);
  assert.match(navigation, /sticky top-2 z-40/);
  assert.match(navigation, /function handleMobileSelect\(/);
  assert.match(navigation, /drawerOpen\.value = false;/);
  assert.match(mobileBar, /activeFolderName/);
  assert.match(mobileBar, /resultCount/);
  assert.match(mobileBar, /class="h-11/);
  assert.match(app, /<ManagerFolderNavigation/);
  assert.doesNotMatch(app, /<FolderSidebar/);
});

test("mobile scope bar keeps folder scope and result count ahead of the video list", async () => {
  const [mobileBar, app] = await Promise.all([
    readSource("components", "layout", "MobileManagerBar.vue"),
    readSource("App.vue"),
  ]);

  assert.match(mobileBar, /mobile\.browseFolders/);
  assert.match(mobileBar, /mobile\.resultCount/);
  const navigationIndex = app.indexOf("<ManagerFolderNavigation");
  const headerIndex = app.indexOf("<ManagerHeader");
  const panelIndex = app.indexOf("<ManagerPanel");
  assert.ok(navigationIndex >= 0 && navigationIndex < headerIndex);
  assert.ok(headerIndex < panelIndex);
});

test("manager header compacts secondary actions behind a mobile More control", async () => {
  const source = await readSource("components", "layout", "ManagerHeader.vue");

  assert.match(source, /const mobileActionsOpen = ref\(false\);/);
  assert.match(source, /class="mt-3 grid grid-cols-2 gap-2 md:hidden"/);
  assert.match(source, /header\.moreActions/);
  assert.match(source, /class="desktop-action-grid/);
  assert.match(source, /hidden line-clamp-1 text-sm text-muted-foreground md:block/);
  assert.match(source, /@media \(max-width: 767px\)/);
});

test("mobile filters use progressive disclosure so video content reaches the first viewport", async () => {
  const [searchBar, panel] = await Promise.all([
    readSource("components", "SearchBar.vue"),
    readSource("components", "panels", "ManagerPanel.vue"),
  ]);

  assert.match(searchBar, /const mobileFiltersOpen = ref\(false\);/);
  assert.match(searchBar, /:aria-expanded="mobileFiltersOpen"/);
  assert.match(searchBar, /mobileFiltersOpen \? 'block' : 'hidden md:block'/);
  assert.match(panel, /const mobileDateFiltersOpen = ref\(false\);/);
  assert.match(panel, /:aria-expanded="mobileDateFiltersOpen"/);
  assert.match(panel, /v-if="mobileDateFiltersOpen"/);
});

test("mobile pagination is sticky, touch-sized, and safe-area aware", async () => {
  const source = await readSource("components", "panels", "ManagerPanel.vue");

  assert.match(source, /manager-pagination/);
  assert.match(source, /sticky bottom-0 z-30/);
  assert.match(source, /pb-\[calc\(0\.75rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(source, /md:static/);
  assert.match(source, /min-h-11/);
});

test("mobile manager copy is localized in Chinese and English", async () => {
  const source = await readSource("lib", "manager-i18n.ts");

  for (const key of [
    "mobile.browseFolders",
    "mobile.allVideos",
    "mobile.resultCount",
    "mobile.folderDrawerTitle",
    "mobile.folderDrawerDescription",
    "header.moreActions",
  ]) {
    assert.match(source, new RegExp(`"${key}"`));
  }
});
