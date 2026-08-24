import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createUidRequestLog,
  extractUidFromFavoriteResponse,
  normalizeUid,
  renderUidStatsHtml,
} from "../src/uid-request-log.js";

test("normalizes positive numeric UIDs", () => {
  assert.equal(normalizeUid("001234"), "1234");
  assert.equal(normalizeUid("0"), null);
  assert.equal(normalizeUid("abc"), null);
});

test("extracts the folder owner UID from a successful favorite response", () => {
  assert.equal(extractUidFromFavoriteResponse(Buffer.from(JSON.stringify({
    code: 0,
    data: { info: { mid: 220174771 } },
  }))), "220174771");
  assert.equal(extractUidFromFavoriteResponse('{"code":-1}'), null);
  assert.equal(extractUidFromFavoriteResponse("not-json"), null);
});

test("persists aggregate counts and keeps only the newest 100 requests", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "shiguang-uid-log-"));
  const filePath = path.join(directory, "stats.json");
  let tick = 0;
  const log = createUidRequestLog({
    filePath,
    now: () => new Date(Date.UTC(2026, 7, 24, 0, 0, tick++)),
  });

  try {
    for (let index = 0; index < 101; index += 1) {
      await log.record({
        uid: index % 2 === 0 ? "10001" : "10002",
        route: "/api/favorites",
        mediaId: "9988",
        page: String(index + 1),
        cache: index % 3 === 0 ? "HIT" : "MISS",
      });
    }

    const state = await log.snapshot();
    assert.equal(state.totalRequests, 101);
    assert.equal(state.recent.length, 100);
    assert.equal(state.recent[0].page, "101");
    assert.equal(state.recent.at(-1).page, "2");
    assert.equal(state.uids["10001"].count, 51);
    assert.equal(state.uids["10002"].count, 50);

    const reloaded = createUidRequestLog({ filePath });
    assert.deepEqual(await reloaded.snapshot(), state);
    assert.equal((await readFile(filePath, "utf8")).endsWith("\n"), true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("renders aggregate and recent-request tables", () => {
  const html = renderUidStatsHtml({
    totalRequests: 2,
    uids: {
      "12345": {
        count: 2,
        firstSeen: "2026-08-24T00:00:00.000Z",
        lastSeen: "2026-08-24T00:01:00.000Z",
      },
    },
    recent: [{
      timestamp: "2026-08-24T00:01:00.000Z",
      uid: "12345",
      route: "/api/favorites",
      page: "2",
      cache: "HIT",
    }],
  });

  assert.match(html, /UID 请求统计/);
  assert.match(html, /space\.bilibili\.com\/12345/);
  assert.match(html, /最近 100 次请求/);
  assert.match(html, />HIT</);
});
