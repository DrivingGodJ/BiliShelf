const MEDIA_ID_PATTERNS = [
  /(?:^|\/)ml(\d+)(?:[/?#]|$)/i,
  /[?&#](?:fid|media_id)=(\d+)(?:&|#|$)/i,
];

function positiveSafeInteger(value) {
  if (!/^\d{1,20}$/.test(String(value ?? ""))) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function isBilibiliHost(hostname) {
  return /(^|\.)bilibili\.com$/i.test(hostname);
}

export function parseFavoriteMediaId(input) {
  const value = String(input ?? "").trim();
  if (!value) return null;

  if (/^\d{3,20}$/.test(value)) {
    return positiveSafeInteger(value);
  }

  try {
    const parsed = new URL(value);
    if (!isBilibiliHost(parsed.hostname)) return null;

    const fid = parsed.searchParams.get("fid") ?? parsed.searchParams.get("media_id");
    if (fid && /^\d{3,20}$/.test(fid)) return positiveSafeInteger(fid);

    const match = parsed.pathname.match(/(?:^|\/)ml(\d+)(?:\/|$)/i);
    if (match) return positiveSafeInteger(match[1]);
  } catch {
    for (const pattern of MEDIA_ID_PATTERNS) {
      const match = value.match(pattern);
      if (match) return positiveSafeInteger(match[1]);
    }
    return null;
  }

  return null;
}

export function parseBilibiliUid(input) {
  const value = String(input ?? "").trim();
  if (!value) return null;

  if (/^\d{1,20}$/.test(value)) return positiveSafeInteger(value);

  try {
    const parsed = new URL(value);
    if (!isBilibiliHost(parsed.hostname)) return null;

    const pathMatch = parsed.pathname.match(/^\/(?:space\/)?(\d+)(?:\/|$)/i);
    return pathMatch ? positiveSafeInteger(pathMatch[1]) : null;
  } catch {
    return null;
  }
}

export function normalizeProxyBaseUrl(input) {
  const value = String(input ?? "").trim().replace(/\/+$/, "");
  if (!value) return "";
  if (value.startsWith("/") && !value.startsWith("//")) return value;

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
      return "";
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

export function buildFavoriteApiUrl(proxyBaseUrl, mediaId, page, pageSize = 40, fresh = false) {
  const base = normalizeProxyBaseUrl(proxyBaseUrl);
  if (!base) throw new Error("请先配置只读数据代理地址");

  const path = `${base}/api/favorites`;
  const origin = typeof window === "undefined" ? "https://local.invalid" : window.location.origin;
  const url = new URL(path, origin);
  url.searchParams.set("mediaId", String(mediaId));
  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", String(pageSize));
  if (fresh) url.searchParams.set("fresh", "1");
  return url.pathname.startsWith("/api/") && base.startsWith("/")
    ? `${url.pathname}${url.search}`
    : url.toString();
}

export function buildFavoriteFoldersApiUrl(proxyBaseUrl, uid) {
  const base = normalizeProxyBaseUrl(proxyBaseUrl);
  if (!base) throw new Error("请先配置只读数据代理地址");

  const path = `${base}/api/folders`;
  const origin = typeof window === "undefined" ? "https://local.invalid" : window.location.origin;
  const url = new URL(path, origin);
  url.searchParams.set("uid", String(uid));
  return url.pathname.startsWith("/api/") && base.startsWith("/")
    ? `${url.pathname}${url.search}`
    : url.toString();
}
