export const MAX_FAVORITE_SYNC_PAGES = 2500;
export const FAVORITE_REMOVAL_SYNC_VERSION = 1;

export function shouldContinueFavoriteSync({ hasMore, page, maxPages = MAX_FAVORITE_SYNC_PAGES }) {
  return Boolean(hasMore) && page < maxPages;
}

export function shouldReconcileFavoriteSync({
  mode,
  previousRemoteCount,
  remoteCount,
  removalSyncVersion,
}) {
  return mode === "quick"
    && (
      !Number.isSafeInteger(removalSyncVersion)
      || removalSyncVersion < FAVORITE_REMOVAL_SYNC_VERSION
      || (
        Number.isSafeInteger(previousRemoteCount)
        && Number.isSafeInteger(remoteCount)
        && previousRemoteCount > 0
        && remoteCount >= 0
        && remoteCount < previousRemoteCount
      )
    );
}
