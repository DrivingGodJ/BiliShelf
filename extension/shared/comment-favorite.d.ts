export type NormalizedFavoriteComment = {
  sourceKey: string;
  rpid: string;
  rootRpid: string;
  bvid: string;
  videoTitle: string;
  videoUrl: string;
  sourceUrl: string;
  content: string;
  contentImageUrls: string[];
  authorName: string;
  authorMid: string;
  authorAvatarUrl: string;
  authorSpaceUrl: string;
  replyToName: string;
  likeCount: number;
  publishedAt: number | null;
  publishedAtText: string;
};

export declare function parseBilibiliCount(value: unknown): number;
export declare function parseCommentPublishedAt(value: unknown, nowValue?: number): number | null;
export declare function createCommentSourceKey(raw: unknown): string;
export declare function buildCommentSourceUrl(raw: unknown): string;
export declare function normalizeFavoriteComment(raw: unknown, nowValue?: number): NormalizedFavoriteComment;
