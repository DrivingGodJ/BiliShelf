<script setup lang="ts">
import { ref } from "vue";
import {
  ArchiveRestore,
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  FolderArchive,
  ListChecks,
  MessageSquareHeart,
  Trash2,
  Video,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FavoriteArticle, FavoriteComment, Folder, Video as VideoItem } from "@/types";

const props = defineProps<{
  t: (key: string, vars?: Record<string, string | number>) => string;
  loading: boolean;
  trashFolders: Folder[];
  pagedTrashFolders: Folder[];
  trashVideos: VideoItem[];
  trashComments: FavoriteComment[];
  trashArticles: FavoriteArticle[];
  trashVideoTotal: number;
  trashCommentTotal: number;
  trashArticleTotal: number;
  selectedTrashFolderIds: number[];
  selectedTrashVideoIds: number[];
  selectedTrashCommentIds: number[];
  selectedTrashArticleIds: number[];
  trashFolderPage: number;
  trashFolderTotalPages: number;
  trashFolderPageSize: number;
  trashFolderPageSizeOptions: number[];
  trashVideoPage: number;
  trashVideoTotalPages: number;
  trashVideoPageSize: number;
  trashVideoPageSizeOptions: number[];
  trashCommentPage: number;
  trashCommentTotalPages: number;
  trashCommentPageSize: number;
  trashCommentPageSizeOptions: number[];
  trashArticlePage: number;
  trashArticleTotalPages: number;
  trashArticlePageSize: number;
  trashArticlePageSizeOptions: number[];
  isTrashFolderSelected: (id: number) => boolean;
  isTrashVideoSelected: (id: number) => boolean;
  isTrashCommentSelected: (id: number) => boolean;
  isTrashArticleSelected: (id: number) => boolean;
}>();

const emit = defineEmits<{
  selectAllTrashFolders: [];
  clearTrashFolderSelection: [];
  batchRestoreTrashFolders: [];
  batchPurgeTrashFolders: [];
  setTrashFolderSelection: [{ id: number; checked: boolean }];
  prevTrashFolderPage: [];
  nextTrashFolderPage: [];
  trashFolderPageSizeChange: [value: string];
  restoreFolderFromTrash: [id: number];
  purgeFolderFromTrash: [id: number];
  selectAllTrashVideos: [];
  clearTrashVideoSelection: [];
  batchRestoreTrashVideos: [];
  batchPurgeTrashVideos: [];
  setTrashVideoSelection: [{ id: number; checked: boolean }];
  prevTrashVideoPage: [];
  nextTrashVideoPage: [];
  trashVideoPageSizeChange: [value: string];
  restoreVideoFromTrash: [id: number];
  purgeVideoFromTrash: [id: number];
  selectAllTrashComments: [];
  clearTrashCommentSelection: [];
  batchRestoreTrashComments: [];
  batchPurgeTrashComments: [];
  setTrashCommentSelection: [{ id: number; checked: boolean }];
  prevTrashCommentPage: [];
  nextTrashCommentPage: [];
  trashCommentPageSizeChange: [value: string];
  restoreCommentFromTrash: [id: number];
  purgeCommentFromTrash: [id: number];
  selectAllTrashArticles: [];
  clearTrashArticleSelection: [];
  batchRestoreTrashArticles: [];
  batchPurgeTrashArticles: [];
  setTrashArticleSelection: [{ id: number; checked: boolean }];
  prevTrashArticlePage: [];
  nextTrashArticlePage: [];
  trashArticlePageSizeChange: [value: string];
  restoreArticleFromTrash: [id: number];
  purgeArticleFromTrash: [id: number];
}>();

const activeTab = ref("folders");
</script>

