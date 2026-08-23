<script setup lang="ts">
import {
  CalendarClock,
  CalendarDays,
  ChevronDown,
  Clock3,
  Database,
  Dice5,
  FolderOpen,
  Grid2X2,
  Heart,
  History,
  Link2,
  ListTree,
  LoaderCircle,
  RefreshCcw,
  Search,
  Settings2,
  Shuffle,
  Sparkles,
  Square,
  UserRoundSearch,
} from "lucide-vue-next";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { fetchFavoriteFolders, fetchFavoritePage, mapFavoriteMedia } from "./api";
import {
  markMissingVideosInactive,
  readSettings,
  readVideos,
  upsertVideos,
  writeSettings,
} from "./db";
import { formatCount, formatFavoriteDate } from "./format";
import {
  normalizeProxyBaseUrl,
  parseBilibiliUid,
  parseFavoriteMediaId,
} from "./favorite-link.js";
import {
  filterMemories,
  memoriesOnThisDay,
  pickRandomMemory,
  shanghaiDateKey,
  shanghaiDateParts,
} from "./memory-filters.js";
import { shouldContinueFavoriteSync } from "./sync-pagination.js";
import MemoryVideoCard from "./components/MemoryVideoCard.vue";
import RandomMemoryDialog from "./components/RandomMemoryDialog.vue";
import type {
  BilibiliFavoritesResponse,
  BilibiliFavoriteFolder,
  MemorySettings,
  MemoryVideo,
  SyncProgress,
} from "./types";

const DEFAULT_SETTINGS: MemorySettings = {
  key: "current",
  collectionUrl: "",
  mediaId: 0,
  folderTitle: "",
  ownerName: "",
  ownerMid: 0,
  mediaCount: 0,
  proxyBaseUrl: "",
  lastSyncAt: null,
};

const environmentProxy = String(import.meta.env.VITE_PUBLIC_PROXY_URL || "").trim();
const localProxy = ["localhost", "127.0.0.1"].includes(window.location.hostname)
  ? "http://localhost:8787"
  : "";

const settings = ref<MemorySettings>({ ...DEFAULT_SETTINGS });
const videos = ref<MemoryVideo[]>([]);
const loading = ref(true);
const setupMode = ref(true);
const linkInput = ref("");
const uidInput = ref("");
const folders = ref<BilibiliFavoriteFolder[]>([]);
const folderLoading = ref(false);
const linkPanelOpen = ref(false);
const proxyInput = ref(environmentProxy || localProxy);
const proxyPanelOpen = ref(false);
const syncing = ref(false);
const syncProgress = ref<SyncProgress | null>(null);
const errorMessage = ref("");
const noticeMessage = ref("");
const query = ref("");
const selectedYear = ref(0);
const selectedMonth = ref(0);
const selectedDay = ref(0);
const viewMode = ref<"timeline" | "grid">("timeline");
const visibleCount = ref(60);
const randomVideo = ref<MemoryVideo | null>(null);
const randomSourceLabel = ref("从全部收藏中随机抽取");
const previousRandomKey = ref("");
const randomPoolMode = ref<"current" | "today">("current");
let syncController: AbortController | null = null;

const activeVideos = computed(() => videos.value.filter((item) => item.active));
const archivedCount = computed(() => videos.value.length - activeVideos.value.length);

const years = computed(() => {
  const result = new Set<number>();
  for (const video of activeVideos.value) result.add(shanghaiDateParts(video.favoriteAt).year);
  return [...result].filter(Boolean).sort((left, right) => right - left);
});

const months = computed(() => {
  if (!selectedYear.value) return [];
  const result = new Set<number>();
  for (const video of activeVideos.value) {
    const date = shanghaiDateParts(video.favoriteAt);
    if (date.year === selectedYear.value) result.add(date.month);
  }
  return [...result].sort((left, right) => left - right);
});

