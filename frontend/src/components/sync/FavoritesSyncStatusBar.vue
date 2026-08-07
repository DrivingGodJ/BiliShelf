<script setup lang="ts">
import { computed } from "vue";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FolderSync,
  Square,
} from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { HistoryModelSyncStatus } from "@/types";

const props = defineProps<{
  status: HistoryModelSyncStatus;
  stopping: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
}>();

const emit = defineEmits<{
  open: [];
  stop: [];
  dismiss: [];
}>();

const active = computed(
  () =>
    props.status.running ||
    (props.status.phase === "waiting" && props.status.retryAutomatic),
);
const invalidDetected = computed(() =>
  Math.max(0, Number(props.status.invalidVideosDetected || 0)),
);
const hasWarnings = computed(
  () =>
    props.status.summary.unavailableRemoteVideos > 0 ||
    invalidDetected.value > 0,
);
const progressPercent = computed(() => {
  if (props.status.phase === "completed") return 100;
  if (props.status.total > 0) {
    return Math.min(
      100,
      Math.round((props.status.current / props.status.total) * 100),
    );
  }
  return props.status.folderTotal > 0
    ? Math.min(100, Math.round((props.status.folderIndex / props.status.folderTotal) * 100))
    : 0;
});
const phaseVariant = computed(() => {
  if (props.status.phase === "failed" || props.status.riskBlocked) return "destructive";
  return "secondary";
});
</script>

<template>
  <section
    class="panel-surface rounded-2xl border bg-card/80 px-3 py-3 shadow-sm sm:px-4"
    aria-live="polite"
    aria-atomic="false"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="flex min-w-0 items-start gap-2.5">
        <span class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-muted/60 text-muted-foreground">
          <CheckCircle2
            v-if="status.phase === 'completed' && !hasWarnings"
            class="h-4 w-4 text-emerald-600 dark:text-emerald-400"
          />
          <AlertTriangle
            v-else-if="status.phase === 'failed' || hasWarnings"
            class="h-4 w-4 text-amber-600 dark:text-amber-400"
          />
          <Clock3 v-else-if="status.phase === 'paused' || status.phase === 'waiting'" class="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <FolderSync v-else class="h-4 w-4" />
        </span>
        <div class="min-w-0 space-y-0.5">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-sm font-semibold">{{ t("sync.statusTitle") }}</h2>
            <Badge :variant="phaseVariant">{{ t(`sync.phase.${status.phase}`) }}</Badge>
          </div>
          <p class="text-xs text-muted-foreground">
            {{ status.message || t("sync.statusReady") }}
            <span v-if="status.folderTitle"> · {{ status.folderTitle }}</span>
            <span v-if="status.currentFolderRemoteId !== null"> · {{ t("sync.page", { page: status.currentPage }) }}</span>
          </p>
        </div>
      </div>
      <div class="flex flex-wrap items-center justify-end gap-2">
        <Button size="sm" variant="outline" @click="emit('open')">
          <FolderSync class="h-3.5 w-3.5" />
          {{ t("sync.openMonitor") }}
        </Button>
        <Button
          v-if="active"
          size="sm"
          variant="destructive"
          :disabled="stopping"
          @click="emit('stop')"
        >
          <Square class="h-3.5 w-3.5" />
          {{ stopping ? t("sync.stopping") : t("sync.stop") }}
        </Button>
        <Button v-else size="sm" variant="outline" @click="emit('dismiss')">
          {{ t("sync.dismissStatus") }}
        </Button>
      </div>
    </div>

    <div class="mt-3 space-y-2">
      <div class="flex items-center justify-between gap-3 text-xs">
        <span class="font-medium">{{ t("sync.currentWork") }}</span>
        <span class="tabular-nums text-muted-foreground">{{ progressPercent }}%</span>
      </div>
      <Progress :model-value="progressPercent" class="h-2" />
    </div>

    <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
      <div class="rounded-lg border bg-background/75 p-2.5">
        <p class="text-[11px] text-muted-foreground">{{ t("sync.scanned") }}</p>
        <p class="mt-1 text-lg font-semibold tabular-nums">{{ status.summary.videosProcessed }}</p>
      </div>
      <div class="rounded-lg border bg-background/75 p-2.5">
        <p class="text-[11px] text-muted-foreground">{{ t("sync.upserted") }}</p>
        <p class="mt-1 text-lg font-semibold tabular-nums">{{ status.summary.videosUpserted }}</p>
      </div>
      <div class="rounded-lg border bg-background/75 p-2.5">
        <p class="text-[11px] text-muted-foreground">{{ t("sync.linked") }}</p>
        <p class="mt-1 text-lg font-semibold tabular-nums">{{ status.summary.folderLinksAdded }}</p>
      </div>
      <div class="rounded-lg border border-amber-500/25 bg-amber-500/[0.04] p-2.5">
        <p class="text-[11px] text-muted-foreground">{{ t("sync.unavailable") }}</p>
        <p class="mt-1 text-lg font-semibold tabular-nums">{{ status.summary.unavailableRemoteVideos }}</p>
      </div>
      <div class="rounded-lg border border-amber-500/25 bg-amber-500/[0.04] p-2.5">
        <p class="text-[11px] text-muted-foreground">{{ t("sync.invalidDetected") }}</p>
        <p class="mt-1 text-lg font-semibold tabular-nums">{{ invalidDetected }}</p>
      </div>
    </div>

    <p
      v-if="status.summary.unavailableRemoteVideos > 0"
      class="mt-3 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300"
    >
      <AlertTriangle class="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{{ t("sync.unavailableHint", { count: status.summary.unavailableRemoteVideos }) }}</span>
    </p>
    <p
      v-if="invalidDetected > 0"
      class="mt-2 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300"
    >
      <AlertTriangle class="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{{ t("sync.invalidDetectedHint", { count: invalidDetected }) }}</span>
    </p>
  </section>
</template>
