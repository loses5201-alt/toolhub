<script setup lang="ts">
import { ref, computed } from 'vue'
import ResultStat from '@/components/ResultStat.vue'
import LegalNote from '@/components/LegalNote.vue'
import { ntd, num } from '@/utils/format'

// 113 年度(2024 所得,2025 年 5 月申報)綜所稅累進級距與速算扣除額
const BRACKETS = [
  { upTo: 590000, rate: 0.05, deduct: 0 },
  { upTo: 1330000, rate: 0.12, deduct: 41300 },
  { upTo: 2660000, rate: 0.2, deduct: 147700 },
  { upTo: 4980000, rate: 0.3, deduct: 413700 },
  { upTo: Infinity, rate: 0.4, deduct: 911700 },
]

const net = ref<number | null>(null)

const bracket = computed(() => {
  const n = net.value ?? 0
  return BRACKETS.find((b) => n <= b.upTo) ?? BRACKETS[BRACKETS.length - 1]
})
const tax = computed(() => {
  const n = net.value ?? 0
  return Math.max(0, n * bracket.value.rate - bracket.value.deduct)
})
const effectiveRate = computed(() => {
  const n = net.value ?? 0
  return n > 0 ? (tax.value / n) * 100 : 0
})
const hasInput = computed(() => (net.value ?? 0) > 0)
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6">
      <label class="field-label">綜合所得淨額</label>
      <input v-model.number="net" type="number" min="0" placeholder="例:1000000" class="field-input" />
      <p class="field-hint">
        淨額 = 所得總額 − 免稅額 − 一般扣除額(標準或列舉) − 特別扣除額 − 基本生活費差額。
      </p>
    </div>

    <div v-if="hasInput" class="space-y-4">
      <div class="grid gap-4 sm:grid-cols-3">
        <ResultStat label="應納所得稅" :value="ntd(tax)" highlight />
        <ResultStat label="適用邊際稅率" :value="`${bracket.rate * 100}%`" />
        <ResultStat label="有效稅率" :value="`${num(effectiveRate, 2)}%`" hint="實繳稅額 ÷ 淨額" />
      </div>

      <div class="card p-5">
        <div class="mb-3 font-semibold text-ink-900">速算公式</div>
        <p class="text-sm text-ink-700">
          應納稅額 = 淨額 {{ ntd(net ?? 0) }} × {{ bracket.rate * 100 }}% −
          速算扣除額 {{ ntd(bracket.deduct) }} = <strong>{{ ntd(tax) }}</strong>
        </p>
      </div>

      <LegalNote title="113 年度綜所稅級距(2024 所得 / 2025 申報)">
        <ul class="list-disc pl-5 space-y-0.5">
          <li>0 ~ 590,000:稅率 5%,速算扣除額 0</li>
          <li>590,001 ~ 1,330,000:12%,扣除額 41,300</li>
          <li>1,330,001 ~ 2,660,000:20%,扣除額 147,700</li>
          <li>2,660,001 ~ 4,980,000:30%,扣除額 413,700</li>
          <li>4,980,001 以上:40%,扣除額 911,700</li>
        </ul>
        <p class="text-ink-500">
          級距金額每年會依物價指數調整,本表為 113 年度;最新數字與基本所得額(最低稅負)等請以財政部公告為準。本工具僅供概算。
        </p>
      </LegalNote>
    </div>

    <div v-else class="card p-8 text-center text-ink-500">
      輸入綜合所得淨額,即可算出應納所得稅。
    </div>
  </div>
</template>
