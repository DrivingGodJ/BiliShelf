function toPositiveInt(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeRandom(random) {
  const sampled = typeof random === "function" ? Number(random()) : Math.random();
  return Number.isFinite(sampled) ? clamp(sampled, 0, 1) : 0.5;
}

export function resolveTransientRetryPolicy(options = {}) {
  const attempt = Math.max(1, toPositiveInt(options.attempt, 1));
  const detectedAt = Math.max(0, Number(options.detectedAt) || Date.now());
  const retryAfterMs = toPositiveInt(options.retryAfterMs);
  const exponentialMs = Math.min(2_000 * 2 ** Math.min(attempt - 1, 20), 300_000);
  const jitterMultiplier = 0.75 + normalizeRandom(options.random) * 0.5;
  const delayMs = retryAfterMs > 0
    ? retryAfterMs
    : Math.min(300_000, Math.round(exponentialMs * jitterMultiplier));
  return {
    attempt,
    delayMs,
    nextRetryAt: detectedAt + delayMs,
    automatic: true,
    reason: retryAfterMs > 0 ? "retry-after" : "transient",
    riskCount: Math.max(0, toPositiveInt(options.previousRiskCount)),
  };
}

export function resolveRiskPausePolicy(options = {}) {
  const detectedAt = Math.max(0, Number(options.detectedAt) || Date.now());
  const previousRiskCount = Math.max(0, toPositiveInt(options.previousRiskCount));
  const baseDelayMs = Math.min(15 * 60_000 * 2 ** Math.min(previousRiskCount, 3), 2 * 60 * 60_000);
  const jitterMultiplier = 0.9 + normalizeRandom(options.random) * 0.2;
  const delayMs = Math.min(
    2 * 60 * 60_000,
    Math.round(baseDelayMs * jitterMultiplier)
  );
  return {
    attempt: Math.max(1, toPositiveInt(options.attempt, 1)),
    delayMs,
    nextRetryAt: detectedAt + delayMs,
    automatic: false,
    reason: "risk-control",
    riskCount: previousRiskCount + 1,
  };
}

export function resolveFavoritesFailurePolicy(options = {}) {
  const status = Number(options.status) || 0;
  const message = String(options.message || "").toLowerCase();
  const riskBlocked = status === 412 || message.includes("risk") || message.includes("风控");
  if (riskBlocked) {
    return {
      phase: "paused",
      ...resolveRiskPausePolicy(options),
    };
  }

  const transient =
    status === 408 ||
    status === 429 ||
    status >= 500 ||
    message.includes("timeout") ||
    message.includes("network") ||
    message.includes("temporar");
  if (transient) {
    return {
      phase: "waiting",
      ...resolveTransientRetryPolicy(options),
    };
  }

  return {
    phase: "failed",
    attempt: Math.max(1, toPositiveInt(options.attempt, 1)),
    delayMs: 0,
    nextRetryAt: null,
    automatic: false,
    reason: "permanent",
    riskCount: Math.max(0, toPositiveInt(options.previousRiskCount)),
  };
}

export function resolveSuccessfulRetryAttempt(attempt) {
  return Math.max(0, toPositiveInt(attempt) - 1);
}

function resolveFolderPressure(folderMediaCount) {
  const count = toPositiveInt(folderMediaCount);
  if (count >= 5000) return 3;
  if (count >= 1500) return 2;
  if (count >= 300) return 1;
  return 0;
}

export function createFavoritesSyncThrottleState(options = {}) {
  const folderMediaCount = toPositiveInt(options.folderMediaCount);
  const totalVideosProcessed = toPositiveInt(options.totalVideosProcessed);

  return {
    folderMediaCount,
    folderPressure: resolveFolderPressure(folderMediaCount),
    pagesFetched: 0,
    folderVideosProcessed: 0,
    totalVideosProcessed,
    slowResponseStreak: 0,
    lastResponseMs: 0,
  };
}

export function updateFavoritesSyncThrottleState(state, metrics = {}) {
  const responseMs = toPositiveInt(metrics.responseMs);
  const pageMediaCount = toPositiveInt(metrics.pageMediaCount);
  const totalVideosProcessed = toPositiveInt(
    metrics.totalVideosProcessed,
    state?.totalVideosProcessed ?? 0
  );

  let slowResponseStreak = toPositiveInt(state?.slowResponseStreak);
  if (responseMs >= 2600) {
    slowResponseStreak = clamp(slowResponseStreak + 2, 0, 6);
  } else if (responseMs >= 1600) {
    slowResponseStreak = clamp(slowResponseStreak + 1, 0, 6);
  } else {
    slowResponseStreak = clamp(slowResponseStreak - 1, 0, 6);
  }

  return {
    ...(state ?? createFavoritesSyncThrottleState()),
    pagesFetched: toPositiveInt(state?.pagesFetched) + 1,
    folderVideosProcessed:
      toPositiveInt(state?.folderVideosProcessed) + pageMediaCount,
    totalVideosProcessed,
    slowResponseStreak,
    lastResponseMs: responseMs,
  };
}

export function resolveFavoritesPageGapMs(state) {
  const pressure = toPositiveInt(state?.folderPressure);
  const pagesFetched = toPositiveInt(state?.pagesFetched);
  const slowResponseStreak = toPositiveInt(state?.slowResponseStreak);
  const lastResponseMs = toPositiveInt(state?.lastResponseMs);

  let gapMs = 420 + pressure * 160;
  gapMs += Math.min(pagesFetched * 35, 210);
  gapMs += Math.min(slowResponseStreak * 140, 560);

  if (lastResponseMs >= 2600) {
    gapMs += 180;
  } else if (lastResponseMs >= 1600) {
    gapMs += 80;
  }

  return gapMs;
}

export function resolveFavoritesFolderGapMs(state) {
  const pressure = toPositiveInt(state?.folderPressure);
  const slowResponseStreak = toPositiveInt(state?.slowResponseStreak);

  return 700 + pressure * 220 + slowResponseStreak * 90;
}

export function resolveFavoritesCooldownPolicy(state) {
  const pressure = toPositiveInt(state?.folderPressure);
  const totalVideosProcessed = toPositiveInt(state?.totalVideosProcessed);
  const slowResponseStreak = toPositiveInt(state?.slowResponseStreak);
  const lastResponseMs = toPositiveInt(state?.lastResponseMs);
  const progressPenalty = Math.min(Math.floor(totalVideosProcessed / 800) * 40, 120);

  const thresholdVideos = clamp(
    520 - pressure * 80 - progressPenalty - slowResponseStreak * 30,
    160,
    520
  );

  let delayMs =
    10_000 +
    pressure * 4_000 +
    Math.min(Math.floor(totalVideosProcessed / 800) * 2_500, 7_500) +
    slowResponseStreak * 2_000;

  if (lastResponseMs >= 2600) {
    delayMs += 1_500;
  }

  return {
    thresholdVideos,
    delayMs,
  };
}
