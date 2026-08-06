import { defineStore } from "pinia";
import { ref } from "vue";

export type Locale = "zh-CN" | "en-US";
type ThemeMode = "light" | "dark";

export const VIDEO_CARD_WIDTH_MIN = 220;
export const VIDEO_CARD_WIDTH_MAX = 420;
export const VIDEO_CARD_WIDTH_DEFAULT = 300;

const THEME_STORAGE_KEY = "bili-like-theme";
const LOCALE_STORAGE_KEY = "bili-like-locale";
const EXT_LOCALE_STORAGE_KEY = "bili_like_locale";
const VIDEO_CARD_WIDTH_STORAGE_KEY = "bili-like-video-card-width";
const COMMENT_CARD_WIDTH_STORAGE_KEY = "bili-like-comment-card-width";
const ARTICLE_CARD_WIDTH_STORAGE_KEY = "bili-like-article-card-width";

function normalizeCardWidth(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return VIDEO_CARD_WIDTH_DEFAULT;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return VIDEO_CARD_WIDTH_DEFAULT;
  return Math.min(
    VIDEO_CARD_WIDTH_MAX,
    Math.max(VIDEO_CARD_WIDTH_MIN, Math.round(parsed))
  );
}

function resolveInitialLocale(): Locale {
  const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (saved === "zh-CN" || saved === "en-US") return saved;
  const language = navigator.language.toLowerCase();
  return language.startsWith("zh") ? "zh-CN" : "en-US";
}

function resolveInitialTheme(): ThemeMode {
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export const useAppUiStore = defineStore("app-ui", () => {
  const locale = ref<Locale>("zh-CN");
  const isDark = ref(false);
  const videoCardWidth = ref(VIDEO_CARD_WIDTH_DEFAULT);
  const commentCardWidth = ref(VIDEO_CARD_WIDTH_DEFAULT);
  const articleCardWidth = ref(VIDEO_CARD_WIDTH_DEFAULT);
  const initialized = ref(false);

  function setLocale(next: Locale, persist = true) {
    locale.value = next;
    document.documentElement.lang = next;
    if (persist) {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
      try {
        const runtimeChrome = (globalThis as { chrome?: { storage?: { local?: { set: (items: Record<string, string>) => Promise<void> | void } } } }).chrome;
        if (runtimeChrome?.storage?.local) {
          void runtimeChrome.storage.local.set({ [EXT_LOCALE_STORAGE_KEY]: next });
        }
      } catch {
      }
    }
  }

  function toggleLocale() {
    setLocale(locale.value === "zh-CN" ? "en-US" : "zh-CN");
  }

  function applyTheme(mode: ThemeMode, persist = true) {
    const dark = mode === "dark";
    document.documentElement.classList.toggle("dark", dark);
    isDark.value = dark;
    if (persist) window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  }

  function withThemeTransition(updateTheme: () => void) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      updateTheme();
      return;
    }

    const root = document.documentElement;
    root.classList.add("theme-transition");
    updateTheme();
    window.setTimeout(() => root.classList.remove("theme-transition"), 140);
  }

  function setTheme(mode: ThemeMode, persist = true) {
    withThemeTransition(() => applyTheme(mode, persist));
  }

  function toggleTheme() {
    setTheme(isDark.value ? "light" : "dark");
  }

  function setVideoCardWidth(value: number, persist = true) {
    const next = normalizeCardWidth(value);
    videoCardWidth.value = next;
    if (persist) {
      window.localStorage.setItem(VIDEO_CARD_WIDTH_STORAGE_KEY, String(next));
    }
  }

  function setCommentCardWidth(value: number, persist = true) {
    const next = normalizeCardWidth(value);
    commentCardWidth.value = next;
    if (persist) {
      window.localStorage.setItem(COMMENT_CARD_WIDTH_STORAGE_KEY, String(next));
    }
  }

  function setArticleCardWidth(value: number, persist = true) {
    const next = normalizeCardWidth(value);
    articleCardWidth.value = next;
    if (persist) {
      window.localStorage.setItem(ARTICLE_CARD_WIDTH_STORAGE_KEY, String(next));
    }
  }

  function initFromStorage() {
    if (initialized.value) return;
    setLocale(resolveInitialLocale(), false);
    applyTheme(resolveInitialTheme(), false);
    const storedVideoCardWidth = window.localStorage.getItem(
      VIDEO_CARD_WIDTH_STORAGE_KEY,
    );
    videoCardWidth.value = normalizeCardWidth(storedVideoCardWidth);
    commentCardWidth.value = normalizeCardWidth(
      window.localStorage.getItem(COMMENT_CARD_WIDTH_STORAGE_KEY) ??
        storedVideoCardWidth,
    );
    articleCardWidth.value = normalizeCardWidth(
      window.localStorage.getItem(ARTICLE_CARD_WIDTH_STORAGE_KEY) ??
        storedVideoCardWidth,
    );
    initialized.value = true;
  }

  return {
    locale,
    isDark,
    videoCardWidth,
    commentCardWidth,
    articleCardWidth,
    initialized,
    setLocale,
    toggleLocale,
    setTheme,
    toggleTheme,
    setVideoCardWidth,
    setCommentCardWidth,
    setArticleCardWidth,
    initFromStorage,
  };
});
