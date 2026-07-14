import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const backgroundPath = path.join(repoRoot, "extension", "entrypoints", "background.ts");
const frontendApiPath = path.join(repoRoot, "frontend", "src", "lib", "api.ts");
const libraryStorePath = path.join(repoRoot, "frontend", "src", "stores", "library.ts");

test("manager video queries build per-request local indexes before filtering", async () => {
  const source = await readFile(backgroundPath, "utf8");

  assert.match(source, /function buildLocalStateIndexes\(/);
  assert.match(source, /const indexes = buildLocalStateIndexes\(state\);/);
  assert.doesNotMatch(
    source,
    /\.map\(\(video\) => mapVideo\(state, video, args\.folderId\)\)\s*\.filter/
  );
});

test("manager video queries map each candidate once before applying expensive filters", async () => {
  const source = await readFile(backgroundPath, "utf8");

  assert.match(
    source,
    /\.filter\(\(video\) => \(args\.includeDeleted \? video\.deletedAt !== null : video\.deletedAt === null\)\)\s*\.map\(\(video\) => mapVideo\(state, video, args\.folderId, indexes\)\)\s*\.filter\(\(mappedVideo\) => \{/
  );
  assert.doesNotMatch(source, /const mappedVideo = mapVideo\(state, video, args\.folderId, indexes\);/);
});

test("manager folder views sort by the selected folder relation timestamp", async () => {
  const source = await readFile(backgroundPath, "utf8");

  assert.match(
    source,
    /mapVideo\(state, video, args\.folderId, indexes\)/
  );
  assert.match(
    source,
    /const aRank = a\.addedAt \|\| a\.updatedAt \|\| 0;/
  );
  assert.doesNotMatch(
    source,
    /computeAddedAtFromItems\([^)]*undefined[^)]*\)/
  );
});

test("favorites sync does not promote missing fav_time rows with current time", async () => {
  const source = await readFile(backgroundPath, "utf8");

  assert.match(source, /function resolveRemoteFavoriteAddedAt\(/);
  assert.match(
    source,
    /return REMOTE_FAVORITE_ORDER_FALLBACK_BASE_MS - remoteIndex;/
  );
  assert.doesNotMatch(source, /toMillis\(media\.fav_time,\s*timestamp\)/);
});

test("favorites sync counts remote media skipped because bvid is missing", async () => {
  const source = await readFile(backgroundPath, "utf8");
  const apiSource = await readFile(frontendApiPath, "utf8");

  assert.match(source, /skippedMissingBvid: number;/);
  assert.match(apiSource, /skippedMissingBvid: number;/);
  assert.match(source, /skippedMissingBvid: 0/);
  assert.match(source, /let skippedMissingBvid = 0;/);
  assert.match(
    source,
    /if \(!bvid\) \{\s*skippedMissingBvid \+= 1;\s*continue;\s*\}/
  );
  assert.match(
    source,
    /skippedMissingBvid,\s*folderLinksAdded,\s*tagsBound,\s*errorCount: errors\.length/
  );
});

test("video refresh ignores stale responses from older page requests", async () => {
  const source = await readFile(libraryStorePath, "utf8");

  assert.match(source, /let refreshVideosRunId = 0;/);
  assert.match(source, /const runId = \+\+refreshVideosRunId;/);
  assert.match(source, /if \(runId !== refreshVideosRunId\) return;/);
});