<template>
  <section class="panel-surface p-4 md:p-5">
    <div class="mb-4">
      <h2 class="text-lg font-semibold">{{ props.t("trash.title") }}</h2>
      <p class="mt-1 text-sm text-muted-foreground">{{ props.t("trash.description") }}</p>
    </div>

    <Tabs v-model="activeTab" class="space-y-4">
      <TabsList class="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
        <TabsTrigger value="folders" class="gap-1.5 py-2.5">
          <FolderArchive class="h-4 w-4" />
          {{ props.t("trash.foldersTab") }}
          <span class="inline-flex min-w-5 items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-[11px]">{{ props.trashFolders.length }}</span>
        </TabsTrigger>
        <TabsTrigger value="videos" class="gap-1.5 py-2.5">
          <Video class="h-4 w-4" />
          {{ props.t("trash.videosTab") }}
          <span class="inline-flex min-w-5 items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-[11px]">{{ props.trashVideoTotal }}</span>
        </TabsTrigger>
        <TabsTrigger value="comments" class="gap-1.5 py-2.5">
          <MessageSquareHeart class="h-4 w-4" />
          {{ props.t("trash.commentsTab") }}
          <span class="inline-flex min-w-5 items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-[11px]">{{ props.trashCommentTotal }}</span>
        </TabsTrigger>
        <TabsTrigger value="articles" class="gap-1.5 py-2.5">
          <BookOpenText class="h-4 w-4" />
          {{ props.t("trash.articlesTab") }}
          <span class="inline-flex min-w-5 items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-[11px]">{{ props.trashArticleTotal }}</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="folders" class="mt-0 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-sm font-semibold">{{ props.t("trash.foldersTitle") }}</p>
            <p class="text-xs text-muted-foreground">{{ props.t("common.selected", { count: props.selectedTrashFolderIds.length }) }}</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" :disabled="props.pagedTrashFolders.length === 0" @click="emit('selectAllTrashFolders')"><ListChecks class="h-3.5 w-3.5" />{{ props.t("common.selectAll") }}</Button>
            <Button size="sm" variant="outline" :disabled="props.selectedTrashFolderIds.length === 0" @click="emit('clearTrashFolderSelection')">{{ props.t("common.clear") }}</Button>
            <Button size="sm" variant="outline" :disabled="props.selectedTrashFolderIds.length === 0" @click="emit('batchRestoreTrashFolders')"><ArchiveRestore class="h-3.5 w-3.5" />{{ props.t("trash.restoreSelected") }}</Button>
            <Button size="sm" variant="destructive" :disabled="props.selectedTrashFolderIds.length === 0" @click="emit('batchPurgeTrashFolders')"><Trash2 class="h-3.5 w-3.5" />{{ props.t("common.deleteSelected") }}</Button>
          </div>
        </div>
        <div v-if="props.trashFolders.length === 0" class="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{{ props.t("trash.emptyFolders") }}</div>
        <div v-else class="space-y-2.5">
          <article v-for="folder in props.pagedTrashFolders" :key="folder.id" class="panel-surface-soft flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5">
            <div class="flex min-w-0 items-start gap-2.5">
              <Checkbox :model-value="props.isTrashFolderSelected(folder.id)" class="mt-1" @update:model-value="emit('setTrashFolderSelection', { id: folder.id, checked: $event === true })" />
              <div class="min-w-0"><p class="line-clamp-1 text-sm font-semibold">{{ folder.name }}</p><p class="mt-0.5 text-xs text-muted-foreground">{{ props.t("common.videosCount", { count: folder.itemCount ?? 0 }) }}</p></div>
            </div>
            <div class="flex gap-2"><Button size="sm" variant="outline" @click="emit('restoreFolderFromTrash', folder.id)"><ArchiveRestore class="h-3.5 w-3.5" />{{ props.t("common.restore") }}</Button><Button size="sm" variant="destructive" @click="emit('purgeFolderFromTrash', folder.id)"><Trash2 class="h-3.5 w-3.5" />{{ props.t("common.deleteForever") }}</Button></div>
          </article>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p class="text-xs text-muted-foreground">{{ props.t("common.page", { page: props.trashFolderPage, totalPage: props.trashFolderTotalPages, total: props.trashFolders.length }) }}</p>
          <div class="flex items-center gap-2"><Select :model-value="String(props.trashFolderPageSize)" @update:model-value="emit('trashFolderPageSizeChange', String($event))"><SelectTrigger class="h-8 w-[86px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem v-for="size in props.trashFolderPageSizeOptions" :key="size" :value="String(size)">{{ size }}</SelectItem></SelectContent></Select><Button size="icon" variant="outline" :disabled="props.trashFolderPage <= 1" @click="emit('prevTrashFolderPage')"><ChevronLeft class="h-4 w-4" /></Button><Button size="icon" variant="outline" :disabled="props.trashFolderPage >= props.trashFolderTotalPages" @click="emit('nextTrashFolderPage')"><ChevronRight class="h-4 w-4" /></Button></div>
        </div>
      </TabsContent>

      <TabsContent value="videos" class="mt-0 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div><p class="text-sm font-semibold">{{ props.t("trash.videosTitle") }}</p><p class="text-xs text-muted-foreground">{{ props.t("common.selected", { count: props.selectedTrashVideoIds.length }) }}</p></div>
          <div class="flex flex-wrap items-center gap-2"><Button size="sm" variant="outline" :disabled="props.trashVideos.length === 0" @click="emit('selectAllTrashVideos')"><ListChecks class="h-3.5 w-3.5" />{{ props.t("common.selectAll") }}</Button><Button size="sm" variant="outline" :disabled="props.selectedTrashVideoIds.length === 0" @click="emit('clearTrashVideoSelection')">{{ props.t("common.clear") }}</Button><Button size="sm" variant="outline" :disabled="props.selectedTrashVideoIds.length === 0" @click="emit('batchRestoreTrashVideos')"><ArchiveRestore class="h-3.5 w-3.5" />{{ props.t("trash.restoreSelected") }}</Button><Button size="sm" variant="destructive" :disabled="props.selectedTrashVideoIds.length === 0" @click="emit('batchPurgeTrashVideos')"><Trash2 class="h-3.5 w-3.5" />{{ props.t("common.deleteSelected") }}</Button></div>
        </div>
        <div v-if="props.trashVideos.length === 0" class="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{{ props.t("trash.emptyVideos") }}</div>
        <div v-else class="space-y-2.5">
          <article v-for="videoItem in props.trashVideos" :key="videoItem.id" class="panel-surface-soft flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5">
            <div class="flex min-w-0 items-start gap-2.5"><Checkbox :model-value="props.isTrashVideoSelected(videoItem.id)" class="mt-1" @update:model-value="emit('setTrashVideoSelection', { id: videoItem.id, checked: $event === true })" /><div class="min-w-0"><p class="line-clamp-1 text-sm font-semibold">{{ videoItem.title }}</p><p class="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{{ videoItem.uploader }}</p></div></div>
            <div class="flex gap-2"><Button size="sm" variant="outline" @click="emit('restoreVideoFromTrash', videoItem.id)"><ArchiveRestore class="h-3.5 w-3.5" />{{ props.t("common.restore") }}</Button><Button size="sm" variant="destructive" @click="emit('purgeVideoFromTrash', videoItem.id)"><Trash2 class="h-3.5 w-3.5" />{{ props.t("common.deleteForever") }}</Button></div>
          </article>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><p class="text-xs text-muted-foreground">{{ props.t("common.page", { page: props.trashVideoPage, totalPage: props.trashVideoTotalPages, total: props.trashVideoTotal }) }}</p><div class="flex items-center gap-2"><Select :model-value="String(props.trashVideoPageSize)" @update:model-value="emit('trashVideoPageSizeChange', String($event))"><SelectTrigger class="h-8 w-[86px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem v-for="size in props.trashVideoPageSizeOptions" :key="size" :value="String(size)">{{ size }}</SelectItem></SelectContent></Select><Button size="icon" variant="outline" :disabled="props.loading || props.trashVideoPage <= 1" @click="emit('prevTrashVideoPage')"><ChevronLeft class="h-4 w-4" /></Button><Button size="icon" variant="outline" :disabled="props.loading || props.trashVideoPage >= props.trashVideoTotalPages" @click="emit('nextTrashVideoPage')"><ChevronRight class="h-4 w-4" /></Button></div></div>
      </TabsContent>

      <TabsContent value="comments" class="mt-0 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div><p class="text-sm font-semibold">{{ props.t("trash.commentsTitle") }}</p><p class="text-xs text-muted-foreground">{{ props.t("common.selected", { count: props.selectedTrashCommentIds.length }) }}</p></div>
          <div class="flex flex-wrap items-center gap-2"><Button size="sm" variant="outline" :disabled="props.trashComments.length === 0" @click="emit('selectAllTrashComments')"><ListChecks class="h-3.5 w-3.5" />{{ props.t("common.selectAll") }}</Button><Button size="sm" variant="outline" :disabled="props.selectedTrashCommentIds.length === 0" @click="emit('clearTrashCommentSelection')">{{ props.t("common.clear") }}</Button><Button size="sm" variant="outline" :disabled="props.selectedTrashCommentIds.length === 0" @click="emit('batchRestoreTrashComments')"><ArchiveRestore class="h-3.5 w-3.5" />{{ props.t("trash.restoreSelected") }}</Button><Button size="sm" variant="destructive" :disabled="props.selectedTrashCommentIds.length === 0" @click="emit('batchPurgeTrashComments')"><Trash2 class="h-3.5 w-3.5" />{{ props.t("common.deleteSelected") }}</Button></div>
        </div>
        <div v-if="props.trashComments.length === 0" class="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{{ props.t("trash.emptyComments") }}</div>
        <div v-else class="space-y-2.5">
          <article v-for="comment in props.trashComments" :key="comment.id" class="panel-surface-soft flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5">
            <div class="flex min-w-0 flex-1 items-start gap-2.5"><Checkbox :model-value="props.isTrashCommentSelected(comment.id)" class="mt-1" @update:model-value="emit('setTrashCommentSelection', { id: comment.id, checked: $event === true })" /><div class="min-w-0"><p class="line-clamp-1 text-sm font-semibold">{{ comment.videoTitle || props.t("comments.unknownVideo") }}</p><p class="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">{{ comment.content }}</p><p v-if="comment.contentImageUrls?.length" class="mt-1 text-xs text-muted-foreground">{{ props.t("trash.commentImages", { count: comment.contentImageUrls.length }) }}</p></div></div>
            <div class="flex gap-2"><Button size="sm" variant="outline" @click="emit('restoreCommentFromTrash', comment.id)"><ArchiveRestore class="h-3.5 w-3.5" />{{ props.t("common.restore") }}</Button><Button size="sm" variant="destructive" @click="emit('purgeCommentFromTrash', comment.id)"><Trash2 class="h-3.5 w-3.5" />{{ props.t("common.deleteForever") }}</Button></div>
          </article>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><p class="text-xs text-muted-foreground">{{ props.t("common.page", { page: props.trashCommentPage, totalPage: props.trashCommentTotalPages, total: props.trashCommentTotal }) }}</p><div class="flex items-center gap-2"><Select :model-value="String(props.trashCommentPageSize)" @update:model-value="emit('trashCommentPageSizeChange', String($event))"><SelectTrigger class="h-8 w-[86px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem v-for="size in props.trashCommentPageSizeOptions" :key="size" :value="String(size)">{{ size }}</SelectItem></SelectContent></Select><Button size="icon" variant="outline" :disabled="props.loading || props.trashCommentPage <= 1" @click="emit('prevTrashCommentPage')"><ChevronLeft class="h-4 w-4" /></Button><Button size="icon" variant="outline" :disabled="props.loading || props.trashCommentPage >= props.trashCommentTotalPages" @click="emit('nextTrashCommentPage')"><ChevronRight class="h-4 w-4" /></Button></div></div>
      </TabsContent>

      <TabsContent value="articles" class="mt-0 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div><p class="text-sm font-semibold">{{ props.t("trash.articlesTitle") }}</p><p class="text-xs text-muted-foreground">{{ props.t("common.selected", { count: props.selectedTrashArticleIds.length }) }}</p></div>
          <div class="flex flex-wrap items-center gap-2"><Button size="sm" variant="outline" :disabled="props.trashArticles.length === 0" @click="emit('selectAllTrashArticles')"><ListChecks class="h-3.5 w-3.5" />{{ props.t("common.selectAll") }}</Button><Button size="sm" variant="outline" :disabled="props.selectedTrashArticleIds.length === 0" @click="emit('clearTrashArticleSelection')">{{ props.t("common.clear") }}</Button><Button size="sm" variant="outline" :disabled="props.selectedTrashArticleIds.length === 0" @click="emit('batchRestoreTrashArticles')"><ArchiveRestore class="h-3.5 w-3.5" />{{ props.t("trash.restoreSelected") }}</Button><Button size="sm" variant="destructive" :disabled="props.selectedTrashArticleIds.length === 0" @click="emit('batchPurgeTrashArticles')"><Trash2 class="h-3.5 w-3.5" />{{ props.t("common.deleteSelected") }}</Button></div>
        </div>
        <div v-if="props.trashArticles.length === 0" class="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{{ props.t("trash.emptyArticles") }}</div>
        <div v-else class="space-y-2.5">
          <article v-for="article in props.trashArticles" :key="article.id" class="panel-surface-soft flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5">
            <div class="flex min-w-0 flex-1 items-center gap-2.5"><Checkbox :model-value="props.isTrashArticleSelected(article.id)" @update:model-value="emit('setTrashArticleSelection', { id: article.id, checked: $event === true })" /><img v-if="article.coverUrl" :src="article.coverUrl" :alt="article.title" class="h-12 w-16 shrink-0 rounded-md object-cover" loading="lazy" /><div class="min-w-0"><p class="line-clamp-1 text-sm font-semibold">{{ article.title }}</p><p class="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{{ article.authorName || props.t("articles.unknownAuthor") }}</p></div></div>
            <div class="flex gap-2"><Button size="sm" variant="outline" @click="emit('restoreArticleFromTrash', article.id)"><ArchiveRestore class="h-3.5 w-3.5" />{{ props.t("common.restore") }}</Button><Button size="sm" variant="destructive" @click="emit('purgeArticleFromTrash', article.id)"><Trash2 class="h-3.5 w-3.5" />{{ props.t("common.deleteForever") }}</Button></div>
          </article>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><p class="text-xs text-muted-foreground">{{ props.t("common.page", { page: props.trashArticlePage, totalPage: props.trashArticleTotalPages, total: props.trashArticleTotal }) }}</p><div class="flex items-center gap-2"><Select :model-value="String(props.trashArticlePageSize)" @update:model-value="emit('trashArticlePageSizeChange', String($event))"><SelectTrigger class="h-8 w-[86px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem v-for="size in props.trashArticlePageSizeOptions" :key="size" :value="String(size)">{{ size }}</SelectItem></SelectContent></Select><Button size="icon" variant="outline" :disabled="props.loading || props.trashArticlePage <= 1" @click="emit('prevTrashArticlePage')"><ChevronLeft class="h-4 w-4" /></Button><Button size="icon" variant="outline" :disabled="props.loading || props.trashArticlePage >= props.trashArticleTotalPages" @click="emit('nextTrashArticlePage')"><ChevronRight class="h-4 w-4" /></Button></div></div>
      </TabsContent>
    </Tabs>
  </section>
</template>
