<script setup lang="ts">
// 法規依據 / 提醒框 —— 讓使用者信任計算結果,符合「附上依據」原則
defineProps<{ title?: string }>()
</script>

<template>
  <div class="rounded-2xl border border-line bg-brand-50/60 p-5">
    <div class="flex items-center gap-2 text-brand-800 font-semibold mb-2">
      <span>📌</span>
      <span>{{ title ?? '計算依據與提醒' }}</span>
    </div>
    <div class="text-sm leading-relaxed text-ink-700 space-y-1.5">
      <slot />
    </div>
  </div>
</template>
