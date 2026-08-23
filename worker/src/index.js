const BILIBILI_FAVORITES_API = "https://api.bilibili.com/x/v3/fav/resource/list";
const MAX_PAGE = 2500;
const MAX_PAGE_SIZE = 40;

function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function parsePositiveInteger(value, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!/^\d+$/.test(String(value ?? ""))) return null;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) return null;
  return number;
}

export function buildUpstreamUrl(requestUrl) {
  const incoming = new URL(requestUrl);
  const mediaId = parsePositiveInteger(incoming.searchParams.get("mediaId"), {
    max: Number.MAX_SAFE_INTEGER,
  });
  const page = parsePositiveInteger(incoming.searchParams.get("page") || "1", { max: MAX_PAGE });
  const pageSize = parsePositiveInteger(incoming.searchParams.get("pageSize") || "40", {
    max: MAX_PAGE_SIZE,
  });

  if (!mediaId) throw new Error("mediaId 必须是有效的收藏夹数字 ID");
  if (!page) throw new Error(`page 必须在 1-${MAX_PAGE} 之间`);
  if (!pageSize) throw new Error(`pageSize 必须在 1-${MAX_PAGE_SIZE} 之间`);

  const upstream = new URL(BILIBILI_FAVORITES_API);
  upstream.searchParams.set("media_id", String(mediaId));
  upstream.searchParams.set("pn", String(page));
  upstream.searchParams.set("ps", String(pageSize));
  upstream.searchParams.set("keyword", "");
  upstream.searchParams.set("order", "mtime");
  upstream.searchParams.set("type", "0");
  upstream.searchParams.set("tid", "0");
  upstream.searchParams.set("platform", "web");
  return upstream;
}

function resolveAllowedOrigin(request, env) {
  const requestOrigin = request.headers.get("Origin") || "";
  const configured = String(env?.ALLOWED_ORIGINS || "*")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (configured.includes("*")) return "*";
  return configured.includes(requestOrigin) ? requestOrigin : "";
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "null",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

async function forwardRequestToMac(request, env) {
  const incoming = new URL(request.url);
  const privateUrl = new URL(`http://bilishelf-mac.local${incoming.pathname}`);
  if (incoming.pathname === "/api/favorites") {
    privateUrl.searchParams.set("mediaId", incoming.searchParams.get("mediaId"));
    privateUrl.searchParams.set("page", incoming.searchParams.get("page") || "1");
    privateUrl.searchParams.set("pageSize", incoming.searchParams.get("pageSize") || "40");
  }
  const headers = new Headers({ Accept: "application/json" });
  const origin = request.headers.get("Origin");
  const clientIp = request.headers.get("CF-Connecting-IP");
  if (origin) headers.set("Origin", origin);
  if (clientIp) headers.set("X-Forwarded-Client-IP", clientIp);
  return env.MAC_PROXY.fetch(new Request(privateUrl, { method: request.method, headers }));
}

export async function handleRequest(request, env = {}, context = {}) {
  const url = new URL(request.url);
  const allowedOrigin = resolveAllowedOrigin(request, env);

  if (!allowedOrigin) {
    return json(
      { code: -403, message: "这个网页来源没有被代理允许" },
      { status: 403, headers: corsHeaders("null") },
    );
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(allowedOrigin) });
  }

  if (request.method !== "GET") {
    return json(
      { code: -405, message: "只允许只读 GET 请求" },
      { status: 405, headers: corsHeaders(allowedOrigin) },
    );
  }

  if (url.pathname === "/health" || url.pathname === "/api/health") {
    if (env?.MAC_PROXY) {
      try {
        return await forwardRequestToMac(request, env);
      } catch (error) {
        console.error(JSON.stringify({
          message: "Mac proxy health check failed",
          error: error instanceof Error ? error.message : String(error),
        }));
        return json(
          { ok: false, service: "bilishelf-memory-proxy", message: "Mac 代理当前不可用" },
          { status: 503, headers: { ...corsHeaders(allowedOrigin), "Cache-Control": "no-store" } },
        );
      }
    }
    return json(
      { ok: true, service: "bilishelf-memory-mac-proxy" },
      { headers: { ...corsHeaders(allowedOrigin), "Cache-Control": "no-store" } },
    );
  }

  if (url.pathname !== "/api/favorites") {
    return json(
      { code: -404, message: "Not found" },
      { status: 404, headers: corsHeaders(allowedOrigin) },
    );
  }

  let upstreamUrl;
  try {
    upstreamUrl = buildUpstreamUrl(request.url);
  } catch (error) {
    return json(
      { code: -400, message: error instanceof Error ? error.message : "参数错误" },
      { status: 400, headers: corsHeaders(allowedOrigin) },
    );
  }

  const cache = globalThis.caches?.default;
  const cacheKey = new Request(request.url, { method: "GET" });
  const cached = cache ? await cache.match(cacheKey) : null;
  if (cached) {
    const response = new Response(cached.body, cached);
    for (const [key, value] of Object.entries(corsHeaders(allowedOrigin))) {
      response.headers.set(key, value);
    }
    response.headers.set("X-Memory-Cache", "HIT");
    return response;
  }

  let upstreamResponse;
  try {
    upstreamResponse = env?.MAC_PROXY
      ? await forwardRequestToMac(request, env)
      : await fetch(upstreamUrl, {
          method: "GET",
          headers: {
            Accept: "application/json, text/plain, */*",
            Referer: "https://www.bilibili.com/",
            "User-Agent": "Mozilla/5.0 (compatible; BiliShelf-Memory/0.1; +https://github.com/TLRKFXE/BiliShelf)",
          },
        });
  } catch (error) {
    console.error(JSON.stringify({
      message: "Favorites upstream request failed",
      error: error instanceof Error ? error.message : String(error),
    }));
    return json(
      { code: -502, message: "暂时无法连接 B站，请稍后再试" },
      { status: 502, headers: corsHeaders(allowedOrigin) },
    );
  }

  const contentType = upstreamResponse.headers.get("Content-Type") || "application/json; charset=utf-8";
  const response = new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: {
      ...corsHeaders(allowedOrigin),
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=30, s-maxage=60",
      "X-Content-Type-Options": "nosniff",
      "X-Memory-Cache": "MISS",
    },
  });

  if (cache && upstreamResponse.ok) {
    context.waitUntil?.(cache.put(cacheKey, response.clone()));
  }
  return response;
}

export default {
  fetch(request, env, context) {
    return handleRequest(request, env, context);
  },
};
