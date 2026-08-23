import http from "node:http";
import { handleRequest } from "./index.js";

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
const responseCache = new Map();
const clientRequests = new Map();
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

async function handleNodeRequest(nodeRequest) {
  const url = new URL(nodeRequest.url || "/", `http://${HOST}:${PORT}`);
  const method = nodeRequest.method || "GET";
  const headers = new Headers();
  for (const [name, value] of Object.entries(nodeRequest.headers)) {
    if (Array.isArray(value)) headers.set(name, value.join(", "));
    else if (value !== undefined) headers.set(name, value);
  }

  const cacheKey = `${url.pathname}${url.search}`;
  const bilibiliReadRequest = isBilibiliReadRequest(url, method);
  if (bilibiliReadRequest) {
    const cached = readCachedResponse(cacheKey);
    if (cached) return { ...cached, headers: { ...cached.headers, "X-Mac-Cache": "HIT" } };

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
  response.headers["X-Mac-Cache"] = "MISS";
  if (bilibiliReadRequest && response.status >= 200 && response.status < 300) {
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
  console.log(JSON.stringify({ message: "BiliShelf Mac proxy listening", host: HOST, port: PORT }));
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
