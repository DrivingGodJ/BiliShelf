export const FOLDER_PLAYBACK_STORAGE_KEY: "folderPlaybackSession";
export const FOLDER_PLAYBACK_QUEUE_CAP: 1000;

export type FolderPlaybackQueueItem = {
  id: number | null;
  videoId: number | null;
  bvid: string | null;
  title: string | null;
  url: string | null;
  coverUrl: string | null;
  isInvalid: boolean;
};

export type FolderPlaybackVideoInput = Partial<FolderPlaybackQueueItem> & {
  id?: number | null;
  videoId?: number | null;
  isInvalid?: boolean;
};

export type FolderPlaybackSession = {
  queue: FolderPlaybackQueueItem[];
  currentIndex: number;
  [key: string]: unknown;
};

export function normalizePlaybackSession(
  session: unknown
): FolderPlaybackSession | null;

export function buildFolderPlaybackSession(
  videos?: Array<FolderPlaybackVideoInput | null | undefined>
): {
  queue: FolderPlaybackQueueItem[];
  skippedInvalid: number;
  truncated: boolean;
};

export function findPlaybackQueueIndex(
  queue?: FolderPlaybackQueueItem[],
  cursor?: { videoId?: number; bvid?: string }
): number;

export function getAdjacentPlaybackItems(
  queue?: FolderPlaybackQueueItem[],
  currentIndex?: number
): {
  previous: { disabled: boolean; item: FolderPlaybackQueueItem | null };
  next: { disabled: boolean; item: FolderPlaybackQueueItem | null };
};
