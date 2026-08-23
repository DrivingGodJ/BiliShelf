export const MAX_FAVORITE_SYNC_PAGES = 2500;

export function shouldContinueFavoriteSync({ hasMore, page, maxPages = MAX_FAVORITE_SYNC_PAGES }) {
  return Boolean(hasMore) && page < maxPages;
}
