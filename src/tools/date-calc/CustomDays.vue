<script setup lang="ts">
/*
  工作日進階設定:自填「放假日」與「補班日」。
  以 v-model 雙向綁定文字內容與展開狀態;父層用 parseDateList 解析。
*/
defineProps<{
  show: boolean
  holidays: string
  workdays: string
  count: { holidays: number; workdays: number }
}>()
defineEmits<{
  'update:show': [boolean]
  'update:holidays': [string]
  'update:workdays': [string]
}>()
</script>

<template>
  <div class="rounded-2xl border border-line bg-stone-50/60 p-4">
    <button
      type="button"
      class="flex w-full items-center justify-between text-left text-sm font-semibold text-ink-700"
      :aria-expanded="show"
      @click="$emit('update:show', !show)"
    >
      <span>
        進階:放假日 / 補班日
        <span v-if="count.holidays || count.workdays" class="ml-1 font-normal text-ink-500">
          (放假 {{ count.holidays }} 天、補班 {{ count.workdays }} 天)
        </span>
      </span>
      <span class="text-ink-400" aria-hidden="true">{{ show ? '▲' : '▼' }}</span>
    </button>

    <div v-if="show" class="mt-3 grid gap-4 sm:grid-cols-2">
      <div>
        <label class="field-label">放假日(視為不上班)</label>
        <textarea
          :value="holidays"
          rows="4"
          class="field-input font-mono text-sm"
          placeholder="一行一個,例如&#10;2026-01-01&#10;2026-02-28"
          @input="$emit('update:holidays', ($event.target as HTMLTextAreaElement).value)"
        ></textarea>
        <p class="mt-1 text-xs text-ink-500">國定假日、公司休假日;落在平日也會被扣掉。</p>
      </div>
      <div>
        <label class="field-label">補班日(視為要上班)</label>
        <textarea
          :value="workdays"
          rows="4"
          class="field-input font-mono text-sm"
          placeholder="一行一個,例如&#10;2026-02-14"
          @input="$emit('update:workdays', ($event.target as HTMLTextAreaElement).value)"
        ></textarea>
        <p class="mt-1 text-xs text-ink-500">補行上班、颱風補班;落在週末也算工作日(優先於放假)。</p>
      </div>
    </div>
  </div>
</template>
