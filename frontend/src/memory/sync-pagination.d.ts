export const MAX_FAVORITE_SYNC_PAGES: number;
export const FAVORITE_REMOVAL_SYNC_VERSION: number;
export function shouldContinueFavoriteSync(options: {
  hasMore: unknown;
  page: number;
  maxPages?: number;
}): boolean;
export function shouldReconcileFavoriteSync(options: {
  mode: "full" | "quick";
  previousRemoteCount: number;
  remoteCount: number;
  removalSyncVersion: number;
}): boolean;
