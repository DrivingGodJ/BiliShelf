<script setup lang="ts">
import { computed, ref } from "vue";
import {
  Bot,
  BookOpenText,
  DatabaseBackup,
  Download,
  Ellipsis,
  FolderSync,
  MessageSquareHeart,
  RefreshCcw,
  Settings,
  Tags,
  TriangleAlert,
  Trash2,
  Upload,
  UserRoundCheck,
  Waypoints,
} from "lucide-vue-next";
import BiliShelfMark from "@/components/icons/BiliShelfMark.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

const props = defineProps<{
  t: (key: string, vars?: Record<string, string | number>) => string;
  trashMode: boolean;
  followingUpsMode: boolean;
  commentsMode: boolean;
  articlesMode: boolean;
  showAiOrganizer: boolean;
  currentViewLabel: string;
  currentScopeLabel: string;
  progressValue: number;
  syncing: boolean;
  exporting: boolean;
  importing: boolean;
}>();

const emit = defineEmits<{
  "open-settings": [];
  "open-tags": [];
  "open-ai-organizer": [];
  "open-following-ups": [];
  "open-comments": [];
  "open-articles": [];
  "open-webdav-settings": [];
  "toggle-trash": [];
  "sync-import": [];
  "import-file": [];
  "export-json": [];
  "export-csv": [];
}>();

const dataDialogOpen = ref(false);
const exportDialogOpen = ref(false);
const mobileActionsOpen = ref(false);
const managerMode = computed(
  () => !props.trashMode && !props.followingUpsMode && !props.commentsMode && !props.articlesMode,
);
const actionsBusy = computed(
  () => props.syncing || props.exporting || props.importing,
);
const topActionButtonClass =
  "h-11 w-full justify-start rounded-xl border border-border/80 bg-card/80 px-3.5 shadow-sm shadow-black/5";
const activeViewButtonClass =
  "border-primary/35 bg-primary/12 text-primary shadow-[0_12px_30px_-18px_hsl(var(--primary)/0.6)] hover:bg-primary/16 hover:text-primary dark:border-primary/30 dark:bg-primary/16";

function chooseDataAction(action: "import" | "export") {
  dataDialogOpen.value = false;
  if (action === "import") {
    emit("import-file");
    return;
  }
  exportDialogOpen.value = true;
}

function exportData(format: "json" | "csv") {
  exportDialogOpen.value = false;
  if (format === "json") emit("export-json");
  else emit("export-csv");
}
</script>

