import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(__dirname, "..", "src");

const readSource = (...parts) => readFile(path.join(srcRoot, ...parts), "utf8");

test("desktop manager gives folders and results independent scroll containers", async () => {
  const [app, navigation, sidebar] = await Promise.all([
    readSource("App.vue"),
    readSource("components", "layout", "ManagerFolderNavigation.vue"),
    readSource("components", "FolderSidebar.vue"),
  ]);

  assert.match(app, /lg:h-\[100dvh\]/);
  assert.match(app, /lg:overflow-hidden/);
  assert.match(app, /<section class="min-w-0 space-y-4 lg:h-full lg:min-h-0 lg:overflow-y-auto/);
  assert.match(navigation, /lg:h-full lg:overflow-hidden/);
  assert.match(sidebar, /class="mt-3 min-h-0 flex-1 overflow-y-auto/);
});

test("folder entries use compact explorer rows and retain edit and delete actions", async () => {
  const source = await readSource("components", "FolderSidebar.vue");

  assert.match(source, /class="group flex min-h-9 items-center gap-1 rounded-md px-1/);
  assert.match(source, /class="h-7 w-7 shrink-0"/);
  assert.match(source, /class="h-7 w-7 shrink-0 text-red-500"/);
  assert.doesNotMatch(source, /line-clamp-2 text-xs text-muted-foreground/);
});

test("keyword search exposes global and current-folder scopes without reading backup text", async () => {
  const [store, searchBar, query] = await Promise.all([
    readSource("stores", "library.ts"),
    readSource("components", "SearchBar.vue"),
    readSource("lib", "manager-query.ts"),
  ]);

  assert.match(store, /export type SearchScope = "all" \| "folder";/);
  assert.match(store, /const searchScope = ref<SearchScope>\("all"\);/);
  assert.match(store, /searchScope\.value === "all"/);
  assert.match(searchBar, /value="all"/);
  assert.match(searchBar, /value="folder"/);
  assert.match(query, /query\.scope = "folder"/);
  assert.doesNotMatch(store, /FileReader|backup/i);
});

test("video card width is adjustable, persisted, and drives an auto-fill grid", async () => {
  const [uiStore, panel, grid] = await Promise.all([
    readSource("stores", "app-ui.ts"),
    readSource("components", "panels", "ManagerPanel.vue"),
    readSource("components", "VideoGrid.vue"),
  ]);

  assert.match(uiStore, /bili-like-video-card-width/);
  assert.match(uiStore, /value === null \|\| value === undefined/);
  assert.match(uiStore, /function setVideoCardWidth/);
  assert.match(panel, /type="range"/);
  assert.match(panel, /update:videoCardWidth/);
  assert.match(grid, /--video-card-width/);
  assert.match(grid, /repeat\(auto-fill, minmax\(min\(100%, var\(--video-card-width\)\), 1fr\)\)/);
});
