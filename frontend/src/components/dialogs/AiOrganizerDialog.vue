<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  Bot,
  CircleStop,
  CheckCircle2,
  Download,
  Pause,
  Play,
  RefreshCcw,
  RotateCcw,
  Settings,
  TriangleAlert,
  Undo2,
} from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogScrollContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  AiOrganizerConfig,
  AiOrganizerPreviewItem,
  AiOrganizerStatus,
  AiSettings,
  Folder,
  Pagination,
} from "@/types";

const props = defineProps<{
  open: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
  status: AiOrganizerStatus | null;
  settings: AiSettings | null;
  currentFolder: Folder | null;
  busy: boolean;
  previewItems: AiOrganizerPreviewItem[];
  previewPagination: Pagination | null;
  previewLowOnly: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  settings: [];
  refresh: [];
  start: [config: Partial<AiOrganizerConfig>];
  pause: [];
  resume: [];
  cancel: [];
  apply: [];
  undo: [];
  backup: [];
  "preview-page": [page: number];
  "update:preview-low-only": [value: boolean];
  "update-assignment": [videoId: number, folderKey: string];
}>();

const scope = ref<"all" | "folder">("all");
const folderCount = ref("10");
const confidenceThreshold = ref("0.65");
const referenceExistingFolders = ref(true);
const instructions = ref("");
const folderCountOptions = [5, 8, 10, 15, 20, 30];
const confidenceOptions = [
  { value: "0.55", labelKey: "ai.organizer.confidenceLoose" },
  { value: "0.65", labelKey: "ai.organizer.confidenceBalanced" },
  { value: "0.75", labelKey: "ai.organizer.confidenceStrict" },
];

const phase = computed(() => props.status?.phase ?? "idle");
const settingsReady = computed(
  () =>
    Boolean(props.settings?.enabled) &&
    Boolean(props.settings?.apiKeySet) &&
    Boolean(props.settings?.model),
);
const taskActive = computed(() =>
  ["planning", "classifying", "waiting", "paused"].includes(phase.value),
);
const canStart = computed(
  () =>
    settingsReady.value &&
    !props.busy &&
    !taskActive.value &&
    phase.value !== "ready",
);
const canPreview = computed(() => (props.status?.processed ?? 0) > 0);
const totalPages = computed(() => {
  const pagination = props.previewPagination;
  if (!pagination) return 1;
  return Math.max(1, Math.ceil(pagination.total / pagination.pageSize));
});

function hydrateForm() {
  const config = props.status?.config;
  if (!config) return;
  scope.value = config.scope;
  folderCount.value = String(config.folderCount);
  confidenceThreshold.value = String(config.confidenceThreshold);
  referenceExistingFolders.value = config.referenceExistingFolders;
  instructions.value = config.instructions;
}

function submitStart(replaceReadyPlan = false) {
  if (
    (!canStart.value && !replaceReadyPlan) ||
    !settingsReady.value ||
    props.busy ||
    taskActive.value
  ) {
    return;
  }
  emit("start", {
    scope: scope.value,
    folderId: scope.value === "folder" ? props.currentFolder?.id ?? null : null,
    folderCount: Number(folderCount.value),
    referenceExistingFolders: referenceExistingFolders.value,
    instructions: instructions.value,
    confidenceThreshold: Number(confidenceThreshold.value),
    batchSize: 25,
  });
}

watch(
  () => [props.open, props.status?.id] as const,
  ([open]) => {
    if (open) hydrateForm();
  },
  { immediate: true },
);

