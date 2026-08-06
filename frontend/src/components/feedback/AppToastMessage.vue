<script setup lang="ts">
import { CircleAlert, CircleCheck } from "lucide-vue-next";

const props = defineProps<{
  kind: "success" | "error";
  title: string;
  description?: string;
}>();
</script>

<template>
  <div class="app-toast-message">
    <span class="app-toast-message__icon" aria-hidden="true">
      <CircleAlert v-if="props.kind === 'error'" class="h-4 w-4" />
      <CircleCheck v-else class="h-4 w-4" />
    </span>
    <span class="app-toast-message__copy">
      <strong class="app-toast-message__title">{{ props.title }}</strong>
      <span v-if="props.description" class="app-toast-message__description">
        {{ props.description }}
      </span>
    </span>
  </div>
</template>
