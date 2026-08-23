import assert from "node:assert/strict";
import test from "node:test";
import { buildUpstreamUrl, handleRequest, parsePositiveInteger } from "../src/index.js";

test("validates positive integers and limits", () => {
  assert.equal(parsePositiveInteger("40", { max: 40 }), 40);
  assert.equal(parsePositiveInteger("41", { max: 40 }), null);
  assert.equal(parsePositiveInteger("1.5"), null);
  assert.equal(parsePositiveInteger("-1"), null);
});

test("builds only the fixed Bilibili favorites endpoint", () => {
  const url = buildUpstreamUrl(
    "https://memory.example/api/favorites?mediaId=47438371&page=3&pageSize=40&url=https://evil.example",
  );
  assert.equal(url.origin, "https://api.bilibili.com");
  assert.equal(url.pathname, "/x/v3/fav/resource/list");
  assert.equal(url.searchParams.get("media_id"), "47438371");
  assert.equal(url.searchParams.get("pn"), "3");
  assert.equal(url.searchParams.get("ps"), "40");
  assert.equal(url.searchParams.has("url"), false);
});

test("rejects write methods before contacting upstream", async () => {
  const response = await handleRequest(
    new Request("https://memory.example/api/favorites?mediaId=47438371", {
      method: "POST",
      headers: { Origin: "https://example.github.io" },
    }),
    { ALLOWED_ORIGINS: "*" },
  );
  assert.equal(response.status, 405);
  assert.equal((await response.json()).code, -405);
});

test("restricts configured origins", async () => {
  const response = await handleRequest(
    new Request("https://memory.example/api/health", {
      headers: { Origin: "https://untrusted.example" },
    }),
    { ALLOWED_ORIGINS: "https://trusted.github.io" },
  );
  assert.equal(response.status, 403);
});
