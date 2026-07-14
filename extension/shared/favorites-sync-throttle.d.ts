export type FavoritesSyncThrottleState = {
  folderMediaCount: number;
  folderPressure: number;
  pagesFetched: number;
  folderVideosProcessed: number;
  totalVideosProcessed: number;
  slowResponseStreak: number;
  lastResponseMs: number;
};

export type FavoritesSyncRetryPolicy = {
  attempt: number;
  delayMs: number;
  nextRetryAt: number;
  automatic: boolean;
  reason: string;
  riskCount: number;
};

export type FavoritesSyncFailurePolicy = FavoritesSyncRetryPolicy & {
  phase: "paused" | "waiting";
};

export function resolveTransientRetryPolicy(options?: {
  attempt?: number;
  detectedAt?: number;
  retryAfterMs?: number | null;
  previousRiskCount?: number;
  random?: () => number;
}): FavoritesSyncRetryPolicy;

export function resolveRiskPausePolicy(options?: {
  attempt?: number;
  detectedAt?: number;
  previousRiskCount?: number;
  random?: () => number;
}): FavoritesSyncRetryPolicy;

export function resolveFavoritesFailurePolicy(options?: {
  status?: number;
  message?: string;
  attempt?: number;
  detectedAt?: number;
  retryAfterMs?: number | null;
  previousRiskCount?: number;
  random?: () => number;
}): FavoritesSyncFailurePolicy | {
  phase: "failed";
  attempt: number;
  delayMs: number;
  nextRetryAt: null;
  automatic: false;
  reason: string;
  riskCount: number;
};

export function resolveSuccessfulRetryAttempt(attempt: number): number;

export function createFavoritesSyncThrottleState(options?: {
  folderMediaCount?: number;
  totalVideosProcessed?: number;
}): FavoritesSyncThrottleState;

export function updateFavoritesSyncThrottleState(
  state: FavoritesSyncThrottleState,
  metrics?: {
    responseMs?: number;
    pageMediaCount?: number;
    totalVideosProcessed?: number;
  }
): FavoritesSyncThrottleState;

export function resolveFavoritesPageGapMs(
  state: FavoritesSyncThrottleState
): number;

export function resolveFavoritesFolderGapMs(
  state: FavoritesSyncThrottleState
): number;

export function resolveFavoritesCooldownPolicy(
  state: FavoritesSyncThrottleState
): {
  thresholdVideos: number;
  delayMs: number;
};
