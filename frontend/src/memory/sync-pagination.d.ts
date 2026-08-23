export const MAX_FAVORITE_SYNC_PAGES: number;
export function shouldContinueFavoriteSync(options: {
  hasMore: unknown;
  page: number;
  maxPages?: number;
}): boolean;
