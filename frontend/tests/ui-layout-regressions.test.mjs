import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function readComponentSource(relativePath) {
  const fullPath = path.resolve(__dirname, "..", "src", ...relativePath);
  const source = await readFile(fullPath, "utf8");
  return source.replace(/\r\n/g, "\n");
}

test("manager header exposes one settings gear and one combined data entry", async () => {
  const source = await readComponentSource(["components", "layout", "ManagerHeader.vue"]);

  assert.equal((source.match(/@click="emit\('open-settings'\)"/g) ?? []).length, 1);
  assert.match(source, /<Settings class="h-4 w-4"/);
  assert.match(source, /props\.t\("header\.dataTransfer"\)/);
  assert.match(source, /function chooseDataAction\(action: "import" \| "export"\)/);
  assert.match(source, /function exportData\(format: "json" \| "csv"\)/);
  assert.match(source, /@click="emit\('open-webdav-settings'\)"/);
  assert.doesNotMatch(source, /chooseDataAction\('webdav'\)|exportData\('webdav'\)/);
  assert.doesNotMatch(source, /toggle-locale|toggle-theme|open-ai-settings|open-sync-settings/);
});

test("manager header accent spans the full width and desktop date fields stay compact", async () => {
  const [style, panel] = await Promise.all([
    readComponentSource(["style.css"]),
    readComponentSource(["components", "panels", "ManagerPanel.vue"]),
  ]);

  assert.match(style, /\.hero-surface::before \{[\s\S]*?width: 100%;/);
  assert.match(style, /\.hero-surface::after \{\s*content: none;/);
  assert.equal((panel.match(/w-\[168px\] min-w-\[168px\]/g) ?? []).length, 4);
  assert.doesNotMatch(panel, /min-w-\[190px\]/);
});

test("manager header labels the Bilibili synchronization action explicitly", async () => {
  const [source, i18n] = await Promise.all([
    readComponentSource(["components", "layout", "ManagerHeader.vue"]),
    readComponentSource(["lib", "manager-i18n.ts"]),
  ]);

  assert.match(source, /@click="emit\('sync-import'\)"/);
  assert.match(i18n, /"header\.syncImport": \{ "zh-CN": "同步 B 站"/);
});

test("manager header keeps the following-up action visually aligned with peer outline buttons", async () => {
  const source = await readComponentSource(["components", "layout", "ManagerHeader.vue"]);

  assert.match(
    source,
    /<Button\s+size="sm"\s+variant="outline"\s+:class="topActionButtonClass"\s+@click="emit\('open-following-ups'\)"\s*>[\s\S]*\{\{\s*props\.t\("header\.followingUps"\)\s*\}\}/s,
  );
});

test("manager header uses one active return action outside manager mode", async () => {
  const source = await readComponentSource(["components", "layout", "ManagerHeader.vue"]);

  assert.match(
    source,
    /const activeViewButtonClass\s*=\s*"[^"]*border-primary\/35[^"]*bg-primary\/12[^"]*text-primary[^"]*shadow/,
  );
  assert.match(source, /<div v-else class="desktop-action-grid mt-4 flex justify-start md:justify-end">/);
  assert.match(source, /props\.followingUpsMode \? emit\('open-following-ups'\) : props\.commentsMode \? emit\('open-comments'\) : props\.articlesMode \? emit\('open-articles'\) : emit\('toggle-trash'\)/);
});

test("unified settings navigates AI, listener, language, theme, and card size", async () => {
  const source = await readComponentSource(["components", "dialogs", "AiSettingsDialog.vue"]);

  for (const value of ["ai", "listener", "language", "theme", "cards"]) {
    assert.match(source, new RegExp(`value="${value}"`));
  }
  assert.match(source, /emit\('setLocale'/);
  assert.match(source, /emit\('setTheme'/);
  assert.match(source, /emit\("setVideoCardWidth", Number\(normalized\)\)/);
  assert.match(source, /emit\("setCommentCardWidth", Number\(normalized\)\)/);
  assert.match(source, /emit\("setArticleCardWidth", Number\(normalized\)\)/);
});

test("manager header and app remove the AI placeholder entry wiring", async () => {
  const [headerSource, appSource, i18nSource] = await Promise.all([
    readComponentSource(["components", "layout", "ManagerHeader.vue"]),
    readComponentSource(["App.vue"]),
    readComponentSource(["lib", "manager-i18n.ts"]),
  ]);

  assert.doesNotMatch(headerSource, /open-ai-placeholder/);
  assert.doesNotMatch(appSource, /handleOpenAiPlaceholder/);
  assert.doesNotMatch(appSource, /toast\.comingSoon/);
  assert.doesNotMatch(i18nSource, /header\.aiPlaceholder/);
  assert.doesNotMatch(i18nSource, /toast\.comingSoon/);
});

test("ai organizer uses the robot icon across the header, dialog, and status bar", async () => {
  const [header, dialog, statusBar] = await Promise.all([
    readComponentSource(["components", "layout", "ManagerHeader.vue"]),
    readComponentSource(["components", "dialogs", "AiOrganizerDialog.vue"]),
    readComponentSource(["components", "AiOrganizerStatusBar.vue"]),
  ]);

  assert.doesNotMatch(header, /Sparkles/);
  assert.doesNotMatch(dialog, /Sparkles/);
  assert.doesNotMatch(statusBar, /Sparkles/);
  assert.match(header, /@click="emit\('open-ai-organizer'\)"[\s\S]*?<Bot/s);
  assert.match(dialog, /<Bot class="h-3\.5 w-3\.5" \/>[\s\S]*?ai\.organizer\.start/s);
  assert.match(statusBar, /<Bot v-else/);
});

test("ai organizer keeps overflowing content inside one bounded dialog scroller", async () => {
  const source = await readComponentSource([
    "components",
    "dialogs",
    "AiOrganizerDialog.vue",
  ]);

  assert.match(
    source,
    /DialogScrollContent[\s\S]*?max-h-\[calc\(100dvh-2rem\)\][\s\S]*?overflow-hidden p-0/s,
  );
  assert.match(source, /DialogHeader class="shrink-0 border-b/);
  assert.match(
    source,
    /<div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">/,
  );
  assert.match(source, /DialogFooter[\s\S]*?class="shrink-0 flex-row flex-wrap/s);
  assert.doesNotMatch(source, /max-h-(?:52|72)[^\"]*overflow-(?:auto|y-auto)/);
});

test("folder sidebar keeps ai actions above a scrollable folder list", async () => {
  const source = await readComponentSource(["components", "FolderSidebar.vue"]);
  const aiSectionIndex = source.indexOf('<section\n      v-if="props.showAiActions"');
  const folderListIndex = source.indexOf(
    '<div class="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">',
  );

  assert.notEqual(aiSectionIndex, -1);
  assert.notEqual(folderListIndex, -1);
  assert.ok(aiSectionIndex < folderListIndex);
  assert.match(source, /<aside class="panel-surface flex h-full min-h-0 flex-col p-4">/);
});

test("folder playback control is a compact single-row action", async () => {
  const source = await readComponentSource(["components", "FolderSidebar.vue"]);

  assert.match(source, /v-if="props\.showPlaybackActions"\s+class="mt-3 flex items-center gap-2 rounded-lg/);
  assert.match(source, /size="icon"[\s\S]*:aria-label="t\('playbackStart'\)"/s);
});

test("ai category browser no longer shows the temporary footer hint", async () => {
  const source = await readComponentSource(["components", "AiCategoryBrowser.vue"]);

  assert.doesNotMatch(source, /ai\.browser\.footerHint/);
  assert.doesNotMatch(source, /Sparkles/);
});

test("ai settings dialog removes the duplicated local-runtime description copy", async () => {
  const source = await readComponentSource(["components", "dialogs", "AiSettingsDialog.vue"]);

  assert.doesNotMatch(source, /DialogDescription/);
  assert.doesNotMatch(source, /ai\.settings\.desc/);
});

test("sync dialogs expose bulk-selection controls for folder queues", async () => {
  const syncSource = await readComponentSource(["components", "dialogs", "SyncImportDialog.vue"]);
  const autoInitSource = await readComponentSource([
    "components",
    "dialogs",
    "AutoInitSetupDialog.vue",
  ]);

  assert.match(syncSource, /t\("common\.selectAll"\)/);
  assert.match(syncSource, /t\("common\.clear"\)/);
  assert.match(autoInitSource, /t\("common\.selectAll"\)/);
  assert.match(autoInitSource, /t\("common\.clear"\)/);
});

test("manual sync dialog no longer renders the misleading chunk-size controls", async () => {
  const source = await readComponentSource(["components", "dialogs", "SyncImportDialog.vue"]);

  assert.doesNotMatch(source, /sync\.chunkSizeTitle/);
  assert.doesNotMatch(source, /sync\.autoChunkHint/);
});

test("webdav dialog keeps one description source and drops the duplicated helper row", async () => {
  const source = await readComponentSource(["components", "dialogs", "WebDavBackupDialog.vue"]);

  assert.equal((source.match(/t\("webdav\.desc"\)/g) ?? []).length, 1);
  assert.doesNotMatch(source, /ShieldCheck/);
});

test("following-up import dialog removes the redundant safety hint block", async () => {
  const source = await readComponentSource(["components", "dialogs", "FollowingUpImportDialog.vue"]);

  assert.doesNotMatch(source, /followingUps\.dialogReadHint/);
  assert.doesNotMatch(source, /followingUps\.dialogSaveHint/);
  assert.doesNotMatch(source, /followingUps\.dialogSafeHint/);
  assert.doesNotMatch(source, /ShieldCheck/);
});

test("sync settings dialog keeps one description source and drops the duplicated helper card", async () => {
  const source = await readComponentSource([
    "components",
    "dialogs",
    "BidirectionalSyncSettingsDialog.vue",
  ]);

  assert.equal((source.match(/t\("sync\.settings\.desc"\)/g) ?? []).length, 1);
  assert.doesNotMatch(source, /ShieldCheck/);
});

test("sync import dialog embeds an independently controllable stage 2 tag task", async () => {
  const source = await readComponentSource(["components", "dialogs", "SyncImportDialog.vue"]);

  assert.match(source, /TagEnrichmentStatusBar/);
  assert.match(source, /tagEnrichmentStatus/);
  assert.match(source, /tagEnrichmentLoading/);
  assert.match(source, /refresh-tag-enrichment/);
  assert.match(source, /start-tag-enrichment/);
  assert.match(source, /stop-tag-enrichment/);
  assert.match(source, /run-tag-enrichment/);
});

test("app passes the persistent stage 2 tag task wiring into the sync import dialog", async () => {
  const source = await readComponentSource(["App.vue"]);

  assert.match(source, /:tag-enrichment-status=/);
  assert.match(source, /:tag-enrichment-loading=/);
  assert.match(source, /@refresh-tag-enrichment=/);
  assert.match(source, /@start-tag-enrichment=/);
  assert.match(source, /@stop-tag-enrichment=/);
  assert.match(source, /@run-tag-enrichment=/);
});

test("app temporarily disables ai category entry points and background fetches", async () => {
  const source = await readComponentSource(["App.vue"]);

  assert.match(source, /const AI_CATEGORIES_ENABLED = false;/);
  assert.match(
    source,
    /:show-ai-actions="AI_CATEGORIES_ENABLED && EXTENSION_LOCAL_API_RUNTIME && !trashMode && !articlesMode"/,
  );
  assert.match(source, /:show-ai="AI_ORGANIZER_ENABLED \|\| AI_CATEGORIES_ENABLED"/);
  assert.match(
    source,
    /v-if="AI_CATEGORIES_ENABLED && !trashMode && !commentsMode && !articlesMode && aiCategoryBrowserOpen"/,
  );
  assert.match(
    source,
    /if \(\s*!AI_CATEGORIES_ENABLED\s*\|\|\s*!EXTENSION_LOCAL_API_RUNTIME\s*\|\|\s*trashMode\.value\s*\|\|\s*folderId === null\s*\) \{/s,
  );
});

test("manager toasts use structured copy and the shared BiliShelf status treatment", async () => {
  const [mainSource, toastSource, messageSource, styleSource] = await Promise.all([
    readComponentSource(["main.ts"]),
    readComponentSource(["composables", "use-app-toast.ts"]),
    readComponentSource(["components", "feedback", "AppToastMessage.vue"]),
    readComponentSource(["style.css"]),
  ]);

  assert.match(
    mainSource,
    /import "vue-toastification\/dist\/index\.css";\s*import "\.\/style\.css";/,
  );
  assert.match(toastSource, /component: AppToastMessage/);
  assert.match(toastSource, /toastClassName: "bilishelf-toast bilishelf-toast--success"/);
  assert.match(toastSource, /toastClassName: "bilishelf-toast bilishelf-toast--error"/);
  assert.doesNotMatch(toastSource, /✅|⚠️/);
  assert.match(messageSource, /CircleAlert/);
  assert.match(messageSource, /CircleCheck/);
  assert.match(styleSource, /border-left:\s*3px solid hsl\(var\(--toast-accent\)\)/);
  assert.match(styleSource, /\.app-toast-message__description/);
});
