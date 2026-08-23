<script setup lang="ts">
import { CalendarHeart, ExternalLink, RefreshCcw, X } from "lucide-vue-next";
import type { MemoryVideo } from "../types";
import { formatFavoriteDate, formatRelativeYears } from "../format";

defineProps<{
  video: MemoryVideo;
  sourceLabel: string;
}>();

const emit = defineEmits<{
  close: [];
  again: [];
}>();

function handleBackdrop(event: MouseEvent) {
  if (event.target === event.currentTarget) emit("close");
}
</script>

<template>
  <div class="memory-dialog-backdrop" role="presentation" @click="handleBackdrop">
    <section class="memory-dialog" role="dialog" aria-modal="true" aria-labelledby="random-memory-title">
      <button type="button" class="memory-dialog__close" aria-label="关闭" @click="emit('close')">
        <X :size="20" />
      </button>

      <div class="memory-dialog__visual" :class="{ 'memory-dialog__visual--empty': !video.coverUrl }">
        <img
          v-if="video.coverUrl"
          :src="video.coverUrl"
          :alt="video.title"
          referrerpolicy="no-referrer"
        />
        <div class="memory-dialog__wash" />
        <p class="memory-dialog__source">{{ sourceLabel }}</p>
        <div class="memory-dialog__date">
          <CalendarHeart :size="17" />
          <span>{{ formatFavoriteDate(video.favoriteAt, true) }}</span>
        </div>
      </div>

      <div class="memory-dialog__content">
        <p class="memory-dialog__relative">这是你 {{ formatRelativeYears(video.favoriteAt) }} 收下的一段记忆</p>
        <h2 id="random-memory-title">{{ video.title }}</h2>
        <p class="memory-dialog__uploader">{{ video.uploader }}</p>
        <p class="memory-dialog__description">{{ video.description || "有些回忆不需要注释，重新点开就会想起来。" }}</p>

        <div class="memory-dialog__actions">
          <button type="button" class="button button--ghost" @click="emit('again')">
            <RefreshCcw :size="17" /> 再抽一次
          </button>
          <a :href="video.videoUrl" target="_blank" rel="noreferrer" class="button button--primary">
            打开这段回忆 <ExternalLink :size="17" />
          </a>
        </div>
      </div>
    </section>
  </div>
</template>