const days = computed(() => {
  if (!selectedYear.value || !selectedMonth.value) return [];
  const result = new Set<number>();
  for (const video of activeVideos.value) {
    const date = shanghaiDateParts(video.favoriteAt);
    if (date.year === selectedYear.value && date.month === selectedMonth.value) {
      result.add(date.day);
    }
  }
  return [...result].sort((left, right) => left - right);
});

const filteredVideos = computed(() =>
  filterMemories(videos.value, {
    query: query.value,
    year: selectedYear.value,
    month: selectedMonth.value,
    day: selectedDay.value,
    activeOnly: true,
  }),
);

const visibleVideos = computed(() => filteredVideos.value.slice(0, visibleCount.value));

const timelineGroups = computed(() => {
  const groups = new Map<string, MemoryVideo[]>();
  for (const video of visibleVideos.value) {
    const key = shanghaiDateKey(video.favoriteAt);
    const group = groups.get(key) ?? [];
    group.push(video);
    groups.set(key, group);
  }
  return [...groups.entries()].map(([key, items]) => ({ key, items }));
});

const filterDescription = computed(() => {
  const parts: string[] = [];
  if (selectedYear.value) parts.push(`${selectedYear.value} 年`);
  if (selectedMonth.value) parts.push(`${selectedMonth.value} 月`);
  if (selectedDay.value) parts.push(`${selectedDay.value} 日`);
  if (query.value.trim()) parts.push(`“${query.value.trim()}”`);
  return parts.length ? parts.join(" · ") : "全部时光";
});

const earliestFavoriteAt = computed(() => {
  if (!activeVideos.value.length) return null;
  return Math.min(...activeVideos.value.map((item) => item.favoriteAt));
});

const latestFavoriteAt = computed(() => {
  if (!activeVideos.value.length) return null;
  return Math.max(...activeVideos.value.map((item) => item.favoriteAt));
});

const syncPercent = computed(() => {
  const progress = syncProgress.value;
  if (!progress?.total) return 0;
  return Math.min(100, Math.round((progress.fetched / progress.total) * 100));
});

watch(selectedYear, () => {
  if (!months.value.includes(selectedMonth.value)) selectedMonth.value = 0;
  selectedDay.value = 0;
});

watch(selectedMonth, () => {
  if (!days.value.includes(selectedDay.value)) selectedDay.value = 0;
});

watch([query, selectedYear, selectedMonth, selectedDay, viewMode], () => {
  visibleCount.value = 60;
});

function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(new DOMException("同步已暂停", "AbortError"));
      },
      { once: true },
    );
  });
}

function canonicalCollectionUrl(mediaId: number): string {
  return `https://www.bilibili.com/list/ml${mediaId}`;
}

function clearMessages() {
  errorMessage.value = "";
  noticeMessage.value = "";
}

async function loadLocalCollection(mediaId: number) {
  videos.value = await readVideos(mediaId);
}

function updateSettingsFromResponse(
  previous: MemorySettings,
  payload: BilibiliFavoritesResponse,
  mediaId: number,
  collectionUrl: string,
  proxyBaseUrl: string,
): MemorySettings {
  const info = payload.data?.info;
  return {
    ...previous,
    key: "current",
    mediaId,
    collectionUrl: collectionUrl || canonicalCollectionUrl(mediaId),
    proxyBaseUrl,
    folderTitle: info?.title || previous.folderTitle || "默认收藏夹",
    ownerName: info?.upper?.name || previous.ownerName || "",
    ownerMid: info?.upper?.mid ?? previous.ownerMid ?? 0,
    mediaCount: info?.media_count ?? previous.mediaCount,
  };
}

