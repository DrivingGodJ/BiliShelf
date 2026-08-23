import { buildFavoriteApiUrl, normalizeProxyBaseUrl } from "./favorite-link.js";
import type {
  BilibiliFavoriteMedia,
  BilibiliFavoritesResponse,
  MemoryVideo,
} from "./types";

const PAGE_SIZE = 40;

export class FavoriteApiError extends Error {
  code: number | null;

  constructor(message: string, code: number | null = null) {
    super(message);
    this.name = "FavoriteApiError";
    this.code = code;
  }
}

export async function fetchFavoritePage(options: {
  proxyBaseUrl: string;
  mediaId: number;
  page: number;
  signal?: AbortSignal;
}): Promise<BilibiliFavoritesResponse> {
  const proxyBaseUrl = normalizeProxyBaseUrl(options.proxyBaseUrl);
  if (!proxyBaseUrl) throw new FavoriteApiError("请先配置有效的只读数据代理地址");

  const url = buildFavoriteApiUrl(proxyBaseUrl, options.mediaId, options.page, PAGE_SIZE);
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: options.signal,
  });

  if (!response.ok) {
    if (response.status === 429 || response.status === 412) {
      throw new FavoriteApiError("B站暂时限制了同步请求，请稍后再试", response.status);
    }
    throw new FavoriteApiError(`数据代理请求失败（${response.status}）`, response.status);
  }

  const payload = (await response.json()) as BilibiliFavoritesResponse;
  if (payload.code !== 0) {
    if (payload.code === -403) {
      throw new FavoriteApiError("这个收藏夹是私密的，网页版目前只能读取公开收藏夹", payload.code);
    }
    throw new FavoriteApiError(payload.message || `B站接口返回错误 ${payload.code}`, payload.code);
  }
  if (!payload.data?.info) throw new FavoriteApiError("没有找到这个收藏夹");
  return payload;
}

function secureImageUrl(value: string | undefined): string {
  if (!value) return "";
  return value.replace(/^http:\/\//i, "https://");
}

function videoUrl(media: BilibiliFavoriteMedia): string {
  const bvid = media.bvid || media.bv_id || "";
  if (bvid) return `https://www.bilibili.com/video/${bvid}/`;
  return `https://www.bilibili.com/video/av${media.id}/`;
}

export function mapFavoriteMedia(
  mediaId: number,
  media: BilibiliFavoriteMedia,
  previous?: MemoryVideo,
  seenAt = Date.now(),
): MemoryVideo {
  const bvid = media.bvid || media.bv_id || previous?.bvid || "";
  const isInvalid = !media.title || media.title === "已失效视频" || !media.upper?.name;
  const preservePrevious = Boolean(previous && previous.title && previous.title !== "已失效视频");

  return {
    key: `${mediaId}:${media.type}:${media.id}`,
    mediaId,
    resourceId: media.id,
    resourceType: media.type,
    bvid,
    title: isInvalid && preservePrevious ? previous!.title : media.title || "已失效视频",
    coverUrl: secureImageUrl(
      isInvalid && preservePrevious ? previous!.coverUrl : media.cover,
    ),
    description:
      isInvalid && preservePrevious ? previous!.description : media.intro || "",
    uploader:
      isInvalid && preservePrevious ? previous!.uploader : media.upper?.name || "未知 UP 主",
    uploaderMid:
      media.upper?.mid ?? (isInvalid && preservePrevious ? previous!.uploaderMid : null),
    duration: media.duration ?? previous?.duration ?? 0,
    publishAt: media.pubtime ? media.pubtime * 1000 : previous?.publishAt ?? null,
    favoriteAt: media.fav_time ? media.fav_time * 1000 : previous?.favoriteAt ?? seenAt,
    videoUrl: videoUrl(media),
    isInvalid,
    active: true,
    firstSeenAt: previous?.firstSeenAt ?? seenAt,
    lastSeenAt: seenAt,
  };
}

export { PAGE_SIZE };
