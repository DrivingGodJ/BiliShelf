<script setup lang="ts">
import { FolderTree, SlidersHorizontal } from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const props = defineProps<{
  t: (key: string, vars?: Record<string, string | number>) => string;
  activeFolderName: string | null;
  resultCount: number;
}>();

const emit = defineEmits<{
  open: [];
}>();
</script>

<template>
  <section
    class="panel-surface flex items-center gap-3 rounded-2xl border border-primary/15 p-2.5 shadow-sm"
    aria-label="Current library scope"
  >
    <Button
      type="button"
      variant="outline"
      class="h-11 shrink-0 gap-2 rounded-xl px-3"
      @click="emit('open')"
    >
      <SlidersHorizontal class="h-4 w-4" />
      {{ props.t("mobile.browseFolders") }}
    </Button>

    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
        <FolderTree class="h-3.5 w-3.5 shrink-0" />
        <span>{{ props.t("mobile.scope") }}</span>
      </div>
      <p class="mt-0.5 truncate text-sm font-semibold">
        {{ props.activeFolderName || props.t("mobile.allVideos") }}
      </p>
    </div>

    <Badge variant="secondary" class="shrink-0 tabular-nums">
      {{ props.t("mobile.resultCount", { count: props.resultCount }) }}
    </Badge>
  </section>
</template>
