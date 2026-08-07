import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");

const appPath = path.join(repoRoot, "frontend", "src", "App.vue");
const dialogPath = path.join(
  repoRoot,
  "frontend",
  "src",
  "components",
  "dialogs",
  "SyncImportDialog.vue",
);
const tagStatusPath = path.join(
  repoRoot,
  "frontend",
  "src",
  "components",
  "sync",
  "TagEnrichmentStatusBar.vue",
);
const favoritesStatusPath = path.join(
  repoRoot,
  "frontend",
  "src",
  "components",
  "sync",
  "FavoritesSyncStatusBar.vue",
);
const apiPath = path.join(repoRoot, "frontend", "src", "lib", "api.ts");
const typesPath = path.join(repoRoot, "frontend", "src", "types.ts");
const i18nPath = path.join(repoRoot, "frontend", "src", "lib", "manager-i18n.ts");
const headerPath = path.join(
  repoRoot,
  "frontend",
  "src",
  "components",
  "layout",
  "ManagerHeader.vue",
);
const backgroundPath = path.join(
  repoRoot,
  "extension",
  "entrypoints",
  "background.ts",
);

test("sync status contract exposes durable progress, retry, and diagnostics", async () => {
  const [api, types] = await Promise.all([
    readFile(apiPath, "utf8"),
    readFile(typesPath, "utf8"),
  ]);

  assert.match(api, /restart\?: boolean;/);
  assert.match(types, /phase: "idle" \| "running" \| "paused" \| "waiting"/);
  assert.match(types, /currentFolderRemoteId: number \| null;/);
  assert.match(types, /currentPage: number;/);
  assert.match(types, /nextRetryAt: number \| null;/);
  assert.match(types, /unresolvedItems: Array</);
  assert.match(types, /incompleteFolders: Array</);
  assert.match(types, /unavailableRemoteVideos: number;/);
  assert.match(types, /unavailableFolders: Array</);
});

test("sync dialog renders current work, counters, skipped items, and explicit controls", async () => {
  const source = await readFile(dialogPath, "utf8");

  assert.match(source, /status: HistoryModelSyncStatus \| null;/);
  assert.match(source, /nowMs: number;/);
  assert.match(source, /import \{ Progress \} from "@\/components\/ui\/progress";/);
  assert.match(source, /status\.currentPage/);
  assert.match(source, /status\.summary\.videosProcessed/);
  assert.match(source, /status\.summary\.videosUpserted/);
  assert.match(source, /status\.summary\.skippedMissingBvid/);
  assert.match(source, /status\.summary\.unresolvedMissingBvid/);
  assert.match(source, /status\.summary\.incompleteFolders/);
  assert.match(source, /status\.unresolvedItems/);
  assert.match(source, /status\.incompleteFolders/);
  assert.match(source, /status\.summary\.unavailableRemoteVideos/);
  assert.match(source, /invalidVideosDetected/);
  assert.match(source, /sync\.invalidDetectedHint/);
  assert.match(source, /status\.errors/);
  assert.match(source, /resume: \[\];/);
  assert.match(source, /restart: \[\];/);
  assert.match(source, /dismiss: \[\];/);
  assert.match(source, /emit\('resume'\)/);
  assert.match(source, /emit\('restart'\)/);
  assert.match(source, /emit\('dismiss'\)/);
});

test("all extension builds share an external sync monitor and live checkpoint refresh", async () => {
  const [app, component, api, background] = await Promise.all([
    readFile(appPath, "utf8"),
    readFile(favoritesStatusPath, "utf8"),
    readFile(apiPath, "utf8"),
    readFile(backgroundPath, "utf8"),
  ]);

  assert.match(app, /<FavoritesSyncStatusBar/);
  assert.match(app, /favoritesSyncStatusVisible/);
  assert.match(app, /scheduleSyncLibraryRefresh/);
  assert.match(app, /refreshFoldersAndVideos\(\{ silent: true \}\)/);
  assert.match(component, /aria-live="polite"/);
  assert.match(component, /status\.summary\.unavailableRemoteVideos/);
  assert.match(component, /status\.invalidVideosDetected/);
  assert.match(component, /emit\('open'\)/);
  assert.match(component, /emit\('dismiss'\)/);
  assert.match(api, /dismissHistoryModelSyncStatus/);
  assert.match(background, /history-model\/dismiss/);
});

