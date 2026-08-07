<script setup lang="ts">
import { computed } from "vue";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FolderSync,
  ListRestart,
  RefreshCcw,
  ShieldCheck,
  Square,
} from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { HistoryModelSyncStatus, SyncRemoteFolder } from "@/lib/api";
import { estimateSelectedVideoCount } from "@/lib/sync-folder-selection.js";

const props = defineProps<{
  open: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
  loading: boolean;
  fetchingFolders: boolean;
  folders: SyncRemoteFolder[];
  selectedFolderIds: number[];
  resumePage: number;
  status: HistoryModelSyncStatus | null;
  nowMs: number;
  stopping: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  "toggle-folder": [remoteId: number, checked: boolean];
  "select-all": [];
  "clear-selection": [];
  reload: [];
  submit: [];
  resume: [];
  restart: [];
  stop: [];
  dismiss: [];
}>();

const selectedVideoCount = computed(() =>
  estimateSelectedVideoCount(props.selectedFolderIds, props.folders)
);

const allFoldersSelected = computed(
  () =>
    props.folders.length > 0 &&
    props.folders.every((folder) =>
      props.selectedFolderIds.includes(folder.remoteId)
    )
);

const hasStatus = computed(
  () => props.status !== null && props.status.phase !== "idle"
);
const taskActive = computed(
  () =>
    Boolean(props.status?.running) ||
    (props.status?.phase === "waiting" && props.status.retryAutomatic),
);
const invalidDetected = computed(() =>
  Math.max(0, Number(props.status?.invalidVideosDetected || 0)),
);
const hasWarnings = computed(
  () =>
    Number(props.status?.summary.unavailableRemoteVideos || 0) > 0 ||
    invalidDetected.value > 0,
);

const progressPercent = computed(() => {
  const status = props.status;
  if (!status) return 0;
  if (status.phase === "completed") return 100;
  if (status.total > 0) {
    return Math.min(100, Math.round((status.current / status.total) * 100));
  }
  if (status.folderTotal > 0) {
    return Math.min(
      100,
      Math.round((status.folderIndex / status.folderTotal) * 100)
    );
  }
  return 0;
});

const retryRemainingSeconds = computed(() => {
  const nextRetryAt = props.status?.nextRetryAt;
  if (!nextRetryAt) return 0;
  return Math.max(0, Math.ceil((nextRetryAt - props.nowMs) / 1000));
});

const canResume = computed(() => {
  const status = props.status;
  if (!status || status.running) return false;
  if (status.phase !== "paused" && status.phase !== "failed") return false;
  return retryRemainingSeconds.value === 0;
});

