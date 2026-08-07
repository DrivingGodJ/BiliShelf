<script setup lang="ts">
import { computed } from "vue";
import {
  Clock3,
  Bot,
  CircleStop,
  Eye,
  Pause,
  Play,
  TriangleAlert,
} from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { AiOrganizerStatus } from "@/types";

const props = defineProps<{
  status: AiOrganizerStatus;
  busy: boolean;
  nowMs: number;
  t: (key: string, vars?: Record<string, string | number>) => string;
}>();

const emit = defineEmits<{
  open: [];
  pause: [];
  resume: [];
  stop: [];
}>();

const phase = computed(() => props.status.phase);
const retryRemainingSeconds = computed(() => {
  if (!props.status.nextRunAt) return 0;
  return Math.max(0, Math.ceil((props.status.nextRunAt - props.nowMs) / 1000));
});
</script>

<template>
  <section class="panel-surface rounded-2xl border bg-card/80 px-3 py-3 shadow-sm sm:px-4" aria-live="polite">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="flex min-w-0 items-start gap-2.5">
        <span
          class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-muted/60 text-muted-foreground"
        >
          <TriangleAlert v-if="phase === 'failed'" class="h-4 w-4 text-destructive" />
          <Clock3
            v-else-if="phase === 'waiting' || phase === 'paused'"
            class="h-4 w-4 text-amber-600 dark:text-amber-400"
          />
          <Bot v-else class="h-4 w-4" />
        </span>
        <div class="min-w-0 space-y-0.5">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-sm font-semibold">{{ t("ai.organizer.title") }}</h2>
            <Badge :variant="phase === 'failed' ? 'destructive' : 'secondary'">
              {{ t(`ai.organizer.phase.${phase}`) }}
            </Badge>
          </div>
          <p class="text-xs text-muted-foreground">
            {{ t(`ai.organizer.phaseDetail.${phase}`) }}
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-end gap-2">
        <Button size="sm" variant="outline" :disabled="busy" @click="emit('open')">
          <Eye class="h-3.5 w-3.5" />
          {{ phase === "ready" ? t("ai.organizer.reviewPlan") : t("ai.organizer.viewStatus") }}
        </Button>
        <Button
          v-if="status.running"
          size="sm"
          variant="outline"
          :disabled="busy"
          @click="emit('pause')"
        >
          <Pause class="h-3.5 w-3.5" />
          {{ t("ai.organizer.pause") }}
        </Button>
        <Button
          v-else-if="phase === 'paused' || phase === 'failed'"
          size="sm"
          :disabled="busy"
          @click="emit('resume')"
        >
          <Play class="h-3.5 w-3.5" />
          {{ phase === "failed" ? t("ai.organizer.retry") : t("ai.organizer.resume") }}
        </Button>
        <Button
          v-if="status.running || phase === 'paused'"
          size="icon"
          variant="destructive"
          :disabled="busy"
          :title="t('ai.organizer.cancel')"
          :aria-label="t('ai.organizer.cancel')"
          @click="emit('stop')"
        >
          <CircleStop class="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>

    <div class="mt-3 space-y-1.5">
      <div class="flex items-center justify-between gap-3 text-xs">
        <span class="text-muted-foreground">
          {{ t("ai.organizer.progress", { processed: status.processed, total: status.total }) }}
        </span>
        <span class="shrink-0 font-medium tabular-nums">{{ status.progress }}%</span>
      </div>
      <Progress :model-value="status.progress" class="h-2" />
    </div>

    <div
      v-if="phase === 'waiting' && status.nextRunAt"
      class="mt-2 flex items-start gap-2 text-xs text-muted-foreground"
    >
      <Clock3 class="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{{ t("ai.organizer.retryCountdown", { seconds: retryRemainingSeconds }) }}</span>
    </div>

    <p
      v-if="status.lastError"
      class="mt-2 break-words border-l-2 border-destructive/60 pl-3 text-xs text-destructive"
    >
      {{ status.lastError }}
    </p>
  </section>
</template>
