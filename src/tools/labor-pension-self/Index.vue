<script setup lang="ts">
import { ref, computed } from 'vue'
import ResultStat from '@/components/ResultStat.vue'
import LegalNote from '@/components/LegalNote.vue'
import { ntd } from '@/utils/format'

const monthlyWage = ref<number | null>(null) // 月提繳工資
const rate = ref<number>(6) // 自提率 %(上限 6)
const taxRate = ref<number>(5) // 邊際稅率 %

const monthlySelf = computed(() => {
  const w = monthlyWage.value ?? 0
  const r = Math.min(Math.max(rate.value, 0), 6) / 100
  return w * r
})
const yearlySelf = computed(() => monthlySelf.value * 12)
const taxSaved = computed(() => yearlySelf.value * (taxRate.value / 100))

const hasInput = computed(() => (monthlyWage.value ?? 0) > 0)
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-5">
      <div>
        <label class="field-label">月提繳工資</label>
        <input v-model.number="monthlyWage" type="number" min="0" placeholder="例:45800" class="field-input" />
        <p class="field-hint">即勞退提繳工資分級表對應的金額,上限為 150,000 元。</p>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label">自願提繳率:{{ rate }}%</label>
          <input v-model.number="rate" type="range" min="0" max="6" step="1" class="w-full accent-brand-600" />
          <p class="field-hint">法定上限 6%。</p>
        </div>
        <div>
          <label class="field-label">你的綜所稅邊際稅率</label>
          <select v-model.number="taxRate" class="field-input">
            <option :value="5">5%</option>
            <option :value="12">12%</option>
            <option :value="20">20%</option>
            <option :value="30">30%</option>
            <option :value="40">40%</option>
          </select>
        </div>
      </div>
    </div>

    <div v-if="hasInput" class="space-y-4">
      <div class="grid gap-4 sm:grid-cols-3">
        <ResultStat label="每月自提" :value="ntd(monthlySelf)" />
        <ResultStat label="一年自提" :value="ntd(yearlySelf)" />
        <ResultStat label="預估年省稅" :value="ntd(taxSaved)" highlight />
      </div>

      <LegalNote title="勞退自願提繳說明">
        <p>
          依《勞工退休金條例》,勞工每月可在工資 <strong>6% 範圍內</strong>自願提繳,這筆金額
          <strong>不計入當年度綜合所得總額</strong>,等於用邊際稅率省下相應的所得稅。
        </p>
        <p>自提金額進入個人專戶,退休或符合條件時領取(領取時另有課稅規定)。</p>
        <p class="text-ink-500">節稅金額為概算,實際視你的整體所得與適用稅率而定。</p>
      </LegalNote>
    </div>

    <div v-else class="card p-8 text-center text-ink-500">
      輸入月提繳工資並選擇自提率,即可看到自提金額與節稅效果。
    </div>
  </div>
</template>
