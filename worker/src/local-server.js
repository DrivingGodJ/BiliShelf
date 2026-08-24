import http from "node:http";
import os from "node:os";
import path from "node:path";
import { handleRequest } from "./index.js";
import {
  createUidRequestLog,
  extractUidFromFavoriteResponse,
  renderUidStatsHtml,
} from "./uid-request-log.js";

const HOST = "127.0.0.1";
const PORT = Number.parseInt(process.env.BILI_MEMORY_PORT || "8787", 10);
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  || "https://drivinggodj.github.io,http://localhost:5173,http://127.0.0.1:5173";
const CACHE_TTL_MS = 5 * 60 * 1000;
const CLIENT_WINDOW_MS = 10 * 60 * 1000;
const CLIENT_REQUEST_LIMIT = 180;
const MAX_TRACKED_CLIENTS = 10000;
const MAX_PENDING_REQUESTS = 40;
const MIN_UPSTREAM_INTERVAL_MS = 400;
const UID_STATS_PATH = "/local/uid-stats";
const UID_STATS_JSON_PATH = "/local/uid-stats.json";
const UID_STATS_FILE = process.env.BILI_MEMORY_STATS_FILE || path.join(
  os.homedir(),
  "Library/Application Support/ShiguangMemory/data/uid-request-stats.json",
);
const responseCache = new Map();
const clientRequests = new Map();
const uidRequestLog = createUidRequestLog({ filePath: UID_STATS_FILE, recentLimit: 100 });
let upstreamQueue = Promise.resolve();
let pendingRequests = 0;
let lastUpstreamAt = 0;

function writeBufferedResponse(nodeResponse, response) {
  nodeResponse.writeHead(response.status, response.headers);
  nodeResponse.end(response.body);
}

function jsonResponse(data, status, origin) {
  return {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": origin || "null",
      "Cache-Control": "no-store",
      Vary: "Origin",
    },
    body: Buffer.from(JSON.stringify(data)),
  };
}

function readCachedResponse(key) {
  const cached = responseCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    responseCache.delete(key);
    return null;
  }
  return cached.response;
}

function cacheResponse(key, response) {
  if (responseCache.size >= 2000) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) responseCache.delete(oldestKey);
  }
  responseCache.set(key, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    response,
  });
}

function allowClientRequest(clientIp) {
  const now = Date.now();
  const cutoff = now - CLIENT_WINDOW_MS;
  const recent = (clientRequests.get(clientIp) || []).filter((timestamp) => timestamp > cutoff);
  if (recent.length >= CLIENT_REQUEST_LIMIT) {
    clientRequests.set(clientIp, recent);
    return false;
  }
  if (!clientRequests.has(clientIp) && clientRequests.size >= MAX_TRACKED_CLIENTS) {
    const oldestClient = clientRequests.keys().next().value;
    if (oldestClient) clientRequests.delete(oldestClient);
  }
  recent.push(now);
  clientRequests.set(clientIp, recent);
  return true;
}

async function scheduleUpstream(task) {
  if (pendingRequests >= MAX_PENDING_REQUESTS) {
    const error = new Error("请求队列已满");
    error.code = "QUEUE_FULL";
    throw error;
  }

  pendingRequests += 1;
  const scheduled = upstreamQueue.then(async () => {
    const waitMs = Math.max(0, MIN_UPSTREAM_INTERVAL_MS - (Date.now() - lastUpstreamAt));
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
    lastUpstreamAt = Date.now();
    return task();
  });
  upstreamQueue = scheduled.then(
    () => undefined,
    () => undefined,
  );

  try {
    return await scheduled;
  } finally {
    pendingRequests -= 1;
  }
}

async function bufferWebResponse(webResponse) {
  return {
    status: webResponse.status,
    headers: Object.fromEntries(webResponse.headers.entries()),
    body: webResponse.body ? Buffer.from(await webResponse.arrayBuffer()) : Buffer.alloc(0),
  };
}

function isBilibiliReadRequest(url, method) {
  return method === "GET" && (
    url.pathname === "/api/favorites" || url.pathname === "/api/folders"
  );
}

function clientIpFrom(headers) {
  const forwarded = headers.get("X-Forwarded-Client-IP")?.trim();
  return forwarded || "local";
}

