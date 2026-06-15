<script setup lang="ts">
import { ref, computed } from 'vue'
import ResultStat from '@/components/ResultStat.vue'
import LegalNote from '@/components/LegalNote.vue'
import { num } from '@/utils/format'

const height = ref<number | null>(null) // 公分
const weight = ref<number | null>(null) // 公斤

const bmi = computed(() => {
  const h = (height.value ?? 0) / 100
  const w = weight.value ?? 0
  return h > 0 ? w / (h * h) : 0
})

// 衛福部國健署成人體位分級
const category = computed(() => {
  const b = bmi.value
  if (b <= 0) return { label: '—', klass: 'text-ink-500' }
  if (b < 18.5) return { label: '體重過輕', klass: 'text-amber-600' }
  if (b < 24) return { label: '健康體位', klass: 'text-brand-700' }
  if (b < 27) return { label: '體重過重', klass: 'text-amber-600' }
  if (b < 30) return { label: '輕度肥胖', klass: 'text-accent' }
  if (b < 35) return { label: '中度肥胖', klass: 'text-red-600' }
  return { label: '重度肥胖', klass: 'text-red-700' }
})

// 健康體位(18.5 ≤ BMI < 24)對應的體重範圍
const idealRange = computed(() => {
  const h = (height.value ?? 0) / 100
  if (h <= 0) return null
  return { min: 18.5 * h * h, max: 24 * h * h }
})

const hasInput = computed(() => (height.value ?? 0) > 0 && (weight.value ?? 0) > 0)
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 grid gap-4 sm:grid-cols-2">
      <div>
        <label class="field-label">身高(公分)</label>
        <input v-model.number="height" type="number" min="0" placeholder="例:170" class="field-input" />
      </div>
      <div>
        <label class="field-label">體重(公斤)</label>
        <input v-model.number="weight" type="number" min="0" placeholder="例:65" class="field-input" />
      </div>
    </div>

    <div v-if="hasInput" class="space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <ResultStat label="你的 BMI" :value="num(bmi, 1)" highlight />
        <div class="rounded-2xl border border-line bg-white p-5 text-center">
          <div class="text-sm font-medium text-ink-500">體位分級</div>
          <div class="mt-1 text-3xl font-black" :class="category.klass">{{ category.label }}</div>
        </div>
      </div>

      <div v-if="idealRange" class="card p-5 text-center">
        <span class="text-ink-600">你的健康體重範圍約為 </span>
        <strong class="text-brand-700">{{ num(idealRange.min, 1) }} ~ {{ num(idealRange.max, 1) }} 公斤</strong>
      </div>

      <LegalNote title="衛福部國健署 成人體位分級">
        <ul class="list-disc pl-5 space-y-0.5">
          <li>過輕:BMI &lt; 18.5</li>
          <li>健康:18.5 ≤ BMI &lt; 24</li>
          <li>過重:24 ≤ BMI &lt; 27</li>
          <li>輕/中/重度肥胖:27 以上 / 30 以上 / 35 以上</li>
        </ul>
        <p class="text-ink-500">BMI 不適用於孕婦、未滿 18 歲、運動員等族群,僅供一般成人健康參考。</p>
      </LegalNote>
    </div>

    <div v-else class="card p-8 text-center text-ink-500">輸入身高與體重,即可計算 BMI。</div>
  </div>
</template>
