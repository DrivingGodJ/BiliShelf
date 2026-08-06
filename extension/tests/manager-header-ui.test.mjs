import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");

async function readManagerHeaderSource() {
  const source = await readFile(
    path.join(repoRoot, "frontend", "src", "components", "layout", "ManagerHeader.vue"),
    "utf8",
  );
  return source.replace(/\r\n/g, "\n");
}

async function readFolderSidebarSource() {
  const source = await readFile(
    path.join(repoRoot, "frontend", "src", "components", "FolderSidebar.vue"),
    "utf8",
  );
  return source.replace(/\r\n/g, "\n");
}

async function readManagerAppSource() {
  const source = await readFile(path.join(repoRoot, "frontend", "src", "App.vue"), "utf8");
  return source.replace(/\r\n/g, "\n");
}

async function readManagerI18nSource() {
  const source = await readFile(
    path.join(repoRoot, "frontend", "src", "lib", "manager-i18n.ts"),
    "utf8",
  );
  return source.replace(/\r\n/g, "\n");
}

test("manager header removes the AI placeholder and exposes unified settings and data actions", async () => {
  const headerSource = await readManagerHeaderSource();
  const appSource = await readManagerAppSource();
  const i18nSource = await readManagerI18nSource();

  assert.doesNotMatch(i18nSource, /"header\.aiPlaceholder"/);
  assert.doesNotMatch(i18nSource, /"toast\.comingSoon"/);
  assert.doesNotMatch(headerSource, /"open-ai-placeholder": \[\];/);
  assert.doesNotMatch(headerSource, /props\.t\("header\.aiPlaceholder"\)/);
  assert.doesNotMatch(headerSource, /@click="emit\('open-ai-placeholder'\)"/);
  assert.match(headerSource, /const topActionButtonClass\s*=\s*"[^"]*border[^"]*shadow/);
  assert.match(headerSource, /@click="emit\('open-settings'\)"/);
  assert.match(headerSource, /<Settings class="h-4 w-4"/);
  assert.match(headerSource, /props\.t\("header\.dataTransfer"\)/);
  assert.match(i18nSource, /"header\.syncImport": \{ "zh-CN": "同步 B 站"/);
  assert.doesNotMatch(appSource, /@open-ai-placeholder="handleOpenAiPlaceholder"/);
  assert.doesNotMatch(appSource, /function handleOpenAiPlaceholder\(\)/);
  assert.doesNotMatch(appSource, /notifySuccess\(t\("toast\.comingSoon"\)\)/);
});

test("folder sidebar playback action uses a compact icon trigger", async () => {
  const source = await readFolderSidebarSource();

  assert.match(
    source,
    /v-if="props\.showPlaybackActions"\s+class="mt-3 flex items-center gap-2 rounded-lg[\s\S]*?<Button\s+size="icon"[\s\S]*?:aria-label="t\('playbackStart'\)"/s,
  );
});