function isLocalStatsRequest(url, method) {
  return method === "GET" && (url.pathname === UID_STATS_PATH || url.pathname === UID_STATS_JSON_PATH);
}

function localStatsResponse(body, contentType) {
  return {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
    body: Buffer.from(body),
  };
}

async function recordSuccessfulUidRequest(url, response) {
  if (response.status < 200 || response.status >= 300) return;
  const uid = url.pathname === "/api/folders"
    ? url.searchParams.get("uid")
    : extractUidFromFavoriteResponse(response.body);
  if (!uid) return;
  try {
    await uidRequestLog.record({
      uid,
      route: url.pathname,
      mediaId: url.searchParams.get("mediaId"),
      page: url.searchParams.get("page"),
      cache: response.headers["X-Mac-Cache"] || "MISS",
    });
  } catch (error) {
    console.error(JSON.stringify({
      message: "UID request log could not be saved",
      error: error instanceof Error ? error.message : String(error),
    }));
  }
}

async function handleNodeRequest(nodeRequest) {
  const url = new URL(nodeRequest.url || "/", `http://${HOST}:${PORT}`);
  const method = nodeRequest.method || "GET";
  const headers = new Headers();
  for (const [name, value] of Object.entries(nodeRequest.headers)) {
    if (Array.isArray(value)) headers.set(name, value.join(", "));
    else if (value !== undefined) headers.set(name, value);
  }

  if (isLocalStatsRequest(url, method)) {
    if (headers.has("X-Forwarded-Client-IP")) {
      return jsonResponse({ code: -404, message: "Not found" }, 404, "null");
    }
    const state = await uidRequestLog.snapshot();
    return url.pathname === UID_STATS_JSON_PATH
      ? localStatsResponse(`${JSON.stringify(state, null, 2)}\n`, "application/json; charset=utf-8")
      : localStatsResponse(renderUidStatsHtml(state), "text/html; charset=utf-8");
  }

  const cacheKey = `${url.pathname}${url.search}`;
  const bilibiliReadRequest = isBilibiliReadRequest(url, method);
  const bypassCache = method === "GET"
    && url.pathname === "/api/favorites"
    && url.searchParams.get("fresh") === "1";
  if (bilibiliReadRequest) {
    if (!bypassCache) {
      const cached = readCachedResponse(cacheKey);
      if (cached) {
        const response = { ...cached, headers: { ...cached.headers, "X-Mac-Cache": "HIT" } };
        await recordSuccessfulUidRequest(url, response);
        return response;
      }
    }

    if (!allowClientRequest(clientIpFrom(headers))) {
      return jsonResponse(
        { code: -429, message: "同步请求过于频繁，请十分钟后再试" },
        429,
        headers.get("Origin"),
      );
    }
  }

  const request = new Request(url, { method, headers });
  const webResponse = bilibiliReadRequest
    ? await scheduleUpstream(() => handleRequest(request, { ALLOWED_ORIGINS }, {}))
    : await handleRequest(request, { ALLOWED_ORIGINS }, {});
  const response = await bufferWebResponse(webResponse);
  response.headers["X-Mac-Cache"] = bypassCache ? "BYPASS" : "MISS";
  await recordSuccessfulUidRequest(url, response);
  if (!bypassCache && bilibiliReadRequest && response.status >= 200 && response.status < 300) {
    cacheResponse(cacheKey, response);
  }
  return response;
}

const server = http.createServer(async (nodeRequest, nodeResponse) => {
  try {
    const response = await handleNodeRequest(nodeRequest);
    writeBufferedResponse(nodeResponse, response);
  } catch (error) {
    console.error(JSON.stringify({
      message: "Local proxy request failed",
      error: error instanceof Error ? error.message : String(error),
    }));
    const queueFull = error && typeof error === "object" && error.code === "QUEUE_FULL";
    writeBufferedResponse(
      nodeResponse,
      jsonResponse(
        queueFull
          ? { code: -429, message: "同步请求较多，请稍后再试" }
          : { code: -500, message: "本地代理发生错误" },
        queueFull ? 429 : 500,
        nodeRequest.headers.origin,
      ),
    );
  }
});

server.listen(PORT, HOST, () => {
  console.log(JSON.stringify({ message: "Shiguang Mac proxy listening", host: HOST, port: PORT }));
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
