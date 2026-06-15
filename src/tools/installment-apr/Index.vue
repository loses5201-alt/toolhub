<script setup lang="ts">
import { ref, computed } from 'vue'
import ResultStat from '@/components/ResultStat.vue'
import LegalNote from '@/components/LegalNote.vue'
import { ntd, num } from '@/utils/format'

// 輸入模式:知道每月還款金額,或知道總手續費(/手續費率)
type Mode = 'monthly' | 'fee'
const mode = ref<Mode>('fee')

const principal = ref<number | null>(null) // 分期本金(商品金額)
const periods = ref<number | null>(null) // 期數(月)
const monthlyPay = ref<number | null>(null) // 每月還款(monthly 模式)
const feeRate = ref<number | null>(null) // 手續費率 %(fee 模式,佔本金)
const feeAmount = ref<number | null>(null) // 或直接輸入總手續費

/**
 * 用二分法求每月利率 i,使年金現值等於本金:
 * P = pmt × (1 − (1+i)^−n) / i
 * 隨 i 增大現值遞減,故 pmt×n > P(有手續費)時必有正解。
 */
function solveMonthlyRate(P: number, pmt: number, n: number): number {
  const total = pmt * n
  if (total <= P + 1e-6) return 0 // 無手續費,實質利率 0
  let lo = 1e-9
  let hi = 2 // 200%/月 上界,足夠涵蓋
  const pv = (i: number) => pmt * (1 - Math.pow(1 + i, -n)) / i - P
  // pv(lo) > 0, pv(hi) < 0
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2
    const v = pv(mid)
    if (Math.abs(v) < 1e-7) return mid
    if (v > 0) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

const result = computed(() => {
  const P = principal.value ?? 0
  const n = Math.round(periods.value ?? 0)
  if (P <= 0 || n <= 0) return null

  let pmt: number
  let totalFee: number
  if (mode.value === 'monthly') {
    pmt = monthlyPay.value ?? 0
    if (pmt <= 0) return null
    totalFee = pmt * n - P
  } else {
    // fee 模式:優先用手續費率,否則用總手續費金額
    if (feeRate.value != null && feeRate.value > 0) {
      totalFee = P * (feeRate.value / 100)
    } else {
      totalFee = feeAmount.value ?? 0
    }
    if (totalFee < 0) totalFee = 0
    pmt = (P + totalFee) / n
  }

  const i = solveMonthlyRate(P, pmt, n)
  const aprNominal = i * 12 * 100 // 名目年利率(月利率 ×12)
  const aprEffective = (Math.pow(1 + i, 12) - 1) * 100 // 有效年利率(月複利)
  const totalPay = pmt * n

  return {
    pmt,
    totalFee,
    totalPay,
    monthlyRate: i * 100,
    aprNominal,
    aprEffective,
    feePctOfPrincipal: P > 0 ? (totalFee / P) * 100 : 0,
  }
})

// 風險提示分級:有效年利率越高越該警惕
const riskLevel = computed(() => {
  const apr = result.value?.aprEffective ?? 0
  if (apr <= 0.5) return null
  if (apr < 8) return { color: 'text-ink-700', text: '利率不算高,但仍有成本,記得列入考量。' }
  if (apr < 15) return { color: 'text-amber-700', text: '實質利率偏高,接近一般信貸水準,評估是否真的需要分期。' }
  return { color: 'text-red-700', text: '實質利率很高!所謂「低手續費」換算下來其實很貴,建議優先考慮一次付清或其他方案。' }
})
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-5">
      <div>
        <label class="field-label">你怎麼描述這筆分期?</label>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-xl border px-4 py-2 text-sm font-medium transition"
            :class="mode === 'fee' ? 'border-brand-400 bg-brand-50 text-brand-800' : 'border-line bg-white text-ink-600'"
            @click="mode = 'fee'"
          >
            知道手續費(率)
          </button>
          <button
            type="button"
            class="rounded-xl border px-4 py-2 text-sm font-medium transition"
            :class="mode === 'monthly' ? 'border-brand-400 bg-brand-50 text-brand-800' : 'border-line bg-white text-ink-600'"
            @click="mode = 'monthly'"
          >
            知道每月還多少
          </button>
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label">分期本金(商品金額)</label>
          <input v-model.number="principal" type="number" min="0" placeholder="例:30000" class="field-input" />
        </div>
        <div>
          <label class="field-label">期數(月)</label>
          <input v-model.number="periods" type="number" min="1" step="1" placeholder="例:12" class="field-input" />
        </div>

        <template v-if="mode === 'fee'">
          <div>
            <label class="field-label">手續費率(%,佔本金)</label>
            <input v-model.number="feeRate" type="number" min="0" step="0.1" placeholder="例:5" class="field-input" />
          </div>
          <div>
            <label class="field-label">或:總手續費金額</label>
            <input v-model.number="feeAmount" type="number" min="0" placeholder="例:1500" class="field-input" />
            <p class="mt-1 text-xs text-ink-500">填了手續費率就以費率為準。</p>
          </div>
        </template>
        <template v-else>
          <div>
            <label class="field-label">每月還款金額</label>
            <input v-model.number="monthlyPay" type="number" min="0" placeholder="例:2625" class="field-input" />
          </div>
        </template>
      </div>
    </div>

    <div v-if="result" class="space-y-4">
      <div class="grid gap-4 sm:grid-cols-3">
        <ResultStat label="實質年利率(APR)" :value="num(result.aprEffective, 2) + ' %'" highlight hint="月複利換算的真實年化成本" />
        <ResultStat label="每月應繳" :value="ntd(result.pmt)" />
        <ResultStat label="總手續費" :value="ntd(result.totalFee)" :hint="'約本金的 ' + num(result.feePctOfPrincipal, 1) + ' %'" />
      </div>
      <div class="grid gap-4 sm:grid-cols-3">
        <ResultStat label="名目年利率" :value="num(result.aprNominal, 2) + ' %'" hint="月利率 ×12" />
        <ResultStat label="每月利率" :value="num(result.monthlyRate, 3) + ' %'" />
        <ResultStat label="總共要付" :value="ntd(result.totalPay)" />
      </div>

      <div
        v-if="riskLevel"
        class="rounded-2xl border border-line bg-white p-5 text-sm leading-relaxed"
        :class="riskLevel.color"
      >
        <span class="font-semibold">💡 提醒:</span>{{ riskLevel.text }}
      </div>

      <LegalNote title="為什麼「低手續費」其實不便宜?">
        <p>
          手續費看起來只佔本金一點點(例如 5%),但因為你是<strong>分期慢慢還、本金逐月減少</strong>,把它換算成「實質年利率(APR)」往往是費率的近 2 倍。
        </p>
        <p>
          例:本金 30,000、分 12 期、手續費 5%(1,500),每月還 2,625。表面 5%,但實質年利率約 <strong>9%</strong>。
        </p>
        <p class="text-ink-500">
          計算方式:把每月還款用年金現值公式回推每月利率 i,使 本金 = Σ 每月還款 ÷ (1+i)<sup>期</sup>,再年化。所謂「分期 0 利率」若另收手續費,實質仍有利率。本工具為概算,實際請以銀行/商家契約揭露之總費用年百分率為準,僅供參考。
        </p>
      </LegalNote>
    </div>

    <div v-else class="card p-8 text-center text-ink-500">
      填入分期本金、期數,以及手續費(或每月還款),即可看出真實的年利率。
    </div>
  </div>
</template>