async function syncCollection(options: {
  mediaId: number;
  collectionUrl: string;
  proxyBaseUrl: string;
  mode: "full" | "quick";
}) {
  if (syncing.value) return;
  clearMessages();
  syncing.value = true;
  syncController = new AbortController();

  const signal = syncController.signal;
  const existing = await readVideos(options.mediaId);
  const existingByKey = new Map(existing.map((item) => [item.key, item]));
  const seenKeys = new Set<string>();
  const firstSync = existing.length === 0;
  const effectiveMode = firstSync ? "full" : options.mode;
  let page = 1;
  let fetched = 0;
  let total = settings.value.mediaCount || 0;
  let nextSettings = { ...settings.value };

  try {
    while (true) {
      syncProgress.value = {
        mode: effectiveMode,
        page,
        fetched,
        total,
        message: page === 1 ? "正在确认收藏夹…" : `正在读取第 ${page} 页…`,
      };

      const payload = await fetchFavoritePage({
        proxyBaseUrl: options.proxyBaseUrl,
        mediaId: options.mediaId,
        page,
        signal,
      });

      if (page === 1) {
        nextSettings = updateSettingsFromResponse(
          nextSettings,
          payload,
          options.mediaId,
          options.collectionUrl,
          options.proxyBaseUrl,
        );
        total = nextSettings.mediaCount;
        settings.value = nextSettings;
        setupMode.value = false;
        linkInput.value = nextSettings.collectionUrl;
        await writeSettings(nextSettings);
      }

      const rawItems = payload.data?.medias ?? [];
      const seenAt = Date.now();
      let unchangedOnPage = 0;
      const mapped = rawItems.map((raw) => {
        const key = `${options.mediaId}:${raw.type}:${raw.id}`;
        const previous = existingByKey.get(key);
        if (
          previous &&
          previous.favoriteAt === (raw.fav_time ? raw.fav_time * 1000 : previous.favoriteAt)
        ) {
          unchangedOnPage += 1;
        }
        const item = mapFavoriteMedia(options.mediaId, raw, previous, seenAt);
        existingByKey.set(item.key, item);
        seenKeys.add(item.key);
        return item;
      });

      await upsertVideos(mapped);
      videos.value = [...existingByKey.values()].sort(
        (left, right) => right.favoriteAt - left.favoriteAt,
      );
      fetched += mapped.length;
      syncProgress.value = {
        mode: effectiveMode,
        page,
        fetched,
        total,
        message: `已读取 ${formatCount(fetched)} 条收藏`,
      };

      const hasMore = shouldContinueFavoriteSync({
        hasMore: payload.data?.has_more,
        page,
      });
      const reachedKnownHistory =
        effectiveMode === "quick" &&
        page >= 2 &&
        rawItems.length > 0 &&
        unchangedOnPage === rawItems.length;

      if (!hasMore || reachedKnownHistory) break;
      page += 1;
      await wait(effectiveMode === "full" ? 720 : 520, signal);
    }

    if (effectiveMode === "full") {
      await markMissingVideosInactive(options.mediaId, seenKeys);
    }

    nextSettings = {
      ...nextSettings,
      lastSyncAt: Date.now(),
      proxyBaseUrl: options.proxyBaseUrl,
    };
    settings.value = nextSettings;
    proxyInput.value = nextSettings.proxyBaseUrl;
    await writeSettings(nextSettings);
    await loadLocalCollection(options.mediaId);
    noticeMessage.value = effectiveMode === "full"
      ? `完整同步完成，共保存 ${formatCount(activeVideos.value.length)} 条收藏。`
      : `已检查最新收藏，本地共有 ${formatCount(activeVideos.value.length)} 条记录。`;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      noticeMessage.value = "同步已暂停，已经读到本地的数据会保留。";
      await loadLocalCollection(options.mediaId);
    } else {
      errorMessage.value = error instanceof Error ? error.message : "同步失败，请稍后再试";
    }
  } finally {
    syncing.value = false;
    syncController = null;
    window.setTimeout(() => {
      if (!syncing.value) syncProgress.value = null;
    }, 1200);
  }
}

