<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import ResultStat from '@/components/ResultStat.vue'
import { num } from '@/utils/format'

// 各類別單位對「基準單位」的換算係數(基準:公尺/公斤/平方公尺)
const GROUPS: Record<string, { label: string; units: Record<string, number> }> = {
  length: {
    label: '長度',
    units: { 公里: 1000, 公尺: 1, 公分: 0.01, 公釐: 0.001, 台尺: 0.30303, 英里: 1609.344, 英尺: 0.3048, 英吋: 0.0254 },
  },
  weight: {
    label: '重量',
    units: { 公噸: 1000, 公斤: 1, 公克: 0.001, 台斤: 0.6, 兩: 0.0375, 磅: 0.453592, 盎司: 0.0283495 },
  },
  area: {
    label: '面積',
    units: { 坪: 3.305785, 平方公尺: 1, 平方公分: 0.0001, 公頃: 10000, 甲: 9699.173, 平方英尺: 0.092903 },
  },
}

const group = ref<'length' | 'weight' | 'area' | 'temp'>('area')
const value = ref<number | null>(1)
const from = ref('坪')
const to = ref('平方公尺')

const unitNames = computed(() => (group.value === 'temp' ? ['攝氏', '華氏', '克氏'] : Object.keys(GROUPS[group.value].units)))

watch(group, (g) => {
  if (g === 'temp') {
    from.value = '攝氏'
    to.value = '華氏'
  } else {
    const keys = Object.keys(GROUPS[g].units)
    from.value = keys[0]
    to.value = keys[1] ?? keys[0]
  }
})

function tempConvert(v: number, f: string, t: string): number {
  // 先轉攝氏
  let c = v
  if (f === '華氏') c = ((v - 32) * 5) / 9
  else if (f === '克氏') c = v - 273.15
  // 攝氏轉目標
  if (t === '華氏') return (c * 9) / 5 + 32
  if (t === '克氏') return c + 273.15
  return c
}

const result = computed(() => {
  const v = value.value ?? 0
  if (group.value === 'temp') return tempConvert(v, from.value, to.value)
  const units = GROUPS[group.value].units
  return (v * units[from.value]) / units[to.value]
})
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-5">
      <div>
        <label class="field-label">類別</label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="(g, key) in { length: '長度', weight: '重量', area: '面積', temp: '溫度' }"
            :key="key"
            class="rounded-xl border px-4 py-2 font-medium transition"
            :class="group === key ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-700'"
            @click="group = key as typeof group"
          >
            {{ g }}
          </button>
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label">數值</label>
          <input v-model.number="value" type="number" step="any" placeholder="例:1" class="field-input" />
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="field-label">從</label>
            <select v-model="from" class="field-input">
              <option v-for="u in unitNames" :key="u" :value="u">{{ u }}</option>
            </select>
          </div>
          <div>
            <label class="field-label">到</label>
            <select v-model="to" class="field-input">
              <option v-for="u in unitNames" :key="u" :value="u">{{ u }}</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <ResultStat
      :label="`${value ?? 0} ${from} =`"
      :value="`${num(result, 4)} ${to}`"
      highlight
    />
  </div>
</template>
