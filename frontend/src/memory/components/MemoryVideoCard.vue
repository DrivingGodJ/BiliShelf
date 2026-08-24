<script setup lang="ts">
import { CalendarDays, CircleAlert, ExternalLink, UserRound } from "lucide-vue-next";
import { computed } from "vue";
import type { MemoryVideo } from "../types";
import { formatDuration, formatFavoriteDate } from "../format";

const props = defineProps<{
  video: MemoryVideo;
}>();

const coverUrl = computed(() => props.video.coverUrl || "");

function handleImageError(event: Event) {
  const image = event.currentTarget as HTMLImageElement;
  image.hidden = true;
  image.parentElement?.classList.add("memory-card__cover--empty");
}
</script>

<template>
<article class="memory-card">
  <a
    class="memory-card__cover"
    :href="video.videoUrl"
    target="_blank"
    rel="noreferrer"
    :aria-label="`打开 ${video.title}`"
  >
    <img
      v-if="coverUrl"
      :src="coverUrl"
      :alt="video.title"
      loading="lazy"
      referrerpolicy="no-referrer"
      @error="handleImageError"
    />
    <span v-if="video.duration" class="memory-card__duration">{{ formatDuration(video.duration) }}</span>
    <span class="memory-card__date-stamp">{{ formatFavoriteDate(video.favoriteAt) }}</span>
  </a>

  <div class="memory-card__body">
    <div class="memory-card__eyebrow">
      <span><CalendarDays :size="14" /> 收藏于 {{ formatFavoriteDate(video.favoriteAt) }}</span>
      <span v-if="video.isInvalid" class="memory-card__invalid"><CircleAlert :size="14" /> 已失效</span>
    </div>
    <h3>
      <a :href="video.videoUrl" target="_blank" rel="noreferrer">{{ video.title }}</a>
    </h3>
    <p class="memory-card__description">{{ video.description || "当时没有留下简介，但这段收藏还在。" }}</p>
    <div class="memory-card__footer">
      <span class="memory-card__uploader"><UserRound :size="14" /> {{ video.uploader }}</span>
      <a :href="video.videoUrl" target="_blank" rel="noreferrer" class="memory-card__open">
        去看看 <ExternalLink :size="14" />
      </a>
    </div>
  </div>
</article>
</template>
