<script setup lang="ts">
// 大數字結果顯示卡 —— 長輩友善:數字大、標籤清楚
defineProps<{
  label: string
  value: string
  hint?: string
  highlight?: boolean
}>()
</script>

<template>
  <div
    class="rounded-2xl border p-5 text-center transition"
    :class="
      highlight
        ? 'border-brand-300 bg-brand-50'
        : 'border-line bg-white'
    "
  >
    <div class="text-sm font-medium text-ink-500">{{ label }}</div>
    <div
      class="mt-1 text-3xl font-black tracking-tight"
      :class="highlight ? 'text-brand-700' : 'text-ink-900'"
    >
      {{ value }}
    </div>
    <div v-if="hint" class="mt-1 text-xs text-ink-500">{{ hint }}</div>
  </div>
</template>
