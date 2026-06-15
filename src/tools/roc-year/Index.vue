<script setup lang="ts">
import { ref, computed } from 'vue'
import ResultStat from '@/components/ResultStat.vue'
import LegalNote from '@/components/LegalNote.vue'

const value = ref<number | null>(new Date().getFullYear())
const unit = ref<'ce' | 'roc'>('ce')

// 統一換算成西元年
const ce = computed(() => {
  if (value.value == null) return null
  return unit.value === 'ce' ? value.value : value.value + 1911
})

const roc = computed(() => (ce.value == null ? null : ce.value - 1911))

// 日本年號(以年份概算,實際換代發生在年中)
const japan = computed(() => {
  const y = ce.value
  if (y == null) return '—'
  if (y >= 2019) return `令和 ${y - 2018} 年`
  if (y >= 1989) return `平成 ${y - 1988} 年`
  if (y >= 1926) return `昭和 ${y - 1925} 年`
  if (y >= 1912) return `大正 ${y - 1911} 年`
  return '—'
})

const rocLabel = computed(() => {
  if (roc.value == null) return '—'
  return roc.value > 0 ? `民國 ${roc.value} 年` : `民國前 ${1 - roc.value} 年`
})
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-5">
      <div>
        <label class="field-label">輸入年份</label>
        <div class="flex gap-2">
          <input v-model.number="value" type="number" placeholder="例:2026" class="field-input flex-1" />
          <select v-model="unit" class="field-input w-32">
            <option value="ce">西元</option>
            <option value="roc">民國</option>
          </select>
        </div>
      </div>
    </div>

    <div v-if="ce !== null" class="grid gap-4 sm:grid-cols-3">
      <ResultStat label="西元" :value="`${ce} 年`" highlight />
      <ResultStat label="民國" :value="rocLabel" />
      <ResultStat label="日本年號" :value="japan" />
    </div>

    <LegalNote title="換算說明">
      <p>民國年 = 西元年 − 1911(例:西元 2026 = 民國 115)。</p>
      <p>日本年號以年份概算:令和(2019−)、平成(1989−2019)、昭和(1926−1989)、大正(1912−1926)。</p>
      <p class="text-ink-500">年號換代多發生於年中,跨越當年者實際年號可能與此概算不同。</p>
    </LegalNote>
  </div>
</template>
