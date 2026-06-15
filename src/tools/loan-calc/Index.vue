<script setup lang="ts">
import { ref, computed } from 'vue'
import ResultStat from '@/components/ResultStat.vue'
import LegalNote from '@/components/LegalNote.vue'
import { ntd } from '@/utils/format'

const amount = ref<number | null>(null) // 貸款金額
const annualRate = ref<number | null>(null) // 年利率 %
const years = ref<number | null>(null) // 貸款年數
const graceMonths = ref<number | null>(null) // 寬限期(月)
const method = ref<'equal-payment' | 'equal-principal'>('equal-payment')

interface Result {
  firstPayment: number // 首期應繳
  monthlyPayment: number // 本息均攤的固定月付(本金均攤為首期)
  totalInterest: number
  totalPayment: number
}

const result = computed<Result | null>(() => {
  const P = amount.value ?? 0
  const n = (years.value ?? 0) * 12
  const r = (annualRate.value ?? 0) / 100 / 12
  const g = Math.min(graceMonths.value ?? 0, n)
  if (P <= 0 || n <= 0) return null

  let totalInterest = 0
  let balance = P
  let first = 0
  let fixed = 0

  // 寬限期:只繳息
  for (let i = 0; i < g; i++) {
    const interest = balance * r
    totalInterest += interest
    if (i === 0) first = interest
  }

  const payMonths = n - g
  if (method.value === 'equal-payment') {
    // 本息均攤:固定月付
    fixed = r > 0 ? (balance * r) / (1 - Math.pow(1 + r, -payMonths)) : balance / payMonths
    for (let i = 0; i < payMonths; i++) {
      const interest = balance * r
      totalInterest += interest
      balance -= fixed - interest
    }
    if (g === 0) first = fixed
  } else {
    // 本金均攤:每月本金固定,利息遞減
    const principalPart = balance / payMonths
    for (let i = 0; i < payMonths; i++) {
      const interest = balance * r
      totalInterest += interest
      if (i === 0 && g === 0) first = principalPart + interest
      balance -= principalPart
    }
    if (g === 0 && first === 0) first = principalPart
  }

  return {
    firstPayment: first,
    monthlyPayment: fixed,
    totalInterest,
    totalPayment: P + totalInterest,
  }
})
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-5">
      <div>
        <label class="field-label">還款方式</label>
        <div class="flex gap-2">
          <button
            class="flex-1 rounded-xl border px-4 py-2.5 font-medium transition"
            :class="method === 'equal-payment' ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-700'"
            @click="method = 'equal-payment'"
          >
            本息均攤(月付固定)
          </button>
          <button
            class="flex-1 rounded-xl border px-4 py-2.5 font-medium transition"
            :class="method === 'equal-principal' ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-700'"
            @click="method = 'equal-principal'"
          >
            本金均攤(月付遞減)
          </button>
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label">貸款金額</label>
          <input v-model.number="amount" type="number" min="0" placeholder="例:8000000" class="field-input" />
        </div>
        <div>
          <label class="field-label">年利率(%)</label>
          <input v-model.number="annualRate" type="number" min="0" step="0.01" placeholder="例:2.1" class="field-input" />
        </div>
        <div>
          <label class="field-label">貸款年數</label>
          <input v-model.number="years" type="number" min="1" placeholder="例:20" class="field-input" />
        </div>
        <div>
          <label class="field-label">寬限期(月,選填)</label>
          <input v-model.number="graceMonths" type="number" min="0" placeholder="例:0" class="field-input" />
          <p class="field-hint">寬限期內只繳利息、不還本金。</p>
        </div>
      </div>
    </div>

    <div v-if="result" class="space-y-4">
      <div class="grid gap-4 sm:grid-cols-3">
        <ResultStat
          :label="method === 'equal-payment' ? '每月應繳' : '首期應繳(逐月遞減)'"
          :value="ntd(method === 'equal-payment' && (graceMonths ?? 0) === 0 ? result.monthlyPayment : result.firstPayment)"
          highlight
        />
        <ResultStat label="總利息" :value="ntd(result.totalInterest)" />
        <ResultStat label="本利合計" :value="ntd(result.totalPayment)" />
      </div>

      <LegalNote title="試算說明">
        <p><strong>本息均攤</strong>:每月還款金額固定,前期還的利息多、本金少。</p>
        <p><strong>本金均攤</strong>:每月還的本金固定,利息逐月遞減,總利息較少但前期負擔重。</p>
        <p class="text-ink-500">
          實際利率多為機動利率,且銀行可能有最低還款、手續費等規定。本工具以固定利率概算,實際以銀行核貸為準。
        </p>
      </LegalNote>
    </div>

    <div v-else class="card p-8 text-center text-ink-500">
      輸入貸款金額、年利率與年數,即可試算每月應繳與總利息。
    </div>
  </div>
</template>
