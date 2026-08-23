import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFavoriteApiUrl,
  buildFavoriteFoldersApiUrl,
  migrateLegacyOfficialProxyBaseUrl,
  normalizeProxyBaseUrl,
  parseBilibiliUid,
  parseFavoriteMediaId,
} from "../src/memory/favorite-link.js";

test("parses modern list and space favorite links", () => {
  assert.equal(
    parseFavoriteMediaId("https://www.bilibili.com/list/ml987654321?bvid=BV1abc"),
    987654321,
  );
  assert.equal(
    parseFavoriteMediaId("https://space.bilibili.com/123456789/favlist?fid=987654321&ftype=create"),
    987654321,
  );
  assert.equal(parseFavoriteMediaId("987654321"), 987654321);
});

test("rejects unrelated or unsafe favorite input", () => {
  assert.equal(parseFavoriteMediaId("https://example.com/favlist?x=1"), null);
  assert.equal(parseFavoriteMediaId("https://evil.example/list/ml987654321"), null);
  assert.equal(parseFavoriteMediaId("not-a-link"), null);
  assert.equal(parseFavoriteMediaId("12"), null);
});

test("parses a UID or Bilibili space URL", () => {
  assert.equal(parseBilibiliUid("123456789"), 123456789);
  assert.equal(parseBilibiliUid("https://space.bilibili.com/123456789/favlist"), 123456789);
  assert.equal(parseBilibiliUid("https://m.bilibili.com/space/123456789"), 123456789);
  assert.equal(parseBilibiliUid("https://example.com/123456789"), null);
  assert.equal(parseBilibiliUid("not-a-uid"), null);
});

test("normalizes secure proxy URLs and creates a fixed route", () => {
  assert.equal(normalizeProxyBaseUrl("https://worker.example.dev/"), "https://worker.example.dev");
  assert.equal(normalizeProxyBaseUrl("http://worker.example.dev"), "");
  const url = buildFavoriteApiUrl("https://worker.example.dev", 987654321, 2, 40);
  assert.equal(
    url,
    "https://worker.example.dev/api/favorites?mediaId=987654321&page=2&pageSize=40",
  );
  assert.equal(
    buildFavoriteApiUrl("https://worker.example.dev", 987654321, 2, 40, true),
    "https://worker.example.dev/api/favorites?mediaId=987654321&page=2&pageSize=40&fresh=1",
  );
  assert.equal(
    buildFavoriteFoldersApiUrl("https://worker.example.dev", 123456789),
    "https://worker.example.dev/api/folders?uid=123456789",
  );
});

test("migrates only the retired official workers.dev proxy", () => {
  const oldOfficialProxy = "https://bilishelf-memory-proxy.bilishelf-memory-proxy.workers.dev/";
  const newOfficialProxy = "https://api.drivinggodj.dpdns.org";

  assert.equal(migrateLegacyOfficialProxyBaseUrl(oldOfficialProxy, newOfficialProxy), newOfficialProxy);
  assert.equal(
    migrateLegacyOfficialProxyBaseUrl("https://self-hosted.example.com", newOfficialProxy),
    "https://self-hosted.example.com",
  );
  assert.equal(
    migrateLegacyOfficialProxyBaseUrl(oldOfficialProxy, ""),
    "https://bilishelf-memory-proxy.bilishelf-memory-proxy.workers.dev",
  );
});