async function connectCollection() {
  const mediaId = parseFavoriteMediaId(linkInput.value);
  if (!mediaId) {
    errorMessage.value = "没有识别出收藏夹 ID，请粘贴包含 ml… 或 fid=… 的完整链接。";
    return;
  }
  const proxyBaseUrl = normalizeProxyBaseUrl(proxyInput.value);
  if (!proxyBaseUrl) {
    proxyPanelOpen.value = true;
    errorMessage.value = "请先填写已经部署好的只读数据代理地址。";
    return;
  }

  await syncCollection({
    mediaId,
    collectionUrl: linkInput.value.trim() || canonicalCollectionUrl(mediaId),
    proxyBaseUrl,
    mode: "full",
  });
}

async function findFavoriteFolders() {
  clearMessages();
  const uid = parseBilibiliUid(uidInput.value);
  if (!uid) {
    errorMessage.value = "请输入有效的 B站 UID，或粘贴 space.bilibili.com 开头的个人空间链接。";
    return;
  }

  const proxyBaseUrl = normalizeProxyBaseUrl(proxyInput.value);
  if (!proxyBaseUrl) {
    proxyPanelOpen.value = true;
    errorMessage.value = "请先填写已经部署好的只读数据代理地址。";
    return;
  }

  folderLoading.value = true;
  folders.value = [];
  try {
    folders.value = await fetchFavoriteFolders({ proxyBaseUrl, uid });
    if (!folders.value.length) {
      errorMessage.value = "没有找到可公开读取的收藏夹，请检查 UID 是否正确。";
      return;
    }
    noticeMessage.value = `找到 ${folders.value.length} 个收藏夹，请选择一个导入。`;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "收藏夹查询失败，请稍后再试";
  } finally {
    folderLoading.value = false;
  }
}

async function connectFavoriteFolder(folder: BilibiliFavoriteFolder) {
  if (!folder.id) return;
  const proxyBaseUrl = normalizeProxyBaseUrl(proxyInput.value);
  if (!proxyBaseUrl) {
    proxyPanelOpen.value = true;
    errorMessage.value = "请先填写已经部署好的只读数据代理地址。";
    return;
  }
  const collectionUrl = canonicalCollectionUrl(folder.id);
  linkInput.value = collectionUrl;
  await syncCollection({
    mediaId: folder.id,
    collectionUrl,
    proxyBaseUrl,
    mode: "full",
  });
}

async function refreshCurrent(mode: "full" | "quick") {
  if (!settings.value.mediaId) return;
  const proxyBaseUrl = normalizeProxyBaseUrl(proxyInput.value || settings.value.proxyBaseUrl);
  if (!proxyBaseUrl) {
    proxyPanelOpen.value = true;
    errorMessage.value = "请先配置只读数据代理地址。";
    return;
  }
  await syncCollection({
    mediaId: settings.value.mediaId,
    collectionUrl: settings.value.collectionUrl,
    proxyBaseUrl,
    mode,
  });
}

function stopSync() {
  syncController?.abort();
}

function openSetup() {
  setupMode.value = true;
  linkInput.value = settings.value.collectionUrl;
  uidInput.value = settings.value.ownerMid ? String(settings.value.ownerMid) : "";
  folders.value = [];
  proxyInput.value = settings.value.proxyBaseUrl || environmentProxy || localProxy;
  clearMessages();
}

function cancelSetup() {
  if (!settings.value.mediaId) return;
  setupMode.value = false;
  clearMessages();
}

async function saveProxy() {
  const proxyBaseUrl = normalizeProxyBaseUrl(proxyInput.value);
  if (!proxyBaseUrl) {
    errorMessage.value = "代理地址必须是 HTTPS 地址；本地开发可以使用 localhost。";
    return;
  }
  settings.value = { ...settings.value, proxyBaseUrl };
  await writeSettings(settings.value);
  proxyPanelOpen.value = false;
  noticeMessage.value = "代理地址已保存在这台设备上。";
}

function resetFilters() {
  query.value = "";
  selectedYear.value = 0;
  selectedMonth.value = 0;
  selectedDay.value = 0;
}

