<script setup lang="ts">
import { computed, ref, watch, type CSSProperties } from "vue";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  LoaderCircle,
  MessageSquareHeart,
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
import type { FavoriteComment, Pagination } from "@/types";
import type { Locale } from "@/stores/app-ui";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

const props = defineProps<{
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: Locale;
  comments: FavoriteComment[];
  keyword: string;
  loading: boolean;
  pagination: Pagination;
  cardWidth: number;
}>();

const emit = defineEmits<{
  "update:keyword": [value: string];
  search: [];
  refresh: [];
  delete: [comment: FavoriteComment];
  "change-page": [page: number];
  "change-page-size": [pageSize: number];
}>();

const pageJump = ref(String(props.pagination.page));
const totalPages = computed(() =>
  Math.max(1, Math.ceil(props.pagination.total / props.pagination.pageSize))
);
const gridStyle = computed(
  () =>
    ({
      "--content-card-width": `${props.cardWidth}px`,
    }) as CSSProperties,
);

watch(
  () => props.pagination.page,
  (page) => {
    pageJump.value = String(page);
  },
  { immediate: true }
);

function formatDateTime(value: number | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat(props.locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function commentSourceUrl(comment: FavoriteComment) {
  const source = comment.sourceUrl || comment.videoUrl;
  if (!source) return "";
  try {
    const url = new URL(source);
    const rpid = String(comment.rpid || "").match(/\d{3,32}/)?.[0] || "";
    const rootRpid =
      String(comment.rootRpid || "").match(/\d{3,32}/)?.[0] || rpid;
    if (rootRpid) url.searchParams.set("comment_on", "1");
    if (rootRpid) url.searchParams.set("comment_root_id", rootRpid);
    if (rpid && rpid !== rootRpid) {
      url.searchParams.set("comment_secondary_id", rpid);
    }
    if (rpid || rootRpid) url.hash = `reply${rpid || rootRpid}`;
    return url.toString();
  } catch {
    return source;
  }
}

function submitPageJump() {
  const parsed = Number.parseInt(pageJump.value, 10);
  if (!Number.isFinite(parsed)) {
    pageJump.value = String(props.pagination.page);
    return;
  }
  const page = Math.min(Math.max(1, parsed), totalPages.value);
  pageJump.value = String(page);
  emit("change-page", page);
}

function handlePageSizeChange(value: string | number) {
  const parsed = Number(value);
  if (!PAGE_SIZE_OPTIONS.includes(parsed as (typeof PAGE_SIZE_OPTIONS)[number])) {
    return;
  }
  emit("change-page-size", parsed);
}
</script>

<template>
  <section class="panel-surface space-y-4 p-4 md:p-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="min-w-0">
        <h2 class="text-lg font-semibold">{{ props.t("comments.title") }}</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          {{ props.t("comments.total", { count: props.pagination.total }) }}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        :disabled="props.loading"
        @click="emit('refresh')"
      >
        <RefreshCcw class="h-3.5 w-3.5" />
        {{ props.t("common.refresh") }}
      </Button>
    </div>

    <form
      class="ml-auto flex w-full max-w-2xl gap-2"
      @submit.prevent="emit('search')"
    >
      <div class="relative min-w-0 flex-1">
        <Search
          class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          :model-value="props.keyword"
          class="pl-9"
          :placeholder="props.t('comments.searchPlaceholder')"
          @update:model-value="emit('update:keyword', String($event))"
        />
      </div>
      <Button type="submit" :disabled="props.loading">
        <Search class="h-4 w-4" />
        <span class="hidden sm:inline">{{ props.t("comments.search") }}</span>
      </Button>
    </form>

    <div
      v-if="props.loading && props.comments.length === 0"
      class="flex min-h-44 items-center justify-center text-sm text-muted-foreground"
    >
      <LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
      {{ props.t("comments.loading") }}
    </div>

    <div
      v-else-if="props.comments.length === 0"
      class="rounded-lg border border-dashed p-8 text-center"
    >
      <MessageSquareHeart class="mx-auto h-8 w-8 text-muted-foreground" />
      <p class="mt-3 font-semibold">{{ props.t("comments.empty") }}</p>
      <p class="mt-1 text-sm text-muted-foreground">
        {{ props.t("comments.emptyHint") }}
      </p>
    </div>

    <div v-else class="content-card-grid items-start gap-3" :style="gridStyle">
      <article
        v-for="comment in props.comments"
        :key="comment.id"
        class="panel-surface-soft min-w-0 rounded-lg border p-4"
      >
        <div class="flex min-w-0 flex-wrap items-start justify-between gap-2">
          <p class="min-w-0 flex-1 break-words text-sm font-semibold">
            {{ comment.videoTitle || comment.bvid || props.t("comments.unknownVideo") }}
          </p>
          <span class="shrink-0 text-xs text-muted-foreground">
            {{ props.t("comments.savedAt", { time: formatDateTime(comment.savedAt) }) }}
          </span>
        </div>

        <p
          v-if="comment.content"
          class="mt-3 whitespace-pre-wrap break-words text-sm leading-6"
        >
          {{ comment.content }}
        </p>

        <div
          v-if="comment.contentImageUrls?.length"
          class="mt-3 grid gap-2"
          :class="
            comment.contentImageUrls.length === 1
              ? 'grid-cols-1 sm:max-w-lg'
              : 'grid-cols-2 sm:grid-cols-3'
          "
        >
          <a
            v-for="(imageUrl, imageIndex) in comment.contentImageUrls"
            :key="imageUrl"
            :href="imageUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="flex min-w-0 items-center justify-center overflow-hidden rounded-md border bg-muted/30"
            :class="comment.contentImageUrls.length === 1 ? 'h-52' : 'aspect-square max-h-44'"
          >
            <img
              :src="imageUrl"
              :alt="props.t('comments.imageAlt', { index: imageIndex + 1 })"
              class="h-full w-full object-contain"
              loading="lazy"
            />
          </a>
        </div>

        <div class="mt-3 border-t pt-3">
          <div class="flex flex-wrap justify-end gap-2">
            <Button
              v-if="commentSourceUrl(comment)"
              as-child
              size="sm"
              variant="outline"
            >
              <a
                :href="commentSourceUrl(comment)"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink class="h-3.5 w-3.5" />
                {{ props.t("comments.openSource") }}
              </a>
            </Button>
            <Button
              size="sm"
              variant="outline"
              class="text-destructive hover:text-destructive"
              :disabled="props.loading"
              @click="emit('delete', comment)"
            >
              <Trash2 class="h-3.5 w-3.5" />
              {{ props.t("common.delete") }}
            </Button>
          </div>
        </div>
      </article>
    </div>

    <div
      v-if="props.pagination.total > 0"
      class="flex flex-wrap items-center justify-between gap-3 border-t pt-4"
    >
      <p class="text-sm text-muted-foreground">
        {{
          props.t("common.page", {
            page: props.pagination.page,
            totalPage: totalPages,
            total: props.pagination.total,
          })
        }}
      </p>
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs text-muted-foreground">{{ props.t("common.perPage") }}</span>
        <Select
          :model-value="String(props.pagination.pageSize)"
          @update:model-value="handlePageSizeChange(String($event))"
        >
          <SelectTrigger class="h-9 w-[88px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="size in PAGE_SIZE_OPTIONS"
              :key="size"
              :value="String(size)"
            >
              {{ size }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="icon"
          variant="outline"
          :title="props.t('common.prev')"
          :aria-label="props.t('common.prev')"
          :disabled="props.loading || props.pagination.page <= 1"
          @click="emit('change-page', props.pagination.page - 1)"
        >
          <ChevronLeft class="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          :title="props.t('common.next')"
          :aria-label="props.t('common.next')"
          :disabled="props.loading || props.pagination.page >= totalPages"
          @click="emit('change-page', props.pagination.page + 1)"
        >
          <ChevronRight class="h-4 w-4" />
        </Button>
        <Input
          v-model="pageJump"
          type="text"
          inputmode="numeric"
          class="h-9 w-[76px]"
          :placeholder="props.t('common.pageJumpPlaceholder')"
          @keydown.enter.prevent="submitPageJump"
        />
        <Button
          size="sm"
          variant="outline"
          :disabled="props.loading || totalPages <= 1"
          @click="submitPageJump"
        >
          {{ props.t("common.jump") }}
        </Button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.content-card-grid {
  display: grid;
  grid-template-columns: repeat(
    auto-fit,
    minmax(min(100%, var(--content-card-width)), 1fr)
  );
  align-items: start;
}

@media (max-width: 639px) {
  .content-card-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
