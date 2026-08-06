const MAX_TITLE_LENGTH = 300;
const MAX_SUMMARY_LENGTH = 1200;
const MAX_CONTENT_LENGTH = 12000;

function text(value, max = 20000) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

function safeUrl(value, fallback = "") {
  const raw = text(value, 2000);
  if (!raw) return fallback;
  const normalized = raw.startsWith("//") ? `https:${raw}` : raw;
  try {
    const url = new URL(normalized);
    if (url.protocol !== "http:" && url.protocol !== "https:") return fallback;
    if (url.protocol === "http:" && /(^|\.)hdslb\.com$/i.test(url.hostname)) {
      url.protocol = "https:";
    }
    return url.toString();
  } catch {
    return fallback;
  }
}

function normalizeFolderIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0)
    .map((item) => Math.trunc(item)))];
}

export function normalizeOpusId(value) {
  const match = text(value, 100).match(/(?:opus:|\/opus\/)?(\d{6,30})/i);
  return match?.[1] || "";
}

export function buildArticleSourceKey(opusId) {
  const normalized = normalizeOpusId(opusId);
  return normalized ? `opus:${normalized}` : "";
}

export function normalizeFavoriteArticle(raw, fallbackTimestamp = Date.now()) {
  const source = raw && typeof raw === "object" ? raw : {};
  const opusId = normalizeOpusId(source.opusId || source.sourceKey || source.sourceUrl);
  if (!opusId) throw new Error("Article opus id is required");
  const sourceKey = buildArticleSourceKey(opusId);
  const sourceUrl = safeUrl(source.sourceUrl, `https://www.bilibili.com/opus/${opusId}`);
  const title = text(source.title, MAX_TITLE_LENGTH) || `Bilibili 专栏 ${opusId}`;
  const content = text(source.content, MAX_CONTENT_LENGTH);
  const summary = text(source.summary, MAX_SUMMARY_LENGTH) || content.slice(0, 600);
  const savedAt = Math.max(0, Number(source.savedAt) || fallbackTimestamp);
  const updatedAt = Math.max(savedAt, Number(source.updatedAt) || savedAt);
  return {
    sourceKey,
    opusId,
    title,
    summary,
    content,
    coverUrl: safeUrl(source.coverUrl),
    authorName: text(source.authorName, 160),
    authorMid: text(source.authorMid, 64),
    authorAvatarUrl: safeUrl(source.authorAvatarUrl),
    sourceUrl,
    folderIds: normalizeFolderIds(source.folderIds),
    savedAt,
    updatedAt,
  };
}

export function normalizeStoredFavoriteArticle(raw, fallbackId = 1, fallbackTimestamp = Date.now()) {
  try {
    const normalized = normalizeFavoriteArticle(raw, fallbackTimestamp);
    const id = Math.max(1, Number(raw?.id) || fallbackId);
    return { ...normalized, id };
  } catch {
    return null;
  }
}