test("app polls automatic retries but leaves risk-paused jobs for explicit resume", async () => {
  const source = await readFile(appPath, "utf8");

  assert.match(source, /const syncHistoryStatus = shallowRef<HistoryModelSyncStatus \| null>/);
  assert.match(source, /status\.phase === "waiting" && status\.retryAutomatic/);
  assert.match(source, /syncHistoryStatus\.value = status;/);
  assert.match(source, /async function resumeHistoryModelSyncFromUi\(/);
  assert.match(source, /async function restartHistoryModelSyncFromUi\(/);
  assert.match(source, /:status="syncHistoryStatus"/);
  assert.match(source, /:now-ms="tickNow"/);
  assert.match(source, /@resume="resumeHistoryModelSyncFromUi"/);
  assert.match(source, /@restart="restartHistoryModelSyncFromUi"/);
});

test("sync monitor can be reopened during a running task without fetching folders first", async () => {
  const [app, dialog, api, header, background] = await Promise.all([
    readFile(appPath, "utf8"),
    readFile(dialogPath, "utf8"),
    readFile(apiPath, "utf8"),
    readFile(headerPath, "utf8"),
    readFile(backgroundPath, "utf8"),
  ]);

  assert.match(app, /const favoritesSyncActive = computed/);
  assert.match(app, /const status = await refreshHistoryModelSyncStatus\(\);[\s\S]*?if \(!isHistoryModelSyncActive\(status\)\) \{[\s\S]*?loadSyncFolderOptions/s);
  assert.match(app, /stopHistoryModelSyncFromUi/);
  assert.match(api, /stopHistoryModelSync/);
  assert.match(dialog, /stopping: boolean;/);
  assert.match(dialog, /taskActive/);
  assert.match(dialog, /emit\('stop'\)/);
  assert.match(header, /:disabled="transferBusy"[\s\S]*?emit\('sync-import'\)/s);
  assert.match(background, /path === "\/sync\/bilibili\/folders"\) return false/);
  assert.match(background, /history-model\/stop/);
});

test("sync diagnostics have matching Chinese and English copy", async () => {
  const source = await readFile(i18nPath, "utf8");

  for (const key of [
    "sync.statusTitle",
    "sync.currentWork",
    "sync.retryAt",
    "sync.resumeNow",
    "sync.restart",
    "sync.scanned",
    "sync.upserted",
    "sync.skipped",
    "sync.unresolved",
    "sync.unavailable",
    "sync.unavailableHint",
    "sync.invalidDetected",
    "sync.invalidDetectedHint",
    "sync.dismissStatus",
    "sync.incomplete",
    "sync.diagnostics",
  ]) {
    assert.match(source, new RegExp(`"${key}"`));
  }
});

test("tag status bar exposes persisted progress and explicit task controls", async () => {
  const [component, app, api, syncImport, background] = await Promise.all([
    readFile(tagStatusPath, "utf8"),
    readFile(appPath, "utf8"),
    readFile(apiPath, "utf8"),
    readFile(dialogPath, "utf8"),
    readFile(backgroundPath, "utf8"),
  ]);

  assert.match(api, /phase: "idle" \| "running" \| "waiting" \| "paused"/);
  assert.match(api, /nextRunAt: number \| null;/);
  assert.match(api, /processed: number;/);
  assert.match(api, /succeeded: number;/);
  assert.match(api, /empty: number;/);
  assert.match(api, /failed: number;/);
  assert.match(api, /errors: Array</);
  assert.match(api, /dismissedAt: number \| null;/);
  assert.match(api, /selectedFolderIds: number\[\];/);
  assert.match(api, /scopeVideoCount: number;/);
  assert.match(api, /waitingForVideoSync: boolean;/);
  assert.match(api, /dismissTagEnrichmentStatus/);
  assert.match(api, /tag-enrichment\/dismiss/);
  assert.match(component, /aria-live="polite"/);
  assert.match(component, /status\?\.processed/);
  assert.match(component, /status\?\.totalMissing/);
  assert.match(component, /status\?\.nextRunAt/);
  assert.match(component, /emit\('start'\)/);
  assert.match(component, /emit\('stop'\)/);
  assert.match(component, /emit\('run'\)/);
  assert.match(component, /startDisabled\?: boolean;/);
  assert.match(component, /emit\('interrupt'\)/);
  assert.match(component, /emit\('dismiss'\)/);
  assert.match(component, /sync\.tag\.waitingForVideoSync/);
  assert.match(component, /phase === "paused"[\s\S]*sync\.resumeTagEnrich/);
  assert.match(component, /loading \|\| startDisabled \|\| cooldownActive/);
  assert.match(app, /<TagEnrichmentStatusBar/);
  assert.match(app, /tagEnrichmentStatusVisible/);
  assert.match(app, /status\.dismissedAt/);
  assert.match(app, /@start="resumeTagEnrichmentFromUi"/);
  assert.match(app, /@stop="pauseTagEnrichmentFromUi"/);
  assert.match(app, /@dismiss="dismissTagEnrichmentFromUi"/);
  assert.match(syncImport, /TagEnrichmentStatusBar/);
  assert.match(syncImport, /<TabsTrigger value="video"/);
  assert.match(syncImport, /<TabsTrigger value="tags"/);
  assert.match(syncImport, /selectedTagFolderIds: number\[\];/);
  assert.match(syncImport, /emit\('toggle-tag-folder'/);
  assert.match(syncImport, /emit\('start-tag-enrichment'\)/);
  assert.match(syncImport, /emit\('stop-tag-enrichment'\)/);
  assert.match(syncImport, /emit\('run-tag-enrichment'\)/);
  assert.match(syncImport, /emit\('dismiss-tag-enrichment'\)/);
  assert.match(syncImport, /emit\('interrupt-tag-enrichment'\)/);
  assert.match(background, /selectedFolderIds: number\[\];/);
  assert.match(background, /waitingForVideoSync: boolean;/);
  assert.match(background, /tag-enrichment\/dismiss/);
  assert.match(component, /panel-surface rounded-2xl/);
});

test("tag task controls and phases have matching Chinese and English copy", async () => {
  const source = await readFile(i18nPath, "utf8");

  for (const key of [
    "sync.startTagEnrich",
    "sync.resumeTagEnrich",
    "sync.stopTagEnrich",
    "sync.pauseTagEnrich",
    "sync.interruptTagEnrich",
    "sync.runTagEnrichNow",
    "sync.dismissStatus",
    "sync.tag.waitingForVideoSync",
    "sync.videoTab",
    "sync.tagTab",
    "sync.tagScopeTitle",
    "sync.tag.phase.running",
    "sync.tag.phase.waiting",
    "sync.tag.phase.paused",
    "sync.tag.phase.completed",
    "sync.tag.progress",
    "sync.tag.nextRun",
    "sync.tag.succeeded",
    "sync.tag.empty",
    "sync.tag.failed",
  ]) {
    assert.match(source, new RegExp(`"${key}"`));
  }
});
