<script setup lang="ts">
import { computed } from "vue";
import {
  CheckCircle2,
  Clock3,
  Play,
  RefreshCcw,
  RotateCcw,
  Square,
  Tags,
  TriangleAlert,
} from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { TagEnrichmentStatus } from "@/lib/api";

const props = defineProps<{
  status: TagEnrichmentStatus | null;
  loading: boolean;
  nowMs: number;
  t: (key: string, vars?: Record<string, string | number>) => string;
}>();

const emit = defineEmits<{
  refresh: [];
  start: [];
  stop: [];
  run: [];
}>();

const phase = computed(() => props.status?.phase ?? "idle");
const active = computed(
  () => phase.value === "running" || phase.value === "waiting"
);
const cooldownActive = computed(
  () =>
    phase.value === "paused" &&
    Boolean(props.status?.nextRunAt) &&
    retryRemainingSeconds.value > 0
);
const progressPercent = computed(() => {
  const status = props.status;
  if (!status) return 0;
  if (status.phase === "completed") return 100;
  if (status.total <= 0) return 0;
  return Math.min(100, Math.round((status.processed / status.total) * 100));
});
const retryRemainingSeconds = computed(() => {
  const nextRunAt = props.status?.nextRunAt;
  if (!nextRunAt) return 0;
  return Math.max(0, Math.ceil((nextRunAt - props.nowMs) / 1000));
});
const nextRunLabel = computed(() => {
  const nextRunAt = props.status?.nextRunAt;
  if (!nextRunAt) return "";
  return new Date(nextRunAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
});
</script>

<template>
  <section
    class="border-y bg-background/70 px-3 py-3 sm:px-4"
    aria-live="polite"
    aria-atomic="false"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="flex min-w-0 items-start gap-2.5">
        <span
          class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-muted/60 text-muted-foreground"
        >
          <CheckCircle2
            v-if="phase === 'completed'"
            class="h-4 w-4 text-emerald-600 dark:text-emerald-400"
          />
          <TriangleAlert
            v-else-if="phase === 'failed'"
            class="h-4 w-4 text-destructive"
          />
          <Clock3
            v-else-if="phase === 'waiting' || phase === 'paused'"
            class="h-4 w-4 text-amber-600 dark:text-amber-400"
          />
          <Tags v-else class="h-4 w-4" />
        </span>
        <div class="min-w-0 space-y-0.5">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-sm font-semibold">{{ t("sync.tagEnrichTitle") }}</h2>
            <Badge
              :variant="phase === 'failed' ? 'destructive' : 'secondary'"
            >
              {{ t(`sync.tag.phase.${phase}`) }}
            </Badge>
          </div>
          <p class="text-xs text-muted-foreground">
            {{ t(`sync.tag.phaseDetail.${phase}`) }}
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          :disabled="loading"
          :title="t('sync.reloadTagEnrich')"
          @click="emit('refresh')"
        >
          <RefreshCcw class="h-3.5 w-3.5" />
          <span class="hidden sm:inline">{{ t("sync.reloadTagEnrich") }}</span>
        </Button>
        <Button
          v-if="active"
          size="sm"
          variant="outline"
          :disabled="loading"
          @click="emit('stop')"
        >
          <Square class="h-3.5 w-3.5" />
          {{ t("sync.stopTagEnrich") }}
        </Button>
        <Button
          v-else
          size="sm"
          :disabled="loading || cooldownActive"
          @click="emit('start')"
        >
          <Play class="h-3.5 w-3.5" />
          {{ t("sync.startTagEnrich") }}
        </Button>
        <Button
          v-if="phase === 'waiting'"
          size="sm"
          :disabled="loading"
          @click="emit('run')"
        >
          <RotateCcw class="h-3.5 w-3.5" />
          {{ t("sync.runTagEnrichNow") }}
        </Button>
      </div>
    </div>

    <div class="mt-3 space-y-2">
      <div class="flex items-center justify-between gap-3 text-xs">
        <span class="text-muted-foreground">
          {{
            t("sync.tag.progress", {
              processed: status?.processed ?? 0,
              total: status?.total ?? 0,
              missing: status?.totalMissing ?? 0,
            })
          }}
        </span>
        <span class="shrink-0 font-medium tabular-nums">
          {{ progressPercent }}%
        </span>
      </div>
      <Progress :model-value="progressPercent" class="h-2" />
    </div>

    <div
      class="mt-3 grid grid-cols-2 divide-x divide-y overflow-hidden rounded-md border sm:grid-cols-5 sm:divide-y-0"
    >
      <div class="px-3 py-2">
        <p class="text-[11px] text-muted-foreground">{{ t("sync.tag.succeeded") }}</p>
        <p class="text-base font-semibold tabular-nums">{{ status?.succeeded ?? 0 }}</p>
      </div>
      <div class="px-3 py-2">
        <p class="text-[11px] text-muted-foreground">{{ t("sync.tag.empty") }}</p>
        <p class="text-base font-semibold tabular-nums">{{ status?.empty ?? 0 }}</p>
      </div>
      <div class="px-3 py-2">
        <p class="text-[11px] text-muted-foreground">{{ t("sync.tag.failed") }}</p>
        <p class="text-base font-semibold tabular-nums">{{ status?.failed ?? 0 }}</p>
      </div>
      <div class="px-3 py-2">
        <p class="text-[11px] text-muted-foreground">{{ t("sync.tag.bound") }}</p>
        <p class="text-base font-semibold tabular-nums">{{ status?.tagsBound ?? 0 }}</p>
      </div>
      <div class="col-span-2 px-3 py-2 sm:col-span-1">
        <p class="text-[11px] text-muted-foreground">{{ t("sync.tag.lastBatch") }}</p>
        <p class="text-base font-semibold tabular-nums">
          {{ status?.lastBatchProcessed ?? 0 }}
        </p>
      </div>
    </div>

    <div
      v-if="status?.nextRunAt && (phase === 'waiting' || phase === 'paused')"
      class="mt-3 flex items-start gap-2 text-xs text-muted-foreground"
    >
      <Clock3 class="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        {{
          t("sync.tag.nextRun", {
            time: nextRunLabel,
            seconds: retryRemainingSeconds,
          })
        }}
      </span>
    </div>

    <div
      v-if="status?.lastError"
      class="mt-3 flex items-start gap-2 border-l-2 border-destructive/60 pl-3 text-xs text-destructive"
    >
      <TriangleAlert class="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{{ status.lastError }}</span>
    </div>

    <ul
      v-if="status?.errors.length"
      class="mt-2 max-h-24 space-y-1 overflow-auto pl-5 text-xs text-muted-foreground"
    >
      <li
        v-for="item in status.errors.slice(-3).reverse()"
        :key="`${item.videoId}-${item.occurredAt}-${item.message}`"
        class="break-words"
      >
        {{ item.bvid || `#${item.videoId}` }}: {{ item.message }}
      </li>
    </ul>
  </section>
</template>
