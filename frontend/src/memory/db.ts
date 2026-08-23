import type { MemorySettings, MemoryVideo } from "./types";

const DB_NAME = "bilishelf-memory-web";
const DB_VERSION = 1;
const VIDEO_STORE = "videos";
const SETTINGS_STORE = "settings";

let databasePromise: Promise<IDBDatabase> | null = null;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("本地数据库操作失败"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("本地数据库事务失败"));
    transaction.onabort = () => reject(transaction.error ?? new Error("本地数据库事务已取消"));
  });
}

export function openMemoryDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(VIDEO_STORE)) {
        const videos = database.createObjectStore(VIDEO_STORE, { keyPath: "key" });
        videos.createIndex("mediaId", "mediaId", { unique: false });
        videos.createIndex("favoriteAt", "favoriteAt", { unique: false });
        videos.createIndex("active", "active", { unique: false });
      }
      if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
        database.createObjectStore(SETTINGS_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      databasePromise = null;
      reject(request.error ?? new Error("无法打开本地数据库"));
    };
  });

  return databasePromise;
}

export async function readSettings(): Promise<MemorySettings | null> {
  const database = await openMemoryDatabase();
  const transaction = database.transaction(SETTINGS_STORE, "readonly");
  const value = await requestResult(
    transaction.objectStore(SETTINGS_STORE).get("current") as IDBRequest<MemorySettings | undefined>,
  );
  return value ?? null;
}

export async function writeSettings(settings: MemorySettings): Promise<void> {
  const database = await openMemoryDatabase();
  const transaction = database.transaction(SETTINGS_STORE, "readwrite");
  transaction.objectStore(SETTINGS_STORE).put(settings);
  await transactionDone(transaction);
}

export async function readVideos(mediaId: number): Promise<MemoryVideo[]> {
  if (!mediaId) return [];
  const database = await openMemoryDatabase();
  const transaction = database.transaction(VIDEO_STORE, "readonly");
  const index = transaction.objectStore(VIDEO_STORE).index("mediaId");
  const items = await requestResult(index.getAll(IDBKeyRange.only(mediaId)) as IDBRequest<MemoryVideo[]>);
  return items.sort((left, right) => right.favoriteAt - left.favoriteAt);
}

export async function upsertVideos(items: MemoryVideo[]): Promise<void> {
  if (!items.length) return;
  const database = await openMemoryDatabase();
  const transaction = database.transaction(VIDEO_STORE, "readwrite");
  const store = transaction.objectStore(VIDEO_STORE);
  for (const item of items) store.put(item);
  await transactionDone(transaction);
}

export async function markMissingVideosInactive(mediaId: number, seenKeys: Set<string>): Promise<void> {
  const database = await openMemoryDatabase();
  const readTransaction = database.transaction(VIDEO_STORE, "readonly");
  const existing = await requestResult(
    readTransaction.objectStore(VIDEO_STORE).index("mediaId").getAll(IDBKeyRange.only(mediaId)) as IDBRequest<MemoryVideo[]>,
  );

  const missing = existing.filter((item) => item.active && !seenKeys.has(item.key));
  if (!missing.length) return;

  const writeTransaction = database.transaction(VIDEO_STORE, "readwrite");
  const store = writeTransaction.objectStore(VIDEO_STORE);
  const now = Date.now();
  for (const item of missing) {
    store.put({ ...item, active: false, lastSeenAt: now });
  }
  await transactionDone(writeTransaction);
}

export async function clearCollection(mediaId: number): Promise<void> {
  const items = await readVideos(mediaId);
  if (!items.length) return;
  const database = await openMemoryDatabase();
  const transaction = database.transaction(VIDEO_STORE, "readwrite");
  const store = transaction.objectStore(VIDEO_STORE);
  for (const item of items) store.delete(item.key);
  await transactionDone(transaction);
}
