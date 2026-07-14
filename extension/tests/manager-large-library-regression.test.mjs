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

test("manager video queries reuse revision-bound local indexes", async () => {
  const source = await readFile(backgroundPath, "utf8");

  assert.match(source, /function buildLocalStateIndexes\(/);
  assert.match(source, /let cachedIndexes: \{ revision: number; value: LocalStateIndexes \} \| null = null;/);
  assert.match(source, /function getLocalStateIndexes\(state: LocalState\)/);
  assert.match(source, /cachedIndexes\?\.revision === stateRevision/);
  assert.doesNotMatch(
    source,
    /\.map\(\(video\) => mapVideo\(state, video, args\.folderId\)\)\s*\.filter/
  );
});

test("manager video queries slice ids before mapping visible DTOs", async () => {
  const source = await readFile(backgroundPath, "utf8");

  assert.match(
    source,
    /ids\s*\.slice\(start, start \+ pageSize\)\s*\.map\(\(videoId\) => indexes\.videosById\.get\(videoId\)\)/
  );
  assert.match(source, /const data = queryVideoPage\(/);
});

test("manager folder views sort by the selected folder relation timestamp", async () => {
  const source = await readFile(backgroundPath, "utf8");

  assert.match(
    source,
    /mapVideo\(state, video, args\.folderId, indexes\)/
  );
  assert.match(
    source,
    /activeAddedAtByFolderAndVideoId\.get\(folderId\)/
  );
  assert.match(
    source,
    /compareVideoIds\(leftId, rightId, folderId\)/
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
  assert.match(source, /unresolvedMissingBvid: number;/);
  assert.match(apiSource, /unresolvedMissingBvid: number;/);
  assert.match(source, /skippedMissingBvid: 0/);
  assert.match(
    source,
    /let skippedMissingBvid = job\?\.summary\.skippedMissingBvid \?\? 0;/
  );
  assert.match(source, /async function resolveFavoriteMediaBvid\(/);
  assert.match(source, /const resolvedIdentity = await resolveFavoriteMediaBvid\(media\);/);
  assert.match(source, /skippedMissingBvid \+= 1;/);
  assert.match(source, /unresolvedItems\.push\(unresolved\);/);
  assert.match(source, /unresolvedItems: unresolvedItems\.slice\(-100\)/);
});

test("video refresh ignores stale responses from older page requests", async () => {
  const source = await readFile(libraryStorePath, "utf8");

  assert.match(source, /let refreshVideosRunId = 0;/);
  assert.match(source, /const runId = \+\+refreshVideosRunId;/);
  assert.match(source, /if \(runId !== refreshVideosRunId\) return;/);
});