function showRandom(video: MemoryVideo, sourceLabel: string) {
  randomVideo.value = video;
  previousRandomKey.value = video.key;
  randomSourceLabel.value = sourceLabel;
}

function randomFromCurrent() {
  const pool = filteredVideos.value.length ? filteredVideos.value : activeVideos.value;
  const video = pickRandomMemory(pool, previousRandomKey.value);
  if (!video) {
    errorMessage.value = "还没有可以抽取的收藏，请先同步。";
    return;
  }
  randomPoolMode.value = "current";
  showRandom(video, filteredVideos.value.length === activeVideos.value.length
    ? "从全部收藏中随机抽取"
    : `从“${filterDescription.value}”中随机抽取`);
}

function randomOnThisDay() {
  const pool = memoriesOnThisDay(activeVideos.value);
  if (!pool.length) {
    noticeMessage.value = "往年的今天没有收藏记录，替你从全部时光里抽了一段。";
    randomFromCurrent();
    return;
  }
  const video = pickRandomMemory(pool, previousRandomKey.value);
  if (video) {
    randomPoolMode.value = "today";
    showRandom(video, `那年今日 · 共找到 ${pool.length} 段回忆`);
  }
}

function rememberVideo(video: MemoryVideo) {
  randomPoolMode.value = "current";
  showRandom(video, "你从时间轴中翻到的回忆");
}

function randomAgain() {
  if (randomPoolMode.value === "today") {
    randomOnThisDay();
    return;
  }
  randomFromCurrent();
}

function loadMore() {
  visibleCount.value += 60;
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") randomVideo.value = null;
}