const retryTimeLabel = computed(() => {
  const nextRetryAt = props.status?.nextRetryAt;
  if (!nextRetryAt) return "";
  return new Date(nextRetryAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
});
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-h-[88vh] max-w-3xl overflow-auto">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <span class="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <FolderSync class="h-4.5 w-4.5" />
          </span>
          {{ t("sync.dialogTitle") }}
        </DialogTitle>
        <DialogDescription>{{ t("sync.dialogDesc") }}</DialogDescription>
      </DialogHeader>

      <section class="panel-surface space-y-4 p-4">
        <section
          v-if="hasStatus && status"
          class="overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.08] via-background to-background"
          aria-live="polite"
        >
          <div class="space-y-4 p-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="space-y-1">
                <div class="flex items-center gap-2">
                  <span class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <CheckCircle2
                      v-if="status.phase === 'completed' && !hasWarnings"
                      class="h-4 w-4"
                    />
                    <AlertTriangle
                      v-else-if="status.phase === 'completed' && hasWarnings"
                      class="h-4 w-4 text-amber-600 dark:text-amber-400"
                    />
                    <Clock3
                      v-else-if="status.phase === 'paused' || status.phase === 'waiting'"
                      class="h-4 w-4"
                    />
                    <FolderSync v-else class="h-4 w-4" />
                  </span>
                  <h3 class="text-sm font-semibold tracking-tight">
                    {{ t("sync.statusTitle") }}
                  </h3>
                </div>
                <p class="text-xs text-muted-foreground">
                  {{ status.message || t("sync.statusReady") }}
                </p>
              </div>
              <Badge
                :variant="status.riskBlocked || status.phase === 'failed' ? 'destructive' : 'secondary'"
                class="capitalize"
              >
                {{ t(`sync.phase.${status.phase}`) }}
              </Badge>
            </div>

            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3 text-xs">
                <span class="font-medium">
                  {{ t("sync.currentWork") }}
                </span>
                <span class="tabular-nums text-muted-foreground">
                  {{ progressPercent }}%
                </span>
              </div>
              <Progress :model-value="progressPercent" class="h-2" />
              <p class="text-xs text-muted-foreground">
                {{ status.folderTitle || t("sync.preparing") }}
                <span v-if="status.currentFolderRemoteId !== null">
                  · {{ t("sync.page", { page: status.currentPage }) }}
                </span>
                <span v-if="status.folderTotal > 0">
                  · {{ status.folderIndex }}/{{ status.folderTotal }}
                </span>
              </p>
            </div>

            <div
              v-if="status.nextRetryAt"
              class="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-amber-900 dark:text-amber-100"
            >
              <Clock3 class="mt-0.5 h-4 w-4 shrink-0" />
              <p class="text-xs leading-relaxed">
                {{
                  t("sync.retryAt", {
                    time: retryTimeLabel,
                    seconds: retryRemainingSeconds,
                  })
                }}
              </p>
            </div>

            <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div class="rounded-lg border bg-background/75 p-2.5">
                <p class="text-[11px] text-muted-foreground">{{ t("sync.scanned") }}</p>
                <p class="mt-1 text-lg font-semibold tabular-nums">
                  {{ status.summary.videosProcessed }}
                </p>
              </div>
              <div class="rounded-lg border bg-background/75 p-2.5">
                <p class="text-[11px] text-muted-foreground">{{ t("sync.upserted") }}</p>
                <p class="mt-1 text-lg font-semibold tabular-nums">
                  {{ status.summary.videosUpserted }}
                </p>
              </div>
              <div class="rounded-lg border bg-background/75 p-2.5">
                <p class="text-[11px] text-muted-foreground">{{ t("sync.linked") }}</p>
                <p class="mt-1 text-lg font-semibold tabular-nums">
                  {{ status.summary.folderLinksAdded }}
                </p>
              </div>
              <div class="rounded-lg border bg-background/75 p-2.5">
                <p class="text-[11px] text-muted-foreground">{{ t("sync.skipped") }}</p>
                <p class="mt-1 text-lg font-semibold tabular-nums">
                  {{ status.summary.skippedMissingBvid }}
                </p>
              </div>
              <div class="rounded-lg border bg-background/75 p-2.5">
                <p class="text-[11px] text-muted-foreground">{{ t("sync.unresolved") }}</p>
                <p class="mt-1 text-lg font-semibold tabular-nums">
                  {{ status.summary.unresolvedMissingBvid }}
                </p>
              </div>
              <div class="rounded-lg border border-amber-500/25 bg-amber-500/[0.04] p-2.5">
                <p class="text-[11px] text-muted-foreground">{{ t("sync.unavailable") }}</p>
                <p class="mt-1 text-lg font-semibold tabular-nums">
                  {{ status.summary.unavailableRemoteVideos }}
                </p>
              </div>
              <div class="rounded-lg border border-amber-500/25 bg-amber-500/[0.04] p-2.5">
                <p class="text-[11px] text-muted-foreground">{{ t("sync.invalidDetected") }}</p>
                <p class="mt-1 text-lg font-semibold tabular-nums">
                  {{ invalidDetected }}
                </p>
              </div>
              <div class="rounded-lg border bg-background/75 p-2.5">
                <p class="text-[11px] text-muted-foreground">{{ t("sync.incomplete") }}</p>
                <p class="mt-1 text-lg font-semibold tabular-nums">
                  {{ status.summary.incompleteFolders }}
                </p>
              </div>
            </div>

            <div
              v-if="status.summary.unavailableRemoteVideos > 0 || invalidDetected > 0"
              class="space-y-1.5 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] p-3 text-xs text-amber-800 dark:text-amber-200"
            >
              <p v-if="status.summary.unavailableRemoteVideos > 0">
                {{ t("sync.unavailableHint", { count: status.summary.unavailableRemoteVideos }) }}
              </p>
              <p v-if="invalidDetected > 0">
                {{ t("sync.invalidDetectedHint", { count: invalidDetected }) }}
              </p>
            </div>

            <div
              v-if="status.unresolvedItems.length || status.incompleteFolders.length || status.errors.length"
              class="space-y-2 rounded-lg border border-destructive/20 bg-destructive/[0.04] p-3"
            >
              <div class="flex items-center gap-2 text-xs font-semibold">
                <AlertTriangle class="h-4 w-4 text-destructive" />
                {{ t("sync.diagnostics") }}
              </div>
              <ul class="max-h-32 space-y-1 overflow-auto text-xs text-muted-foreground">
                <li
                  v-for="item in status.unresolvedItems.slice(0, 5)"
                  :key="`unresolved-${item.remoteFolderId}-${item.aid}-${item.title}`"
                >
                  {{ item.folder }} · {{ item.title || `aid ${item.aid ?? '-'}` }} — {{ item.reason }}
                </li>
                <li
                  v-for="item in status.incompleteFolders.slice(0, 5)"
                  :key="`incomplete-${item.remoteFolderId}`"
                >
                  {{ item.folder }} · {{ item.observed }}/{{ item.expected }} — {{ item.reason }}
                </li>
                <li
                  v-for="(item, index) in status.errors.slice(0, 5)"
                  :key="`error-${index}-${item.folder}`"
                >
                  {{ item.folder }} — {{ item.message }}
                </li>
              </ul>
            </div>

            <div
              v-if="status.phase === 'paused' || status.phase === 'failed' || status.phase === 'waiting'"
              class="flex flex-wrap justify-end gap-2"
            >
              <Button
                size="sm"
                variant="outline"
                :disabled="loading"
                @click="emit('restart')"
              >
                <ListRestart class="h-3.5 w-3.5" />
                {{ t("sync.restart") }}
              </Button>
              <Button
                v-if="status.phase !== 'waiting'"
                size="sm"
                :disabled="loading || !canResume"
                @click="emit('resume')"
              >
                <RefreshCcw class="h-3.5 w-3.5" />
                {{ t("sync.resumeNow") }}
              </Button>
            </div>

            <div v-if="taskActive" class="flex justify-end">
              <Button
                size="sm"
                variant="destructive"
                :disabled="stopping"
                @click="emit('stop')"
              >
                <Square class="h-3.5 w-3.5" />
                {{ stopping ? t("sync.stopping") : t("sync.stop") }}
              </Button>
            </div>

            <div
              v-else-if="status.phase !== 'idle'"
              class="flex justify-end"
            >
              <Button
                size="sm"
                variant="outline"
                :disabled="loading"
                @click="emit('dismiss')"
              >
                {{ t("sync.dismissStatus") }}
              </Button>
            </div>
          </div>
        </section>

        <div v-if="!taskActive" class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {{
                t("sync.folderCount", {
                  selected: selectedFolderIds.length,
                  total: folders.length,
                })
              }}
            </Badge>
            <Badge variant="outline">
              {{ t("common.videosCount", { count: selectedVideoCount }) }}
            </Badge>
            <Badge v-if="resumePage > 1" variant="outline">
              {{ t("sync.resumeHint", { page: resumePage }) }}
            </Badge>
          </div>
          <Button
            size="sm"
            variant="outline"
            :disabled="fetchingFolders || loading"
            @click="emit('reload')"
          >
            <RefreshCcw class="h-3.5 w-3.5" />
            {{ t("sync.reloadFolders") }}
          </Button>
        </div>

        <div v-if="!taskActive" class="space-y-2 rounded-lg border bg-muted/20 p-3">
          <div class="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              :disabled="
                loading ||
                fetchingFolders ||
                folders.length === 0 ||
                allFoldersSelected
              "
              @click="emit('select-all')"
            >
              {{ t("common.selectAll") }}
            </Button>
            <Button
              size="sm"
              variant="outline"
              :disabled="loading || selectedFolderIds.length === 0"
              @click="emit('clear-selection')"
            >
              {{ t("common.clear") }}
            </Button>
          </div>
          <p class="text-xs text-muted-foreground">{{ t("sync.queueHint") }}</p>
        </div>

        <div
          v-if="!taskActive"
          class="panel-surface-soft max-h-[300px] space-y-2 overflow-auto rounded-lg border p-3"
        >
          <div
            v-if="fetchingFolders"
            class="text-sm text-muted-foreground"
          >
            {{ t("sync.loadingFolders") }}
          </div>
          <div
            v-else-if="folders.length === 0"
            class="text-sm text-muted-foreground"
          >
            {{ t("sync.emptyFolders") }}
          </div>
          <label
            v-for="folder in folders"
            :key="folder.remoteId"
            class="panel-surface interactive-lift flex cursor-pointer items-center justify-between rounded-md border p-3"
          >
            <div class="flex min-w-0 items-start gap-2.5">
              <Checkbox
                :model-value="selectedFolderIds.includes(folder.remoteId)"
                :disabled="loading"
                class="mt-0.5"
                @update:model-value="
                  emit('toggle-folder', folder.remoteId, $event === true)
                "
              />
              <div class="min-w-0">
                <p class="truncate text-sm font-medium">{{ folder.title }}</p>
                <p class="text-xs text-muted-foreground">
                  {{
                    t("sync.remoteVideoCount", {
                      count: folder.mediaCount,
                    })
                  }}
                </p>
              </div>
            </div>
            <ShieldCheck
              class="h-4 w-4 shrink-0 text-muted-foreground"
              :class="selectedFolderIds.includes(folder.remoteId) ? 'text-primary' : ''"
            />
          </label>
        </div>

        <div class="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="outline"
            @click="emit('update:open', false)"
          >
            {{ taskActive ? t("common.close") : t("common.cancel") }}
          </Button>
          <Button
            v-if="!taskActive"
            :disabled="
              loading ||
              fetchingFolders ||
              selectedFolderIds.length === 0
            "
            @click="emit('submit')"
          >
            <FolderSync class="h-3.5 w-3.5" />
            {{ t("sync.startImport") }}
          </Button>
        </div>
      </section>
    </DialogContent>
  </Dialog>
</template>
