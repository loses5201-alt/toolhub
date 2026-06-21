<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  parseBigInt,
  factorize,
  tau,
  sigma,
  eulerTotient,
  divisors,
  nextPrime,
  prevPrime,
  classifyNumber,
  formatFactorization,
  gcdMany,
  lcmMany,
  groupDigits,
} from '@/features/numberTheory'

/*
  數論工具箱 —— 質因數分解、質數判定、因數、歐拉函數、GCD/LCM,全程 BigInt 精確計算。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

// ── 單一整數分析 ──
const input = ref('360')
const n = computed(() => parseBigInt(input.value))

const analysis = computed(() => {
  const v = n.value
  if (v === null) return null
  if (v < 2n) {
    return {
      value: v,
      prime: false,
      factors: [] as { prime: bigint; exp: number }[],
      factorStr: '',
      tau: v === 1n ? 1n : 0n,
      sigma: v === 1n ? 1n : 0n,
      phi: v === 1n ? 1n : 0n,
      divisors: v === 1n ? [1n] : [],
      divTruncated: false,
      cls: v === 1n ? 'deficient' : null,
      next: nextPrime(v),
      prev: prevPrime(v),
    }
  }
  const factors = factorize(v)
  const prime = factors.length === 1 && factors[0].exp === 1
  const div = divisors(factors)
  return {
    value: v,
    prime,
    factors,
    factorStr: formatFactorization(factors),
    tau: tau(factors),
    sigma: sigma(factors),
    phi: eulerTotient(v, factors),
    divisors: div.divisors,
    divTruncated: div.truncated,
    cls: classifyNumber(v, factors),
    next: nextPrime(v),
    prev: prevPrime(v),
  }
})

const clsLabel: Record<string, string> = {
  deficient: '虧數(真因數和 < 本身)',
  perfect: '完美數(真因數和 = 本身)',
  abundant: '盈數(真因數和 > 本身)',
}

// ── GCD / LCM(多個數)──
const multiInput = ref('24, 36, 60')
const multiResult = computed(() => {
  const parts = multiInput.value.split(/[,\s、]+/).filter(Boolean)
  const nums: bigint[] = []
  for (const p of parts) {
    const v = parseBigInt(p)
    if (v === null || v < 1n) return null
    nums.push(v)
  }
  if (nums.length < 2) return null
  return { nums, gcd: gcdMany(nums), lcm: lcmMany(nums) }
})

const g = (v: bigint) => groupDigits(v)
</script>

<template>
  <div class="space-y-6">
    <!-- 整數分析 -->
    <div class="card p-6 space-y-5">
      <div>
        <label class="field-label" for="num">輸入一個正整數</label>
        <input
          id="num"
          v-model="input"
          inputmode="numeric"
          placeholder="例如 360"
          class="field-input w-full max-w-xs font-mono text-lg"
        />
        <p v-if="input.trim() && n === null" class="mt-1 text-sm text-red-600">請輸入非負整數(可含千分位逗號)。</p>
      </div>

      <div v-if="analysis" class="space-y-4">
        <!-- 質數判定 + 分解 -->
        <div class="rounded-xl border border-line p-4">
          <div class="text-xs text-ink-500">質因數分解</div>
          <div v-if="analysis.value < 2n" class="mt-1 text-lg text-ink-700">
            {{ analysis.value }} 不做質因數分解(質因數分解定義於 ≥ 2 的整數)。
          </div>
          <template v-else>
            <div class="mt-1 break-all text-2xl font-bold text-ink-900">
              {{ g(analysis.value) }} = {{ analysis.factorStr }}
            </div>
            <div class="mt-2">
              <span
                v-if="analysis.prime"
                class="inline-block rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800"
                >✓ 這是質數</span
              >
              <span
                v-else
                class="inline-block rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800"
                >合數(共 {{ analysis.factors.length }} 種質因數)</span
              >
            </div>
          </template>
        </div>

        <!-- 主要指標 -->
        <div v-if="analysis.value >= 1n" class="grid gap-3 sm:grid-cols-3">
          <div class="rounded-xl border border-line p-4">
            <div class="text-xs text-ink-500">因數個數 τ(n)</div>
            <div class="mt-1 break-all text-xl font-bold text-ink-900">{{ g(analysis.tau) }}</div>
          </div>
          <div class="rounded-xl border border-line p-4">
            <div class="text-xs text-ink-500">因數總和 σ(n)</div>
            <div class="mt-1 break-all text-xl font-bold text-ink-900">{{ g(analysis.sigma) }}</div>
          </div>
          <div class="rounded-xl border border-line p-4">
            <div class="text-xs text-ink-500">歐拉函數 φ(n)</div>
            <div class="mt-1 break-all text-xl font-bold text-ink-900">{{ g(analysis.phi) }}</div>
          </div>
        </div>

        <!-- 分類 + 鄰近質數 -->
        <div class="grid gap-3 sm:grid-cols-3">
          <div v-if="analysis.cls" class="rounded-xl bg-brand-50 p-4">
            <div class="text-xs text-ink-500">數的分類</div>
            <div class="mt-1 text-sm font-semibold text-ink-800">{{ clsLabel[analysis.cls] }}</div>
          </div>
          <div class="rounded-xl border border-line p-4">
            <div class="text-xs text-ink-500">上一個質數</div>
            <div class="mt-1 break-all text-lg font-semibold text-ink-700">{{ analysis.prev === null ? '—' : g(analysis.prev) }}</div>
          </div>
          <div class="rounded-xl border border-line p-4">
            <div class="text-xs text-ink-500">下一個質數</div>
            <div class="mt-1 break-all text-lg font-semibold text-ink-700">{{ g(analysis.next) }}</div>
          </div>
        </div>

        <!-- 全部因數 -->
        <div v-if="analysis.divisors.length" class="rounded-xl border border-line p-4">
          <div class="text-xs text-ink-500">
            全部正因數(共 {{ g(analysis.tau) }} 個<span v-if="analysis.divTruncated">,僅顯示前 {{ analysis.divisors.length }} 個</span>)
          </div>
          <div class="mt-2 flex flex-wrap gap-1.5">
            <span
              v-for="d in analysis.divisors"
              :key="d.toString()"
              class="rounded-md bg-ink-50 px-2 py-0.5 font-mono text-sm text-ink-700"
              >{{ g(d) }}</span
            >
          </div>
        </div>
      </div>
    </div>

    <!-- GCD / LCM -->
    <div class="card p-6 space-y-4">
      <h2 class="text-lg font-bold text-ink-900">最大公因數 / 最小公倍數</h2>
      <div>
        <label class="field-label" for="multi">輸入多個正整數(逗號或空白分隔)</label>
        <input
          id="multi"
          v-model="multiInput"
          placeholder="例如 24, 36, 60"
          class="field-input w-full max-w-md font-mono"
        />
      </div>
      <div v-if="multiResult" class="grid gap-3 sm:grid-cols-2">
        <div class="rounded-xl bg-brand-50 p-4">
          <div class="text-xs text-ink-500">最大公因數 GCD</div>
          <div class="mt-1 break-all text-2xl font-bold text-ink-900">{{ g(multiResult.gcd) }}</div>
        </div>
        <div class="rounded-xl bg-brand-50 p-4">
          <div class="text-xs text-ink-500">最小公倍數 LCM</div>
          <div class="mt-1 break-all text-2xl font-bold text-ink-900">{{ g(multiResult.lcm) }}</div>
        </div>
      </div>
      <p v-else class="text-sm text-ink-500">請至少輸入兩個 ≥ 1 的整數。</p>
    </div>

    <LegalNote title="名詞說明">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>質因數分解</strong>:把整數寫成質數連乘,例如 360 = 2³ × 3² × 5。是最大公因數、最小公倍數、約分的基礎。</li>
        <li><strong>質數判定</strong>:用 Miller–Rabin 演算法。約 3.3×10²⁴ 以下為「確定」判定,更大的數為極高機率判定。</li>
        <li><strong>τ(n)</strong> 因數個數、<strong>σ(n)</strong> 因數總和(含 1 與自己)、<strong>φ(n)</strong> 歐拉函數(1~n 中與 n 互質的個數)。</li>
        <li><strong>完美數</strong>:真因數(不含自己)總和等於本身,例如 6 = 1+2+3、28 = 1+2+4+7+14。</li>
        <li>全程以 <strong>BigInt 精確計算</strong>,可處理上百位的大數;分解極大的「大質數相乘」可能需要數秒。全程在你的瀏覽器計算,<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