onMounted(async () => {
  window.addEventListener("keydown", handleKeydown);
  try {
    const stored = await readSettings();
    settings.value = stored
      ? { ...DEFAULT_SETTINGS, ...stored }
      : { ...DEFAULT_SETTINGS, proxyBaseUrl: environmentProxy || localProxy };
    linkInput.value = settings.value.collectionUrl;
    uidInput.value = settings.value.ownerMid ? String(settings.value.ownerMid) : "";
    proxyInput.value = settings.value.proxyBaseUrl || environmentProxy || localProxy;
    setupMode.value = !settings.value.mediaId;
    if (settings.value.mediaId) {
      await loadLocalCollection(settings.value.mediaId);
      const stale = !settings.value.lastSyncAt || Date.now() - settings.value.lastSyncAt > 30 * 60 * 1000;
      if (stale && proxyInput.value) void refreshCurrent("quick");
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "读取本地收藏失败";
  } finally {
    loading.value = false;
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeydown);
  syncController?.abort();
});
</script>

<template>
  <main class="memory-shell">
    <header class="site-header">
      <a class="brand" href="./" aria-label="拾光首页">
        <span class="brand__mark"><History :size="21" /></span>
        <span>
          <strong>拾光</strong>
          <small>BiliShelf Memory</small>
        </span>
      </a>
      <div class="site-header__note"><Heart :size="15" /> 本地保存，只读同步</div>
    </header>

    <section v-if="loading" class="loading-stage">
      <LoaderCircle class="spin" :size="28" />
      <p>正在打开你的时光机…</p>
    </section>

    <template v-else>
      <section v-if="setupMode" class="setup-stage">
        <div class="setup-stage__copy">
          <p class="kicker"><Sparkles :size="16" /> 把收藏变成可以重访的时间</p>
          <h1>输入你的 UID，<br />找到收藏的过去。</h1>
          <p class="setup-stage__lead">
            不用在手机里翻收藏夹链接。输入 B站 UID，选择一个可访问的收藏夹，拾光会按收藏日期建立本地索引。
          </p>

          <div class="setup-form">
            <form class="setup-method" @submit.prevent="findFavoriteFolders">
              <label for="account-uid">B站 UID 或个人空间链接</label>
              <div class="setup-form__row">
                <span class="input-icon"><UserRoundSearch :size="19" /></span>
                <input
                  id="account-uid"
                  v-model="uidInput"
                  type="text"
                  inputmode="numeric"
                  autocomplete="off"
                  placeholder="例如 220174771"
                  :disabled="syncing || folderLoading"
                />
                <button type="submit" class="button button--primary" :disabled="syncing || folderLoading">
                  <LoaderCircle v-if="folderLoading" class="spin" :size="17" />
                  <Search v-else :size="17" />
                  {{ folderLoading ? "正在查找" : "查找收藏夹" }}
                </button>
              </div>
            </form>

            <section v-if="folders.length" class="folder-picker" aria-live="polite">
              <div class="folder-picker__header">
                <span><FolderOpen :size="16" /> 选择要导入的收藏夹</span>
                <small>{{ folders.length }} 个</small>
              </div>
              <div class="folder-picker__list">
                <button
                  v-for="folder in folders"
                  :key="folder.id"
                  type="button"
                  class="folder-choice"
                  :disabled="syncing"
                  @click="connectFavoriteFolder(folder)"
                >
                  <FolderOpen :size="18" />
                  <span class="folder-choice__copy">
                    <strong>{{ folder.title || "未命名收藏夹" }}</strong>
                    <small>{{ formatCount(folder.media_count || 0) }} 条视频</small>
                  </span>
                  <span class="folder-choice__action">导入</span>
                </button>
              </div>
            </section>

            <div class="setup-divider">
              <span />
              <button type="button" @click="linkPanelOpen = !linkPanelOpen">
                {{ linkPanelOpen ? "收起链接导入" : "也可以直接使用收藏夹链接" }}
              </button>
              <span />
            </div>

            <form v-if="linkPanelOpen" class="setup-method link-import-panel" @submit.prevent="connectCollection">
              <label for="collection-link">收藏夹链接</label>
              <div class="setup-form__row">
                <span class="input-icon"><Link2 :size="19" /></span>
                <input
                  id="collection-link"
                  v-model="linkInput"
                  type="text"
                  autocomplete="off"
                  placeholder="https://www.bilibili.com/list/ml…"
                  :disabled="syncing"
                />
                <button type="submit" class="button button--quiet" :disabled="syncing">
                  <LoaderCircle v-if="syncing" class="spin" :size="17" />
                  <Clock3 v-else :size="17" />
                  {{ syncing ? "正在建立" : "直接导入" }}
                </button>
              </div>
            </form>

            <button
              type="button"
              class="proxy-toggle"
              @click="proxyPanelOpen = !proxyPanelOpen"
            >
              <Settings2 :size="15" /> 数据代理设置
              <ChevronDown :size="15" :class="{ 'rotate-180': proxyPanelOpen }" />
            </button>

            <div v-if="proxyPanelOpen || !proxyInput" class="proxy-panel">
              <label for="proxy-url">只读代理地址</label>
              <div class="proxy-panel__row">
                <input
                  id="proxy-url"
                  v-model="proxyInput"
                  type="url"
                  placeholder="https://your-worker.workers.dev"
                  :disabled="syncing"
                />
                <button type="button" class="button button--quiet" @click="saveProxy">保存</button>
              </div>
              <p>代理只转发公开收藏数据，不接收 B站 Cookie。部署时可预先配置，普通访客无需填写。</p>
            </div>

            <button
              v-if="settings.mediaId"
              type="button"
              class="button button--text"
              :disabled="syncing"
              @click="cancelSetup"
            >
              返回当前收藏夹
            </button>
          </div>

          <div v-if="syncProgress" class="sync-progress setup-progress">
            <div class="sync-progress__copy">
              <span>{{ syncProgress.message }}</span>
              <span>{{ syncPercent }}%</span>
            </div>
            <div class="sync-progress__track"><span :style="{ width: `${syncPercent}%` }" /></div>
            <button type="button" class="button button--text" @click="stopSync"><Square :size="13" /> 暂停同步</button>
          </div>

          <p v-if="errorMessage" class="message message--error">{{ errorMessage }}</p>
          <p v-if="noticeMessage" class="message message--notice">{{ noticeMessage }}</p>
        </div>

        <aside class="setup-stage__preview" aria-hidden="true">
          <div class="preview-orbit preview-orbit--one" />
          <div class="preview-orbit preview-orbit--two" />
          <div class="preview-date preview-date--one"><span>2019</span><strong>08.23</strong></div>
          <div class="preview-date preview-date--two"><span>2022</span><strong>04.17</strong></div>
          <div class="preview-date preview-date--three"><span>2026</span><strong>今天</strong></div>
          <div class="preview-center"><Shuffle :size="34" /><span>随机回忆</span></div>
        </aside>
      </section>

      <template v-else>
        <section class="collection-header">
          <div>
            <p class="kicker"><Database :size="15" /> 已保存在这台设备</p>
            <h1>{{ settings.folderTitle || "我的收藏时光" }}</h1>
            <p>
              {{ settings.ownerName ? `${settings.ownerName} · ` : "" }}{{ formatCount(activeVideos.length) }} 条收藏
              <span v-if="settings.lastSyncAt"> · 上次同步 {{ formatFavoriteDate(settings.lastSyncAt, true) }}</span>
            </p>
          </div>
          <div class="collection-header__actions">
            <button type="button" class="button button--quiet" :disabled="syncing" @click="openSetup">
              <FolderOpen :size="16" /> 更换收藏夹
            </button>
            <button type="button" class="button button--quiet" :disabled="syncing" @click="refreshCurrent('full')">
              <Database :size="16" /> 完整同步
            </button>
            <button type="button" class="button button--primary" :disabled="syncing" @click="refreshCurrent('quick')">
              <LoaderCircle v-if="syncing" class="spin" :size="16" />
              <RefreshCcw v-else :size="16" />
              {{ syncing ? "同步中" : "刷新最新" }}
            </button>
          </div>
        </section>

        <div v-if="syncProgress" class="sync-progress">
          <div class="sync-progress__copy">
            <span>{{ syncProgress.message }}</span>
            <span>{{ syncProgress.mode === "full" ? `${syncPercent}%` : `第 ${syncProgress.page} 页` }}</span>
          </div>
          <div class="sync-progress__track"><span :style="{ width: `${syncProgress.mode === 'full' ? syncPercent : 100}%` }" /></div>
          <button type="button" class="button button--text" @click="stopSync"><Square :size="13" /> 暂停</button>
        </div>
        <p v-if="errorMessage" class="message message--error">{{ errorMessage }}</p>
        <p v-if="noticeMessage" class="message message--notice">{{ noticeMessage }}</p>

        <section class="memory-hero">
          <div class="memory-hero__copy">
            <p class="kicker"><Sparkles :size="16" /> 今天想回到什么时候？</p>
            <h2>抽一段过去，<br />看看当时的你喜欢什么。</h2>
            <p>随机不是漫无目的，它只是替你打开一扇很久没碰过的门。</p>
            <div class="memory-hero__actions">
              <button type="button" class="button button--memory" @click="randomFromCurrent">
                <Dice5 :size="19" /> 随机回忆
              </button>
              <button type="button" class="button button--quiet-on-dark" @click="randomOnThisDay">
                <CalendarClock :size="18" /> 那年今日
              </button>
            </div>
          </div>
          <div class="memory-hero__numbers">
            <div><strong>{{ formatCount(activeVideos.length) }}</strong><span>段仍在收藏的记忆</span></div>
            <div><strong>{{ years.length }}</strong><span>个年份可以重访</span></div>
            <div v-if="archivedCount"><strong>{{ archivedCount }}</strong><span>段已取消但仍留档</span></div>
          </div>
        </section>

        <section class="filter-panel">
          <div class="search-field">
            <Search :size="18" />
            <input v-model="query" type="search" placeholder="搜索标题、UP主、简介或 BV号" />
          </div>
          <div class="date-selectors">
            <label>
              <span>年</span>
              <select v-model.number="selectedYear" aria-label="收藏年份">
                <option :value="0">全部年份</option>
                <option v-for="year in years" :key="year" :value="year">{{ year }} 年</option>
              </select>
            </label>
            <label>
              <span>月</span>
              <select v-model.number="selectedMonth" aria-label="收藏月份" :disabled="!selectedYear">
                <option :value="0">全部月份</option>
                <option v-for="month in months" :key="month" :value="month">{{ month }} 月</option>
              </select>
            </label>
            <label>
              <span>日</span>
              <select v-model.number="selectedDay" aria-label="收藏日期" :disabled="!selectedMonth">
                <option :value="0">全部日期</option>
                <option v-for="day in days" :key="day" :value="day">{{ day }} 日</option>
              </select>
            </label>
          </div>
          <button v-if="query || selectedYear" type="button" class="button button--text" @click="resetFilters">清除筛选</button>
        </section>

        <section class="results-section">
          <div class="results-header">
            <div>
              <p class="kicker"><CalendarDays :size="15" /> {{ filterDescription }}</p>
              <h2>找到 {{ formatCount(filteredVideos.length) }} 段回忆</h2>
              <p v-if="earliestFavoriteAt && latestFavoriteAt">
                {{ formatFavoriteDate(earliestFavoriteAt) }} — {{ formatFavoriteDate(latestFavoriteAt) }}
              </p>
            </div>
            <div class="view-toggle" aria-label="视图切换">
              <button type="button" :class="{ active: viewMode === 'timeline' }" @click="viewMode = 'timeline'">
                <ListTree :size="16" /> 时间轴
              </button>
              <button type="button" :class="{ active: viewMode === 'grid' }" @click="viewMode = 'grid'">
                <Grid2X2 :size="16" /> 网格
              </button>
            </div>
          </div>

          <div v-if="!filteredVideos.length" class="empty-state">
            <CalendarDays :size="31" />
            <h3>这一天暂时没有收藏</h3>
            <p>换个日期，或者让随机回忆替你选。</p>
            <button type="button" class="button button--primary" @click="resetFilters">查看全部收藏</button>
          </div>

          <div v-else-if="viewMode === 'grid'" class="memory-grid">
            <MemoryVideoCard
              v-for="video in visibleVideos"
              :key="video.key"
              :video="video"
              @remember="rememberVideo"
            />
          </div>

          <div v-else class="timeline">
            <section v-for="group in timelineGroups" :key="group.key" class="timeline-day">
              <div class="timeline-day__label">
                <span class="timeline-day__dot" />
                <time>{{ group.key }}</time>
                <small>{{ group.items.length }} 段</small>
              </div>
              <div class="memory-grid">
                <MemoryVideoCard
                  v-for="video in group.items"
                  :key="video.key"
                  :video="video"
                  @remember="rememberVideo"
                />
              </div>
            </section>
          </div>

          <button
            v-if="visibleCount < filteredVideos.length"
            type="button"
            class="button button--load-more"
            @click="loadMore"
          >
            再往前翻 60 段
          </button>
        </section>

        <p class="legacy-note">
          注：B站约 2020 年 7 月以前的部分老收藏可能共享同一个迁移时间，拾光会忠实显示接口现有数据，不猜测日期。
        </p>
      </template>
    </template>

    <footer class="site-footer">
      <span>拾光是基于 <a href="https://github.com/TLRKFXE/BiliShelf" target="_blank" rel="noreferrer">BiliShelf</a> 的本地优先改造。</span>
      <span>收藏数据属于你，也只留在你这里。</span>
    </footer>

    <RandomMemoryDialog
      v-if="randomVideo"
      :video="randomVideo"
      :source-label="randomSourceLabel"
      @close="randomVideo = null"
      @again="randomAgain"
    />
  </main>
</template>
