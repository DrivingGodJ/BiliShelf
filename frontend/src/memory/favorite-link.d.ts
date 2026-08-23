export function parseFavoriteMediaId(input: unknown): number | null;
export function parseBilibiliUid(input: unknown): number | null;
export function normalizeProxyBaseUrl(input: unknown): string;
export function migrateLegacyOfficialProxyBaseUrl(input: unknown, replacement: unknown): string;
export function buildFavoriteApiUrl(
  proxyBaseUrl: string,
  mediaId: number,
  page: number,
  pageSize?: number,
  fresh?: boolean,
): string;
export function buildFavoriteFoldersApiUrl(proxyBaseUrl: string, uid: number): string;