<template>
  <header class="hero-surface p-3.5 md:p-5">
    <div class="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 md:gap-4">
      <div class="min-w-0">
        <div class="flex items-center gap-2.5">
          <div class="inline-flex h-10 w-10 shrink-0 items-center justify-center md:h-12 md:w-12">
            <BiliShelfMark class="h-10 w-10 md:h-12 md:w-12" />
          </div>
          <div class="min-w-0">
            <h1 class="line-clamp-1 text-lg font-extrabold md:text-2xl">
              {{ props.t("header.title") }}
            </h1>
            <p class="hidden line-clamp-1 text-sm text-muted-foreground md:block">
              {{ props.t("header.subtitle") }}
            </p>
          </div>
        </div>

        <div class="mt-3 hidden flex-wrap items-center gap-2 md:flex">
          <Badge variant="secondary">{{ props.currentViewLabel }}</Badge>
          <Badge
            v-if="!props.trashMode"
            variant="outline"
            class="max-w-[420px] truncate border-border/80 bg-card/75"
          >
            {{ props.currentScopeLabel }}
          </Badge>
          <span class="action-chip">
            <Waypoints class="h-3.5 w-3.5" />
            {{ props.t("header.credit") }}
          </span>
        </div>
      </div>

      <Button
        size="icon"
        variant="outline"
        :title="props.t('settings.title')"
        :aria-label="props.t('settings.title')"
        @click="emit('open-settings')"
      >
        <Settings class="h-4 w-4" />
      </Button>
    </div>

    <div v-if="managerMode" class="mt-4 space-y-2 md:hidden">
      <div class="action-group action-group-content">
        <p class="action-group-label">{{ props.t("header.groupContent") }}</p>
        <div class="grid grid-cols-3 gap-1.5">
          <Button size="sm" variant="outline" class="h-10 justify-center px-2" @click="emit('open-following-ups')"><UserRoundCheck class="h-4 w-4" /><span class="truncate">{{ props.t("header.followingUps") }}</span></Button>
          <Button size="sm" variant="outline" class="h-10 justify-center px-2" @click="emit('open-comments')"><MessageSquareHeart class="h-4 w-4" /><span class="truncate">{{ props.t("header.comments") }}</span></Button>
          <Button size="sm" variant="outline" class="h-10 justify-center px-2" @click="emit('open-articles')"><BookOpenText class="h-4 w-4" /><span class="truncate">{{ props.t("header.articles") }}</span></Button>
        </div>
      </div>
      <div class="action-group action-group-data">
        <p class="action-group-label">{{ props.t("header.groupData") }}</p>
        <div class="grid grid-cols-3 gap-1.5">
          <Button size="sm" variant="outline" class="h-10 justify-center px-2" :disabled="actionsBusy" @click="emit('open-webdav-settings')"><DatabaseBackup class="h-4 w-4" /><span class="truncate">{{ props.t("webdav.title") }}</span></Button>
          <Button size="sm" variant="outline" class="h-10 justify-center px-2" :disabled="actionsBusy" @click="dataDialogOpen = true"><FolderSync class="h-4 w-4" /><span class="truncate">{{ props.t("header.dataTransfer") }}</span></Button>
          <Button size="sm" variant="outline" class="h-10 justify-center px-2" :disabled="actionsBusy" @click="emit('sync-import')"><RefreshCcw class="h-4 w-4" /><span class="truncate">{{ props.syncing ? props.t("header.syncing") : props.t("header.syncImport") }}</span></Button>
        </div>
      </div>
      <Button variant="outline" class="h-10 w-full justify-start rounded-xl" :aria-expanded="mobileActionsOpen" @click="mobileActionsOpen = !mobileActionsOpen"><Ellipsis class="h-4 w-4" />{{ props.t("header.moreActions") }}</Button>
      <Transition name="mobile-actions">
        <div v-if="mobileActionsOpen" class="action-group action-group-tools grid grid-cols-2 gap-1.5">
          <p class="action-group-label col-span-2">{{ props.t("header.groupTools") }}</p>
          <Button v-if="props.showAiOrganizer" variant="ghost" class="h-10 justify-start" @click="emit('open-ai-organizer')"><Bot class="h-4 w-4" /> {{ props.t("header.aiOrganizer") }}</Button>
          <Button variant="ghost" class="h-10 justify-start" @click="emit('open-tags')"><Tags class="h-4 w-4" /> {{ props.t("header.manageTags") }}</Button>
          <Button variant="ghost" class="h-10 justify-start" @click="emit('toggle-trash')"><Trash2 class="h-4 w-4" /> {{ props.t("header.openTrash") }}</Button>
        </div>
      </Transition>
    </div>

    <Button
      v-else
      variant="outline"
      class="mt-4 h-11 w-full justify-start rounded-xl md:hidden"
      @click="props.followingUpsMode ? emit('open-following-ups') : props.commentsMode ? emit('open-comments') : props.articlesMode ? emit('open-articles') : emit('toggle-trash')"
    >
      {{ props.t("header.backManager") }}
    </Button>

    <div v-if="managerMode" class="desktop-action-grid mt-4 grid gap-3 xl:grid-cols-3">
      <div class="action-group action-group-content">
        <p class="action-group-label">{{ props.t("header.groupContent") }}</p>
        <div class="grid gap-2">
          <Button size="sm" variant="outline" :class="topActionButtonClass" @click="emit('open-following-ups')"><UserRoundCheck class="h-3.5 w-3.5" /> {{ props.t("header.followingUps") }}</Button>
          <Button size="sm" variant="outline" :class="topActionButtonClass" @click="emit('open-comments')"><MessageSquareHeart class="h-3.5 w-3.5" /> {{ props.t("header.comments") }}</Button>
          <Button size="sm" variant="outline" :class="topActionButtonClass" @click="emit('open-articles')"><BookOpenText class="h-3.5 w-3.5" /> {{ props.t("header.articles") }}</Button>
        </div>
      </div>
      <div class="action-group action-group-data">
        <p class="action-group-label">{{ props.t("header.groupData") }}</p>
        <div class="grid gap-2">
          <Button size="sm" variant="outline" :class="topActionButtonClass" :disabled="actionsBusy" @click="emit('open-webdav-settings')"><DatabaseBackup class="h-3.5 w-3.5" /> {{ props.t("webdav.title") }}</Button>
          <Button size="sm" variant="outline" :class="topActionButtonClass" :disabled="actionsBusy" @click="dataDialogOpen = true"><FolderSync class="h-3.5 w-3.5" /> {{ props.t("header.dataTransfer") }}</Button>
          <Button size="sm" variant="outline" :class="topActionButtonClass" :disabled="actionsBusy" @click="emit('sync-import')"><RefreshCcw class="h-3.5 w-3.5" /> {{ props.syncing ? props.t("header.syncing") : props.t("header.syncImport") }}</Button>
        </div>
      </div>
      <div class="action-group action-group-tools">
        <p class="action-group-label">{{ props.t("header.groupTools") }}</p>
        <div class="grid gap-2">
          <Button v-if="props.showAiOrganizer" size="sm" variant="outline" :class="topActionButtonClass" @click="emit('open-ai-organizer')"><Bot class="h-3.5 w-3.5" /> {{ props.t("header.aiOrganizer") }}</Button>
          <Button size="sm" variant="outline" :class="topActionButtonClass" @click="emit('open-tags')"><Tags class="h-3.5 w-3.5" /> {{ props.t("header.manageTags") }}</Button>
          <Button size="sm" variant="outline" :class="topActionButtonClass" @click="emit('toggle-trash')"><Trash2 class="h-3.5 w-3.5" /> {{ props.t("header.openTrash") }}</Button>
        </div>
      </div>
    </div>

    <div v-else class="desktop-action-grid mt-4 flex justify-start md:justify-end">
      <Button
        size="sm"
        variant="outline"
        :class="[topActionButtonClass, activeViewButtonClass, 'md:w-auto md:min-w-48']"
          @click="props.followingUpsMode ? emit('open-following-ups') : props.commentsMode ? emit('open-comments') : props.articlesMode ? emit('open-articles') : emit('toggle-trash')"
      >
        {{ props.t("header.backManager") }}
      </Button>
    </div>

    <div v-if="props.progressValue > 0" class="mt-4 space-y-1">
      <div class="flex justify-between text-xs text-muted-foreground">
        <span>{{ props.t("header.syncing") }}</span>
        <span>{{ Math.round(props.progressValue) }}%</span>
      </div>
      <Progress :model-value="props.progressValue" />
    </div>

    <Dialog :open="dataDialogOpen" @update:open="dataDialogOpen = $event">
      <DialogContent class="max-w-lg">
        <DialogHeader>
          <DialogTitle>{{ props.t("header.dataTransfer") }}</DialogTitle>
          <DialogDescription>{{ props.t("header.dataTransferDesc") }}</DialogDescription>
        </DialogHeader>
        <div class="grid gap-2 sm:grid-cols-2">
          <Button variant="outline" class="h-12 justify-start" :disabled="actionsBusy" @click="chooseDataAction('import')">
            <Upload class="h-4 w-4" /> {{ props.t("header.importData") }}
          </Button>
          <Button variant="outline" class="h-12 justify-start" :disabled="actionsBusy" @click="chooseDataAction('export')">
            <Download class="h-4 w-4" /> {{ props.t("header.exportBackup") }}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog :open="exportDialogOpen" @update:open="exportDialogOpen = $event">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>{{ props.t("header.exportDialogTitle") }}</DialogTitle>
          <DialogDescription>{{ props.t("header.exportDialogDesc") }}</DialogDescription>
        </DialogHeader>
        <div class="grid gap-2 sm:grid-cols-2">
          <Button variant="outline" class="h-auto min-h-16 items-start justify-start py-3 text-left" :disabled="actionsBusy" @click="exportData('json')">
            <Download class="mt-0.5 h-4 w-4 shrink-0" />
            <span class="min-w-0">
              <span class="block font-semibold">{{ props.t("header.exportJson") }}</span>
              <span class="mt-1 block whitespace-normal text-xs font-normal text-muted-foreground">{{ props.t("header.exportJsonDescription") }}</span>
            </span>
          </Button>
          <Button variant="outline" class="h-auto min-h-16 items-start justify-start border-amber-500/45 py-3 text-left hover:border-amber-500/70" :disabled="actionsBusy" @click="exportData('csv')">
            <Download class="mt-0.5 h-4 w-4 shrink-0" />
            <span class="min-w-0">
              <span class="block font-semibold">{{ props.t("header.exportCsv") }}</span>
              <span class="mt-1 block whitespace-normal text-xs font-normal text-muted-foreground">{{ props.t("header.exportCsvDescription") }}</span>
            </span>
          </Button>
        </div>
        <div class="flex items-start gap-2 rounded-lg border border-amber-500/45 bg-amber-500/10 p-3 text-xs leading-5 text-amber-900 dark:text-amber-200">
          <TriangleAlert class="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p class="font-semibold">{{ props.t("header.exportCsvWarningTitle") }}</p>
            <p>{{ props.t("header.exportCsvWarningDescription") }}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </header>
</template>

<style scoped>
.action-group {
  border: 1px solid hsl(var(--border) / 0.8);
  border-radius: 12px;
  padding: 10px;
  background: hsl(var(--card) / 0.58);
}

.action-group-content,
.action-group-data,
.action-group-tools {
  border-color: hsl(var(--border) / 0.8);
  background: hsl(var(--card) / 0.58);
}

.action-group-label {
  margin: 0 0 8px 2px;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0;
}

.mobile-actions-enter-active,
.mobile-actions-leave-active {
  transition: opacity 160ms ease, transform 160ms ease;
}

.mobile-actions-enter-from,
.mobile-actions-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (max-width: 767px) {
  .desktop-action-grid {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .mobile-actions-enter-active,
  .mobile-actions-leave-active {
    transition: none;
  }
}
</style>
