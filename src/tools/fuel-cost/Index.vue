<script setup lang="ts">
import { ref, computed } from 'vue'
import ResultStat from '@/components/ResultStat.vue'
import LegalNote from '@/components/LegalNote.vue'
import { ntd, num } from '@/utils/format'

const distance = ref<number | null>(null) // 單程距離(公里)
const roundTrip = ref(true) // 是否來回
const efficiency = ref<number | null>(null) // 油耗
const effUnit = ref<'kmpl' | 'l100'>('kmpl') // km/L 或 L/100km
const price = ref<number | null>(22.5) // 油價(元/公升),預設常見 95 油價
const people = ref<number | null>(1) // 分攤人數

const result = computed(() => {
  const d0 = distance.value ?? 0
  if (d0 <= 0) return null
  const d = roundTrip.value ? d0 * 2 : d0
  const eff = efficiency.value ?? 0
  const p = price.value ?? 0
  if (eff <= 0 || p <= 0) return null

  // 換算成每公里耗油(公升)
  const litersPerKm = effUnit.value === 'kmpl' ? 1 / eff : eff / 100
  const liters = d * litersPerKm
  const total = liters * p
  const n = Math.max(1, Math.round(people.value ?? 1))
  return {
    totalDistance: d,
    liters,
    total,
    perPerson: total / n,
    perKm: total / d,
    people: n,
  }
})
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-5">
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label">單程距離(公里)</label>
          <input v-model.number="distance" type="number" min="0" step="0.1" placeholder="例:120" class="field-input" />
        </div>
        <div>
          <label class="field-label">油價(元/公升)</label>
          <input v-model.number="price" type="number" min="0" step="0.1" placeholder="例:22.5" class="field-input" />
        </div>
        <div>
          <label class="field-label">油耗</label>
          <div class="flex gap-2">
            <input v-model.number="efficiency" type="number" min="0" step="0.1" placeholder="例:15" class="field-input flex-1" />
            <select v-model="effUnit" class="field-input w-36">
              <option value="kmpl">公里/公升</option>
              <option value="l100">公升/百公里</option>
            </select>
          </div>
        </div>
        <div>
          <label class="field-label">分攤人數</label>
          <input v-model.number="people" type="number" min="1" step="1" placeholder="例:4" class="field-input" />
        </div>
      </div>

      <label class="flex items-center gap-2 text-ink-700 select-none cursor-pointer">
        <input v-model="roundTrip" type="checkbox" class="h-5 w-5 rounded border-line text-brand-600" />
        <span>計入回程(來回)</span>
      </label>
    </div>

    <div v-if="result" class="space-y-4">
      <div class="grid gap-4 sm:grid-cols-3">
        <ResultStat label="總油錢" :value="ntd(result.total)" highlight :hint="roundTrip ? '含來回' : '單程'" />
        <ResultStat
          v-if="result.people > 1"
          label="每人分攤"
          :value="ntd(result.perPerson)"
          :hint="result.people + ' 人均分'"
        />
        <ResultStat label="預估耗油" :value="num(result.liters, 1) + ' 公升'" />
        <ResultStat label="行駛總里程" :value="num(result.totalDistance, 0) + ' 公里'" />
        <ResultStat label="每公里成本" :value="ntd(result.perKm)" />
      </div>

      <LegalNote title="說明">
        <p>總油錢 = 行駛里程 × 每公里耗油量 × 油價。油耗以原廠或實際平均值估算最準。</p>
        <p class="text-ink-500">
          實際油耗受路況、載重、冷氣、駕駛習慣影響;油價也常浮動。本工具為概算,僅供旅程預算與分攤參考。電動車可把「油價」改填每度電價、「油耗」改填每公里耗電(度/100km)。
        </p>
      </LegalNote>
    </div>

    <div v-else class="card p-8 text-center text-ink-500">
      填入距離、油耗與油價,馬上算出整趟油錢與每人該分多少。
    </div>
  </div>
</template>
