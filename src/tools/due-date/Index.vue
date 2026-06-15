<script setup lang="ts">
import { ref, computed } from 'vue'
import ResultStat from '@/components/ResultStat.vue'
import LegalNote from '@/components/LegalNote.vue'

const lmp = ref<string>('') // 末次月經第一天

const MS_DAY = 86400000

const due = computed(() => {
  if (!lmp.value) return null
  const start = new Date(lmp.value)
  if (isNaN(start.getTime())) return null
  return new Date(start.getTime() + 280 * MS_DAY)
})

const progress = computed(() => {
  if (!lmp.value) return null
  const start = new Date(lmp.value)
  if (isNaN(start.getTime())) return null
  const days = Math.floor((Date.now() - start.getTime()) / MS_DAY)
  if (days < 0) return null
  const weeks = Math.floor(days / 7)
  let trimester = '第一孕期'
  if (weeks >= 28) trimester = '第三孕期'
  else if (weeks >= 14) trimester = '第二孕期'
  return { weeks, days: days % 7, trimester, totalDays: days }
})

function fmt(d: Date): string {
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6">
      <label class="field-label">最後一次月經的第一天(LMP)</label>
      <input v-model="lmp" type="date" class="field-input" />
      <p class="field-hint">以一般 28 天月經週期、預產期 = LMP + 280 天(40 週)推算(Naegele 法則)。</p>
    </div>

    <div v-if="due" class="space-y-4">
      <ResultStat label="預產期" :value="fmt(due)" highlight />
      <div v-if="progress" class="grid gap-4 sm:grid-cols-2">
        <ResultStat label="目前懷孕週數" :value="`${progress.weeks} 週 ${progress.days} 天`" />
        <ResultStat label="孕期階段" :value="progress.trimester" :hint="`已懷孕 ${progress.totalDays} 天`" />
      </div>

      <LegalNote title="說明">
        <p>採 Naegele 法則:預產期 = 末次月經第一天 + 280 天。</p>
        <p class="text-ink-500">
          實際週期長短、排卵日不同會影響結果;預產期僅為估計,正式評估請依產檢超音波與婦產科醫師為準。
        </p>
      </LegalNote>
    </div>

    <div v-else class="card p-8 text-center text-ink-500">選擇末次月經第一天,即可推算預產期。</div>
  </div>
</template>
