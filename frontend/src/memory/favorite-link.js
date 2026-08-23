const MEDIA_ID_PATTERNS = [
  /(?:^|\/)ml(\d+)(?:[/?#]|$)/i,
  /[?&#](?:fid|media_id)=(\d+)(?:&|#|$)/i,
];

export function parseFavoriteMediaId(input) {
  const value = String(input ?? "").trim();
  if (!value) return null;

  if (/^\d{3,20}$/.test(value)) {
    const direct = Number(value);
    return Number.isSafeInteger(direct) && direct > 0 ? direct : null;
  }

  for (const pattern of MEDIA_ID_PATTERNS) {
    const match = value.match(pattern);
    if (!match) continue;
    const mediaId = Number(match[1]);
    if (Number.isSafeInteger(mediaId) && mediaId > 0) return mediaId;
  }

  try {
    const parsed = new URL(value);
    if (!/(^|\.)bilibili\.com$/i.test(parsed.hostname)) return null;

    const fid = parsed.searchParams.get("fid") ?? parsed.searchParams.get("media_id");
    if (fid && /^\d{3,20}$/.test(fid)) {
      const mediaId = Number(fid);
      return Number.isSafeInteger(mediaId) && mediaId > 0 ? mediaId : null;
    }
  } catch {
    return null;
  }

  return null;
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

export function buildFavoriteApiUrl(proxyBaseUrl, mediaId, page, pageSize = 40) {
  const base = normalizeProxyBaseUrl(proxyBaseUrl);
  if (!base) throw new Error("请先配置只读数据代理地址");

  const path = `${base}/api/favorites`;
  const origin = typeof window === "undefined" ? "https://local.invalid" : window.location.origin;
  const url = new URL(path, origin);
  url.searchParams.set("mediaId", String(mediaId));
  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", String(pageSize));
  return url.pathname.startsWith("/api/") && base.startsWith("/")
    ? `${url.pathname}${url.search}`
    : url.toString();
}
