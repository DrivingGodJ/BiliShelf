<script setup lang="ts">
import { computed, ref, watch, type CSSProperties } from "vue";
import {
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  LoaderCircle,
  RefreshCcw,
  Search,
  Trash2,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FavoriteArticle, Pagination } from "@/types";
import type { Locale } from "@/stores/app-ui";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
const props = defineProps<{
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: Locale;
  articles: FavoriteArticle[];
  activeFolderId: number | null;
  keyword: string;
  loading: boolean;
  pagination: Pagination;
  cardWidth: number;
}>();
const emit = defineEmits<{
  "update:keyword": [value: string];
  search: [];
  refresh: [];
  delete: [article: FavoriteArticle];
  "change-page": [page: number];
  "change-page-size": [pageSize: number];
}>();
const pageJump = ref(String(props.pagination.page));
const totalPages = computed(() => Math.max(1, Math.ceil(props.pagination.total / props.pagination.pageSize)));
const gridStyle = computed(
  () =>
    ({
      "--content-card-width": `${props.cardWidth}px`,
    }) as CSSProperties,
);
watch(() => props.pagination.page, (page) => { pageJump.value = String(page); }, { immediate: true });
function formatDateTime(value: number | null) {
  if (!value) return props.t("articles.unknownTime");
  return new Intl.DateTimeFormat(props.locale, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
function submitPageJump() {
  const parsed = Number.parseInt(pageJump.value, 10);
  if (!Number.isFinite(parsed)) { pageJump.value = String(props.pagination.page); return; }
  const page = Math.min(Math.max(1, parsed), totalPages.value);
  pageJump.value = String(page);
  emit("change-page", page);
}
function handlePageSizeChange(value: string | number) {
  const parsed = Number(value);
  if (PAGE_SIZE_OPTIONS.includes(parsed as (typeof PAGE_SIZE_OPTIONS)[number])) emit("change-page-size", parsed);
}
</script>

<template>
  <section class="panel-surface space-y-4 p-4 md:p-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="min-w-0">
        <h2 class="text-lg font-semibold">{{ props.t("articles.title") }}</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          {{ props.activeFolderId === null ? props.t("articles.allFolders") : props.t("articles.folderScope") }}
          · {{ props.t("articles.total", { count: props.pagination.total }) }}
        </p>
      </div>
      <Button size="sm" variant="outline" :disabled="props.loading" @click="emit('refresh')">
        <RefreshCcw class="h-3.5 w-3.5" /> {{ props.t("common.refresh") }}
      </Button>
    </div>
    <form class="ml-auto flex w-full max-w-2xl gap-2" @submit.prevent="emit('search')">
      <div class="relative min-w-0 flex-1">
        <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input :model-value="props.keyword" class="pl-9" :placeholder="props.t('articles.searchPlaceholder')" @update:model-value="emit('update:keyword', String($event))" />
      </div>
      <Button type="submit" :disabled="props.loading"><Search class="h-4 w-4" /><span class="hidden sm:inline">{{ props.t("articles.search") }}</span></Button>
    </form>
    <div v-if="props.loading && props.articles.length === 0" class="flex min-h-44 items-center justify-center text-sm text-muted-foreground"><LoaderCircle class="mr-2 h-4 w-4 animate-spin" />{{ props.t("articles.loading") }}</div>
    <div v-else-if="props.articles.length === 0" class="rounded-lg border border-dashed p-8 text-center">
      <BookOpenText class="mx-auto h-8 w-8 text-muted-foreground" />
      <p class="mt-3 font-semibold">{{ props.t("articles.empty") }}</p>
      <p class="mt-1 text-sm text-muted-foreground">{{ props.t("articles.emptyHint") }}</p>
    </div>
    <div v-else class="content-card-grid items-start gap-3" :style="gridStyle">
      <article v-for="article in props.articles" :key="article.id" class="panel-surface-soft min-w-0 overflow-hidden rounded-lg border">
        <div class="flex min-w-0 gap-3 p-4">
          <img v-if="article.coverUrl" :src="article.coverUrl" :alt="article.title" class="h-20 w-28 shrink-0 rounded-md object-cover" loading="lazy" />
          <div class="min-w-0 flex-1">
            <h3 class="line-clamp-2 break-words text-sm font-semibold">{{ article.title }}</h3>
            <p class="mt-1 text-xs text-muted-foreground">{{ article.authorName || props.t("articles.unknownAuthor") }} · {{ formatDateTime(article.savedAt) }}</p>
            <p class="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{{ article.summary || article.content }}</p>
          </div>
        </div>
        <div class="flex flex-wrap justify-end gap-2 border-t px-4 py-3">
          <Button v-if="article.sourceUrl" as-child size="sm" variant="outline"><a :href="article.sourceUrl" target="_blank" rel="noopener noreferrer"><ExternalLink class="h-3.5 w-3.5" />{{ props.t("articles.openSource") }}</a></Button>
          <Button size="sm" variant="outline" class="text-destructive hover:text-destructive" :disabled="props.loading" @click="emit('delete', article)"><Trash2 class="h-3.5 w-3.5" />{{ props.t("articles.delete") }}</Button>
        </div>
      </article>
    </div>
    <div v-if="props.pagination.total > 0" class="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      <p class="text-sm text-muted-foreground">{{ props.t("common.page", { page: props.pagination.page, totalPage: totalPages, total: props.pagination.total }) }}</p>
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs text-muted-foreground">{{ props.t("common.perPage") }}</span>
        <Select :model-value="String(props.pagination.pageSize)" @update:model-value="handlePageSizeChange(String($event))"><SelectTrigger class="h-9 w-[88px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem v-for="size in PAGE_SIZE_OPTIONS" :key="size" :value="String(size)">{{ size }}</SelectItem></SelectContent></Select>
        <Button size="icon" variant="outline" :disabled="props.loading || props.pagination.page <= 1" @click="emit('change-page', props.pagination.page - 1)"><ChevronLeft class="h-4 w-4" /></Button>
        <Button size="icon" variant="outline" :disabled="props.loading || props.pagination.page >= totalPages" @click="emit('change-page', props.pagination.page + 1)"><ChevronRight class="h-4 w-4" /></Button>
        <Input v-model="pageJump" type="text" inputmode="numeric" class="h-9 w-[76px]" @keydown.enter.prevent="submitPageJump" />
        <Button size="sm" variant="outline" :disabled="props.loading || totalPages <= 1" @click="submitPageJump">{{ props.t("common.jump") }}</Button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.content-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--content-card-width)), 1fr));
  align-items: start;
}

@media (max-width: 639px) {
  .content-card-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
