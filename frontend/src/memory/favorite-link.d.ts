export function parseFavoriteMediaId(input: unknown): number | null;
export function normalizeProxyBaseUrl(input: unknown): string;
export function buildFavoriteApiUrl(
  proxyBaseUrl: string,
  mediaId: number,
  page: number,
  pageSize?: number,
): string;
