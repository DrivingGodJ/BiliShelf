export type FavoriteArticleRecord = {
  sourceKey: string;
  opusId: string;
  title: string;
  summary: string;
  content: string;
  coverUrl: string;
  authorName: string;
  authorMid: string;
  authorAvatarUrl: string;
  sourceUrl: string;
  folderIds: number[];
  savedAt: number;
  updatedAt: number;
};

export function normalizeOpusId(value: unknown): string;
export function buildArticleSourceKey(opusId: unknown): string;
export function normalizeFavoriteArticle(
  raw: unknown,
  fallbackTimestamp?: number,
): FavoriteArticleRecord;
export function normalizeStoredFavoriteArticle(
  raw: unknown,
  fallbackId?: number,
  fallbackTimestamp?: number,
): (FavoriteArticleRecord & { id: number }) | null;
