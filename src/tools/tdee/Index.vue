<script setup lang="ts">
import { ref, computed } from 'vue'
import ResultStat from '@/components/ResultStat.vue'
import LegalNote from '@/components/LegalNote.vue'
import { num } from '@/utils/format'

const sex = ref<'male' | 'female'>('male')
const age = ref<number | null>(null)
const height = ref<number | null>(null) // cm
const weight = ref<number | null>(null) // kg
const activity = ref<number>(1.375)

const ACTIVITY = [
  { value: 1.2, label: '幾乎不運動(久坐)' },
  { value: 1.375, label: '輕度(每週運動 1–3 天)' },
  { value: 1.55, label: '中度(每週 3–5 天)' },
  { value: 1.725, label: '高度(每週 6–7 天)' },
  { value: 1.9, label: '極高(體力勞動/運動員)' },
]

const result = computed(() => {
  const a = age.value ?? 0
  const h = height.value ?? 0
  const w = weight.value ?? 0
  if (a <= 0 || h <= 0 || w <= 0) return null
  // Mifflin-St Jeor 公式
  const base = 10 * w + 6.25 * h - 5 * a
  const bmr = sex.value === 'male' ? base + 5 : base - 161
  const tdee = bmr * activity.value
  return {
    bmr,
    tdee,
    loseMild: tdee - 300, // 緩和減重 ~0.25kg/週
    lose: tdee - 500, // 減重 ~0.5kg/週
    gain: tdee + 300, // 增重/增肌
  }
})
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-5">
      <div>
        <label class="field-label">生理性別</label>
        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 rounded-xl border px-4 py-2 text-sm font-medium transition"
            :class="sex === 'male' ? 'border-brand-400 bg-brand-50 text-brand-800' : 'border-line bg-white text-ink-600'"
            @click="sex = 'male'"
          >男性</button>
          <button
            type="button"
            class="flex-1 rounded-xl border px-4 py-2 text-sm font-medium transition"
            :class="sex === 'female' ? 'border-brand-400 bg-brand-50 text-brand-800' : 'border-line bg-white text-ink-600'"
            @click="sex = 'female'"
          >女性</button>
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-3">
        <div>
          <label class="field-label">年齡</label>
          <input v-model.number="age" type="number" min="1" max="120" placeholder="例:35" class="field-input" />
        </div>
        <div>
          <label class="field-label">身高(公分)</label>
          <input v-model.number="height" type="number" min="0" placeholder="例:170" class="field-input" />
        </div>
        <div>
          <label class="field-label">體重(公斤)</label>
          <input v-model.number="weight" type="number" min="0" step="0.1" placeholder="例:65" class="field-input" />
        </div>
      </div>

      <div>
        <label class="field-label">活動量</label>
        <select v-model.number="activity" class="field-input">
          <option v-for="opt in ACTIVITY" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </div>
    </div>

    <div v-if="result" class="space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <ResultStat label="每日總熱量需求 TDEE" :value="num(result.tdee, 0) + ' 大卡'" highlight hint="維持目前體重的攝取量" />
        <ResultStat label="基礎代謝率 BMR" :value="num(result.bmr, 0) + ' 大卡'" hint="完全靜止一天消耗" />
      </div>
      <div class="grid gap-4 sm:grid-cols-3">
        <ResultStat label="緩和減重" :value="num(result.loseMild, 0) + ' 大卡'" hint="約每週 −0.25 公斤" />
        <ResultStat label="積極減重" :value="num(result.lose, 0) + ' 大卡'" hint="約每週 −0.5 公斤" />
        <ResultStat label="增重/增肌" :value="num(result.gain, 0) + ' 大卡'" hint="約每週 +0.25 公斤" />
      </div>

      <LegalNote title="計算依據與提醒">
        <p>
          採 <strong>Mifflin-St Jeor 公式</strong>:BMR = 10×體重(kg) + 6.25×身高(cm) − 5×年齡 +（男 +5 / 女 −161);TDEE = BMR × 活動係數。
        </p>
        <p>減重以每日減少約 500 大卡、每週約 0.5 公斤為較安全的速度;不建議長期低於 BMR 攝取。</p>
        <p class="text-ink-500">
          這是公式估算,個人代謝、肌肉量、健康狀況差異大。有減重需求或慢性病者,請諮詢醫師或營養師,本工具僅供參考。
        </p>
      </LegalNote>
    </div>

    <div v-else class="card p-8 text-center text-ink-500">
      填入性別、年齡、身高體重與活動量,算出每日該吃多少熱量。
    </div>
  </div>
</template>
