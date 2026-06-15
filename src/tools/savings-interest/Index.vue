<script setup lang="ts">
import { ref, computed } from 'vue'
import ResultStat from '@/components/ResultStat.vue'
import LegalNote from '@/components/LegalNote.vue'
import { ntd } from '@/utils/format'

const principal = ref<number | null>(null)
const annualRate = ref<number | null>(null)
const years = ref<number | null>(null)
const perYear = ref<number>(1) // 每年複利次數

const result = computed(() => {
  const P = principal.value ?? 0
  const r = (annualRate.value ?? 0) / 100
  const t = years.value ?? 0
  const n = perYear.value || 1
  if (P <= 0 || t <= 0) return null
  const amount = P * Math.pow(1 + r / n, n * t)
  const simple = P * (1 + r * t) // 單利對照
  return { amount, interest: amount - P, simple, simpleInterest: simple - P }
})
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-5">
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label">本金</label>
          <input v-model.number="principal" type="number" min="0" placeholder="例:500000" class="field-input" />
        </div>
        <div>
          <label class="field-label">年利率(%)</label>
          <input v-model.number="annualRate" type="number" min="0" step="0.01" placeholder="例:1.6" class="field-input" />
        </div>
        <div>
          <label class="field-label">存款年數</label>
          <input v-model.number="years" type="number" min="0" step="0.5" placeholder="例:3" class="field-input" />
        </div>
        <div>
          <label class="field-label">複利方式</label>
          <select v-model.number="perYear" class="field-input">
            <option :value="1">每年一次</option>
            <option :value="2">每半年</option>
            <option :value="4">每季</option>
            <option :value="12">每月</option>
          </select>
        </div>
      </div>
    </div>

    <div v-if="result" class="space-y-4">
      <div class="grid gap-4 sm:grid-cols-3">
        <ResultStat label="到期本利和(複利)" :value="ntd(result.amount)" highlight />
        <ResultStat label="複利利息" :value="ntd(result.interest)" />
        <ResultStat label="若用單利利息" :value="ntd(result.simpleInterest)" hint="複利通常較多" />
      </div>

      <LegalNote title="說明">
        <p>複利:A = 本金 ×(1 + 年利率 ÷ 複利次數)<sup>複利次數 × 年數</sup>。</p>
        <p class="text-ink-500">
          實際銀行定存多採「機動/固定利率、按月或到期計息」,並可能扣繳利息所得稅與二代健保補充保費(單筆達門檻時)。本工具為理想化概算。
        </p>
      </LegalNote>
    </div>

    <div v-else class="card p-8 text-center text-ink-500">輸入本金、年利率與年數,即可試算。</div>
  </div>
</template>
