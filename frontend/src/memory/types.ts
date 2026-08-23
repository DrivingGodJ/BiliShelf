export type MemoryVideo = {
  key: string;
  mediaId: number;
  resourceId: number;
  resourceType: number;
  bvid: string;
  title: string;
  coverUrl: string;
  description: string;
  uploader: string;
  uploaderMid: number | null;
  duration: number;
  publishAt: number | null;
  favoriteAt: number;
  videoUrl: string;
  isInvalid: boolean;
  active: boolean;
  firstSeenAt: number;
  lastSeenAt: number;
};

export type MemorySettings = {
  key: "current";
  collectionUrl: string;
  mediaId: number;
  folderTitle: string;
  ownerName: string;
  ownerMid: number;
  mediaCount: number;
  proxyBaseUrl: string;
  lastSyncAt: number | null;
};

export type BilibiliFavoriteFolder = {
  id: number;
  fid?: number;
  mid?: number;
  title?: string;
  attr?: number;
  fav_state?: number;
  media_count?: number;
};

export type BilibiliFavoriteFoldersResponse = {
  code: number;
  message?: string;
  data?: {
    count?: number;
    list?: BilibiliFavoriteFolder[] | null;
  } | null;
};

export type BilibiliFavoriteMedia = {
  id: number;
  type: number;
  title?: string;
  cover?: string;
  intro?: string;
  duration?: number;
  upper?: {
    mid?: number;
    name?: string;
  } | null;
  pubtime?: number;
  fav_time?: number;
  bvid?: string;
  bv_id?: string;
};

export type BilibiliFavoritesResponse = {
  code: number;
  message?: string;
  data?: {
    info?: {
      id: number;
      title?: string;
      media_count?: number;
      upper?: {
        mid?: number;
        name?: string;
      } | null;
    } | null;
    medias?: BilibiliFavoriteMedia[] | null;
    has_more?: boolean;
  } | null;
};

export type SyncProgress = {
  mode: "full" | "quick";
  page: number;
  fetched: number;
  total: number;
  message: string;
};

export type DateParts = {
  year: number;
  month: number;
  day: number;
};