watch(
  () => props.currentFolder?.id,
  (folderId) => {
    if (!folderId && scope.value === "folder") scope.value = "all";
  },
);
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogScrollContent
      class="my-4 flex max-h-[calc(100dvh-2rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:my-6 sm:max-h-[calc(100dvh-3rem)]"
    >
      <DialogHeader class="shrink-0 border-b px-4 py-4 sm:px-6">
        <div class="flex flex-wrap items-center justify-between gap-3 pr-7">
          <DialogTitle class="flex items-center gap-2">
            <span class="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-muted/60">
              <Bot class="h-4 w-4" />
            </span>
            {{ t("ai.organizer.title") }}
          </DialogTitle>
          <div class="flex items-center gap-2">
            <Badge :variant="phase === 'failed' ? 'destructive' : 'secondary'">
              {{ t(`ai.organizer.phase.${phase}`) }}
            </Badge>
            <Button
              size="icon"
              variant="outline"
              :title="t('header.aiSettings')"
              :aria-label="t('header.aiSettings')"
              @click="emit('settings')"
            >
              <Settings class="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogHeader>

      <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">

      <section
        v-if="!settingsReady"
        class="flex items-start justify-between gap-3 border-y py-3"
      >
        <div class="flex min-w-0 items-start gap-2 text-sm">
          <TriangleAlert class="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>{{ t("ai.organizer.settingsRequired") }}</span>
        </div>
        <Button size="sm" variant="outline" @click="emit('settings')">
          <Settings class="h-3.5 w-3.5" />
          {{ t("header.aiSettings") }}
        </Button>
      </section>

      <section
        v-if="taskActive || phase === 'ready' || phase === 'failed' || phase === 'completed'"
        class="space-y-3 border-y py-4"
        aria-live="polite"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="flex min-w-0 items-start gap-2">
            <CheckCircle2
              v-if="phase === 'ready' || phase === 'completed'"
              class="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
            />
            <TriangleAlert
              v-else-if="phase === 'failed'"
              class="mt-0.5 h-4 w-4 shrink-0 text-destructive"
            />
            <Bot v-else class="mt-0.5 h-4 w-4 shrink-0" />
            <div class="min-w-0">
              <p class="text-sm font-medium">
                {{ t(`ai.organizer.phaseDetail.${phase}`) }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ status?.provider || "-" }} / {{ status?.model || "-" }}
              </p>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" :disabled="busy" @click="emit('refresh')">
              <RefreshCcw class="h-3.5 w-3.5" />
              {{ t("common.refresh") }}
            </Button>
            <Button
              v-if="status?.running"
              size="sm"
              variant="outline"
              :disabled="busy"
              @click="emit('pause')"
            >
              <Pause class="h-3.5 w-3.5" />
              {{ t("ai.organizer.pause") }}
            </Button>
            <Button
              v-if="phase === 'paused' || phase === 'failed'"
              size="sm"
              :disabled="busy"
              @click="emit('resume')"
            >
              <Play class="h-3.5 w-3.5" />
              {{ t("ai.organizer.resume") }}
            </Button>
            <Button
              v-if="taskActive"
              size="sm"
              variant="destructive"
              :disabled="busy"
              @click="emit('cancel')"
            >
              <CircleStop class="h-3.5 w-3.5" />
              {{ t("ai.organizer.cancel") }}
            </Button>
          </div>
        </div>

        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-xs">
            <span class="text-muted-foreground">
              {{ t("ai.organizer.progress", { processed: status?.processed ?? 0, total: status?.total ?? 0 }) }}
            </span>
            <span class="font-medium tabular-nums">{{ status?.progress ?? 0 }}%</span>
          </div>
          <Progress :model-value="status?.progress ?? 0" class="h-2" />
        </div>

        <div class="grid grid-cols-2 divide-x overflow-hidden rounded-md border sm:grid-cols-4">
          <div class="px-3 py-2">
            <p class="text-[11px] text-muted-foreground">{{ t("ai.organizer.total") }}</p>
            <p class="text-base font-semibold tabular-nums">{{ status?.total ?? 0 }}</p>
          </div>
          <div class="px-3 py-2">
            <p class="text-[11px] text-muted-foreground">{{ t("ai.organizer.folders") }}</p>
            <p class="text-base font-semibold tabular-nums">{{ status?.taxonomy.length ?? 0 }}</p>
          </div>
          <div class="px-3 py-2">
            <p class="text-[11px] text-muted-foreground">{{ t("ai.organizer.lowConfidence") }}</p>
            <p class="text-base font-semibold tabular-nums">{{ status?.lowConfidence ?? 0 }}</p>
          </div>
          <div class="px-3 py-2">
            <p class="text-[11px] text-muted-foreground">{{ t("ai.organizer.skipped") }}</p>
            <p class="text-base font-semibold tabular-nums">{{ status?.skippedInvalid ?? 0 }}</p>
          </div>
        </div>

        <p v-if="phase === 'ready'" class="text-xs text-muted-foreground">
          {{
            t("ai.organizer.estimatedChanges", {
              added: status?.estimatedFolderLinksAdded ?? 0,
              removed: status?.estimatedFolderLinksRemoved ?? 0,
            })
          }}
        </p>

        <p v-if="status?.lastError" class="flex items-start gap-2 text-xs text-destructive">
          <TriangleAlert class="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{{ status.lastError }}</span>
        </p>
      </section>

      <section v-if="status?.taxonomy.length" class="space-y-2">
        <h3 class="text-sm font-semibold">{{ t("ai.organizer.taxonomy") }}</h3>
        <div class="divide-y rounded-md border">
          <div
            v-for="folder in status.taxonomy"
            :key="folder.key"
            class="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-2"
          >
            <div class="min-w-0">
              <p class="truncate text-sm font-medium">{{ folder.name }}</p>
              <p class="line-clamp-2 text-xs text-muted-foreground">{{ folder.description }}</p>
            </div>
            <Badge variant="secondary" class="self-center tabular-nums">{{ folder.count }}</Badge>
          </div>
        </div>
      </section>

      <section v-if="canPreview" class="space-y-2">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-semibold">{{ t("ai.organizer.preview") }}</h3>
          <label class="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              :model-value="previewLowOnly"
              @update:model-value="emit('update:preview-low-only', $event === true)"
            />
            {{ t("ai.organizer.onlyLowConfidence") }}
          </label>
        </div>
        <div class="divide-y rounded-md border">
          <div
            v-for="item in previewItems"
            :key="item.videoId"
            class="grid gap-2 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_180px_80px] sm:items-center"
          >
            <div class="min-w-0">
              <p class="truncate text-sm font-medium">{{ item.title }}</p>
              <p class="truncate text-xs text-muted-foreground">{{ item.uploader }} · {{ item.reason }}</p>
            </div>
            <Select
              :model-value="item.lowConfidence ? '__review__' : item.suggestedFolderKey"
              :disabled="busy || phase !== 'ready'"
              @update:model-value="emit('update-assignment', item.videoId, String($event))"
            >
              <SelectTrigger class="h-9 w-full text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__review__">{{ t("ai.organizer.reviewFolder") }}</SelectItem>
                <SelectItem
                  v-for="folder in status?.taxonomy.filter((row) => row.key !== '__review__') ?? []"
                  :key="folder.key"
                  :value="folder.key"
                >
                  {{ folder.name }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Badge :variant="item.lowConfidence ? 'outline' : 'secondary'" class="justify-self-start tabular-nums sm:justify-self-end">
              {{ Math.round(item.confidence * 100) }}%
            </Badge>
          </div>
          <p v-if="previewItems.length === 0" class="px-3 py-6 text-center text-sm text-muted-foreground">
            {{ t("ai.organizer.previewEmpty") }}
          </p>
        </div>
        <div v-if="previewPagination && totalPages > 1" class="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            :disabled="busy || previewPagination.page <= 1"
            @click="emit('preview-page', previewPagination.page - 1)"
          >
            {{ t("common.prev") }}
          </Button>
          <span class="text-xs tabular-nums">{{ previewPagination.page }} / {{ totalPages }}</span>
          <Button
            size="sm"
            variant="outline"
            :disabled="busy || previewPagination.page >= totalPages"
            @click="emit('preview-page', previewPagination.page + 1)"
          >
            {{ t("common.next") }}
          </Button>
        </div>
      </section>

      <section
        v-if="!taskActive && phase !== 'ready' && phase !== 'failed'"
        class="space-y-4 border-t pt-4"
      >
        <div class="grid gap-3 sm:grid-cols-3">
          <label class="space-y-1.5">
            <span class="text-xs text-muted-foreground">{{ t("ai.organizer.scope") }}</span>
            <Select v-model="scope" :disabled="busy">
              <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{{ t("ai.organizer.scopeAll") }}</SelectItem>
                <SelectItem v-if="currentFolder" value="folder">
                  {{ t("ai.organizer.scopeFolder", { folder: currentFolder.name }) }}
                </SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label class="space-y-1.5">
            <span class="text-xs text-muted-foreground">{{ t("ai.organizer.folderCount") }}</span>
            <Select v-model="folderCount" :disabled="busy">
              <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="count in folderCountOptions" :key="count" :value="String(count)">
                  {{ count }}
                </SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label class="space-y-1.5">
            <span class="text-xs text-muted-foreground">{{ t("ai.organizer.confidence") }}</span>
            <Select v-model="confidenceThreshold" :disabled="busy">
              <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="option in confidenceOptions" :key="option.value" :value="option.value">
                  {{ t(option.labelKey) }}
                </SelectItem>
              </SelectContent>
            </Select>
          </label>
        </div>

        <label class="flex items-start gap-3 border-y py-3">
          <Checkbox
            :model-value="referenceExistingFolders"
            :disabled="busy"
            class="mt-0.5"
            @update:model-value="referenceExistingFolders = $event === true"
          />
          <div>
            <p class="text-sm font-medium">{{ t("ai.organizer.referenceFolders") }}</p>
            <p class="text-xs text-muted-foreground">{{ t("ai.organizer.referenceFoldersDesc") }}</p>
          </div>
        </label>

        <label class="space-y-1.5">
          <span class="text-xs text-muted-foreground">{{ t("ai.organizer.instructions") }}</span>
          <Textarea
            v-model="instructions"
            :disabled="busy"
            :maxlength="2000"
            :placeholder="t('ai.organizer.instructionsPlaceholder')"
            class="min-h-24 resize-y"
          />
        </label>
      </section>
      </div>

      <DialogFooter
        class="shrink-0 flex-row flex-wrap justify-between gap-2 border-t bg-background px-4 py-3 sm:px-6"
      >
        <div class="flex flex-wrap gap-2">
          <Button
            v-if="status?.id"
            variant="outline"
            :disabled="busy"
            @click="emit('backup')"
          >
            <Download class="h-3.5 w-3.5" />
            {{ t("ai.organizer.downloadBackup") }}
          </Button>
          <Button
            v-if="status?.canUndo"
            variant="outline"
            :disabled="busy"
            @click="emit('undo')"
          >
            <Undo2 class="h-3.5 w-3.5" />
            {{ t("ai.organizer.undo") }}
          </Button>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button variant="outline" :disabled="busy" @click="emit('update:open', false)">
            {{ t("common.close") }}
          </Button>
          <Button
            v-if="status?.canApply"
            :disabled="busy"
            @click="emit('apply')"
          >
            <CheckCircle2 class="h-3.5 w-3.5" />
            {{ t("ai.organizer.apply") }}
          </Button>
          <Button
            v-if="phase === 'ready'"
            variant="outline"
            :disabled="busy || !settingsReady"
            @click="submitStart(true)"
          >
            <RotateCcw class="h-3.5 w-3.5" />
            {{ t("ai.organizer.restart") }}
          </Button>
          <Button
            v-if="phase === 'failed'"
            :disabled="busy"
            @click="emit('resume')"
          >
            <RotateCcw class="h-3.5 w-3.5" />
            {{ t("ai.organizer.retry") }}
          </Button>
          <Button
            v-if="phase === 'failed'"
            variant="outline"
            :disabled="busy || !settingsReady"
            @click="submitStart(true)"
          >
            <RotateCcw class="h-3.5 w-3.5" />
            {{ t("ai.organizer.startOver") }}
          </Button>
          <Button
            v-if="!taskActive && phase !== 'ready' && phase !== 'failed'"
            :disabled="!canStart"
            @click="submitStart"
          >
            <Bot class="h-3.5 w-3.5" />
            {{ t("ai.organizer.start") }}
          </Button>
        </div>
      </DialogFooter>
    </DialogScrollContent>
  </Dialog>
</template>
