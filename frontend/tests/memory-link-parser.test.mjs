import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFavoriteApiUrl,
  normalizeProxyBaseUrl,
  parseFavoriteMediaId,
} from "../src/memory/favorite-link.js";

test("parses modern list and space favorite links", () => {
  assert.equal(
    parseFavoriteMediaId("https://www.bilibili.com/list/ml47438371?bvid=BV1abc"),
    47438371,
  );
  assert.equal(
    parseFavoriteMediaId("https://space.bilibili.com/220174771/favlist?fid=47438371&ftype=create"),
    47438371,
  );
  assert.equal(parseFavoriteMediaId("47438371"), 47438371);
});

test("rejects unrelated or unsafe favorite input", () => {
  assert.equal(parseFavoriteMediaId("https://example.com/favlist?x=1"), null);
  assert.equal(parseFavoriteMediaId("not-a-link"), null);
  assert.equal(parseFavoriteMediaId("12"), null);
});

test("normalizes secure proxy URLs and creates a fixed route", () => {
  assert.equal(normalizeProxyBaseUrl("https://worker.example.dev/"), "https://worker.example.dev");
  assert.equal(normalizeProxyBaseUrl("http://worker.example.dev"), "");
  const url = buildFavoriteApiUrl("https://worker.example.dev", 47438371, 2, 40);
  assert.equal(
    url,
    "https://worker.example.dev/api/favorites?mediaId=47438371&page=2&pageSize=40",
  );
});
