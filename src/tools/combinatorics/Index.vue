<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  factorial,
  permutations,
  combinations,
  permutationsWithRep,
  combinationsWithRep,
  lotteryOdds,
  groupDigits,
} from '@/features/combinatorics'

/*
  排列組合 / 機率計算 —— 全部以 BigInt 精確計算,不會因階乘過大而失準。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

const n = ref(49)
const r = ref(6)

function show(v: bigint | null): string {
  return v === null ? '—' : groupDigits(v)
}

const results = computed(() => {
  const valid = Number.isInteger(n.value) && Number.isInteger(r.value) && n.value >= 0 && r.value >= 0
  if (!valid) return null
  return {
    factN: factorial(n.value),
    factR: factorial(r.value),
    perm: permutations(n.value, r.value),
    comb: combinations(n.value, r.value),
    permRep: permutationsWithRep(n.value, r.value),
    combRep: combinationsWithRep(n.value, r.value),
  }
})

// 樂透
const lotteries: { name: string; pool: number; pick: number }[] = [
  { name: '大樂透(49 選 6)', pool: 49, pick: 6 },
  { name: '威力彩第一區(38 選 6)', pool: 38, pick: 6 },
  { name: '今彩 539(39 選 5)', pool: 39, pick: 5 },
]
const lotteryPool = ref(49)
const lotteryPick = ref(6)
const odds = computed(() => lotteryOdds(lotteryPool.value, lotteryPick.value))
function applyLottery(l: { pool: number; pick: number }) {
  lotteryPool.value = l.pool
  lotteryPick.value = l.pick
}
</script>

<template>
  <div class="space-y-6">
    <!-- 排列組合 -->
    <div class="card p-6 space-y-5">
      <div class="flex flex-wrap items-end gap-4">
        <div>
          <label class="field-label" for="n">總數 n</label>
          <input id="n" v-model.number="n" type="number" min="0" step="1" class="field-input w-28 font-mono text-lg" />
        </div>
        <div>
          <label class="field-label" for="r">取出 r</label>
          <input id="r" v-model.number="r" type="number" min="0" step="1" class="field-input w-28 font-mono text-lg" />
        </div>
      </div>

      <div v-if="results" class="grid gap-3 sm:grid-cols-2">
        <div class="rounded-xl border border-line p-4">
          <div class="text-xs text-ink-500">組合 C(n, r) — 不計順序</div>
          <div class="mt-1 break-all text-2xl font-bold text-ink-900">{{ show(results.comb) }}</div>
        </div>
        <div class="rounded-xl border border-line p-4">
          <div class="text-xs text-ink-500">排列 P(n, r) — 計順序</div>
          <div class="mt-1 break-all text-2xl font-bold text-ink-900">{{ show(results.perm) }}</div>
        </div>
        <div class="rounded-xl border border-line p-4">
          <div class="text-xs text-ink-500">可重複組合 C(n+r−1, r)</div>
          <div class="mt-1 break-all text-lg font-semibold text-ink-700">{{ show(results.combRep) }}</div>
        </div>
        <div class="rounded-xl border border-line p-4">
          <div class="text-xs text-ink-500">可重複排列 nʳ</div>
          <div class="mt-1 break-all text-lg font-semibold text-ink-700">{{ show(results.permRep) }}</div>
        </div>
        <div class="rounded-xl border border-line p-4">
          <div class="text-xs text-ink-500">n!</div>
          <div class="mt-1 break-all text-base font-mono text-ink-600">{{ show(results.factN) }}</div>
        </div>
        <div class="rounded-xl border border-line p-4">
          <div class="text-xs text-ink-500">r!</div>
          <div class="mt-1 break-all text-base font-mono text-ink-600">{{ show(results.factR) }}</div>
        </div>
      </div>
      <p v-else class="rounded-xl bg-red-50 p-4 text-sm text-red-700">請輸入非負整數。</p>
    </div>

    <!-- 樂透機率 -->
    <div class="card p-6 space-y-4">
      <h2 class="text-lg font-semibold text-ink-900">樂透中頭獎機率</h2>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="l in lotteries"
          :key="l.name"
          type="button"
          class="rounded-xl border border-line px-3 py-1.5 text-sm text-ink-700 transition hover:border-brand-300"
          :class="{ 'border-brand-400 bg-brand-50': lotteryPool === l.pool && lotteryPick === l.pick }"
          @click="applyLottery(l)"
        >
          {{ l.name }}
        </button>
      </div>
      <div class="flex flex-wrap items-end gap-4">
        <div>
          <label class="field-label" for="pool">號碼總數</label>
          <input id="pool" v-model.number="lotteryPool" type="number" min="1" step="1" class="field-input w-28 font-mono" />
        </div>
        <div>
          <label class="field-label" for="pick">選幾個</label>
          <input id="pick" v-model.number="lotteryPick" type="number" min="1" step="1" class="field-input w-28 font-mono" />
        </div>
      </div>
      <div v-if="odds" class="rounded-xl bg-brand-50 p-5">
        <div class="text-3xl font-black text-ink-900">{{ odds.oddsText }}</div>
        <div class="mt-1 text-ink-600">中獎機率約 {{ odds.percent }}(共 {{ groupDigits(odds.total) }} 種組合)</div>
      </div>
      <p v-else class="rounded-xl bg-red-50 p-4 text-sm text-red-700">「選幾個」不可大於號碼總數。</p>
    </div>

    <LegalNote title="排列與組合差在哪?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>組合 C(n, r)</strong>:從 n 個取 r 個,<strong>不管順序</strong>(像樂透選號、抽人分組)。</li>
        <li><strong>排列 P(n, r)</strong>:從 n 個取 r 個,<strong>要算順序</strong>(像跑步前三名、密碼排序)。</li>
        <li><strong>可重複</strong>:同一個可以選多次 —— 可重複排列 = nʳ(像 4 位數密碼 10⁴);可重複組合 = C(n+r−1, r)(像買 3 個可重複口味的甜甜圈)。</li>
        <li>本工具以 <strong>BigInt 精確計算</strong>,連 100! 這種大數也不會失準(一般計算機算到約 170! 就溢位)。</li>
        <li>樂透機率是「1 ÷ 所有可能組合數」;例如大樂透 49 選 6 共 13,983,816 種,中頭獎機率約 0.0000072%。全程在你的瀏覽器計算,<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
