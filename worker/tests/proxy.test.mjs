import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFoldersUpstreamUrl,
  buildUpstreamUrl,
  handleRequest,
  parseFreshFlag,
  parsePositiveInteger,
} from "../src/index.js";

test("validates positive integers and limits", () => {
  assert.equal(parsePositiveInteger("40", { max: 40 }), 40);
  assert.equal(parsePositiveInteger("41", { max: 40 }), null);
  assert.equal(parsePositiveInteger("1.5"), null);
  assert.equal(parsePositiveInteger("-1"), null);
});

test("accepts only the explicit cache-bypass flag", () => {
  assert.equal(parseFreshFlag(null), false);
  assert.equal(parseFreshFlag("1"), true);
  assert.throws(() => parseFreshFlag("true"), /fresh/);
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

test("builds only the fixed Bilibili folder-list endpoint", () => {
  const url = buildFoldersUpstreamUrl(
    "https://memory.example/api/folders?uid=220174771&url=https://evil.example",
  );
  assert.equal(url.origin, "https://api.bilibili.com");
  assert.equal(url.pathname, "/x/v3/fav/folder/created/list-all");
  assert.equal(url.searchParams.get("up_mid"), "220174771");
  assert.equal(url.searchParams.has("url"), false);
  assert.throws(
    () => buildFoldersUpstreamUrl("https://memory.example/api/folders?uid=not-a-number"),
    /uid/,
  );
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

test("forwards only validated favorite requests through the Mac VPC binding", async () => {
  let forwardedRequest;
  const response = await handleRequest(
    new Request(
      "https://memory.example/api/favorites?mediaId=47438371&page=61&pageSize=40&url=https://evil.example",
      {
        headers: {
          Origin: "https://example.github.io",
          "CF-Connecting-IP": "203.0.113.9",
        },
      },
    ),
    {
      ALLOWED_ORIGINS: "https://example.github.io",
      MAC_PROXY: {
        async fetch(request) {
          forwardedRequest = request;
          return Response.json({ code: 0, data: { medias: [] } });
        },
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal((await response.json()).code, 0);
  assert.equal(
    forwardedRequest.url,
    "http://bilishelf-mac.local/api/favorites?mediaId=47438371&page=61&pageSize=40",
  );
  assert.equal(forwardedRequest.headers.get("Origin"), "https://example.github.io");
  assert.equal(forwardedRequest.headers.get("X-Forwarded-Client-IP"), "203.0.113.9");
});

test("bypasses both cache layers only for an explicit fresh favorite request", async () => {
  let forwardedRequest;
  const response = await handleRequest(
    new Request(
      "https://memory.example/api/favorites?mediaId=47438371&page=2&pageSize=40&fresh=1&url=https://evil.example",
      { headers: { Origin: "https://example.github.io" } },
    ),
    {
      ALLOWED_ORIGINS: "https://example.github.io",
      MAC_PROXY: {
        async fetch(request) {
          forwardedRequest = request;
          return Response.json({ code: 0, data: { medias: [] } });
        },
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("X-Memory-Cache"), "BYPASS");
  assert.equal(
    forwardedRequest.url,
    "http://bilishelf-mac.local/api/favorites?mediaId=47438371&page=2&pageSize=40&fresh=1",
  );
});

test("rejects malformed cache-bypass flags", async () => {
  const response = await handleRequest(
    new Request(
      "https://memory.example/api/favorites?mediaId=47438371&fresh=true",
      { headers: { Origin: "https://example.github.io" } },
    ),
    { ALLOWED_ORIGINS: "https://example.github.io" },
  );
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /fresh/);
});

test("forwards only a validated UID for folder discovery through the Mac VPC binding", async () => {
  let forwardedRequest;
  const response = await handleRequest(
    new Request(
      "https://memory.example/api/folders?uid=220174771&url=https://evil.example",
      {
        headers: {
          Origin: "https://example.github.io",
          "CF-Connecting-IP": "203.0.113.10",
        },
      },
    ),
    {
      ALLOWED_ORIGINS: "https://example.github.io",
      MAC_PROXY: {
        async fetch(request) {
          forwardedRequest = request;
          return Response.json({ code: 0, data: { count: 1, list: [] } });
        },
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal((await response.json()).code, 0);
  assert.equal(
    forwardedRequest.url,
    "http://bilishelf-mac.local/api/folders?uid=220174771",
  );
  assert.equal(forwardedRequest.headers.get("X-Forwarded-Client-IP"), "203.0.113.10");
});
