<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  parseFraction,
  simplify,
  fractionToDecimalString,
  toMixed,
  toPercent,
  approxFraction,
  type Frac,
} from '@/features/fraction'

/*
  分數 / 小數 / 百分比互轉 —— 約分、帶分數、循環小數精確互轉、浮點數近似分數。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

// ── 分數 / 帶分數 / 小數 → 各種形式 ──
const input = ref('0.1(6)')
const frac = computed<Frac | null>(() => parseFraction(input.value))

const result = computed(() => {
  if (!frac.value) return null
  const f = simplify(frac.value.n, frac.value.d)
  const mixed = toMixed(f)
  return {
    simplest: f,
    decimal: fractionToDecimalString(f),
    approx: (f.n / f.d).toPrecision(10).replace(/\.?0+$/, ''),
    mixed,
    percent: toPercent(f),
  }
})

function mixedText(m: { whole: number; n: number; d: number }): string {
  if (m.n === 0) return String(m.whole)
  if (m.whole === 0) return `${m.n}/${m.d}`
  return `${m.whole} 又 ${m.n}/${m.d}`
}

const examples = ['0.1(6)', '0.(142857)', '3/4', '1 1/2', '22/7', '0.625', '0.(3)']

// ── 浮點數 → 近似分數 ──
const approxInput = ref('3.14159265')
const maxDenom = ref(1000)
const approxResult = computed(() => {
  const x = Number(approxInput.value)
  if (!Number.isFinite(x)) return null
  const f = approxFraction(x, maxDenom.value)
  return { f, error: Math.abs(f.n / f.d - x), decimal: f.n / f.d }
})

const copied = ref('')
async function copy(t: string) {
  try {
    await navigator.clipboard.writeText(t)
    copied.value = t
    setTimeout(() => (copied.value = ''), 1200)
  } catch {
    /* 忽略 */
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- 主轉換 -->
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label" for="in">輸入分數、帶分數或小數</label>
        <input id="in" v-model="input" type="text" class="field-input font-mono text-lg" placeholder="例:3/4、1 1/2、0.1(6)" />
        <p class="mt-1 text-xs text-ink-500">
          循環小數請把循環節用括號括起來,例如 <code>0.1(6)</code> 代表 0.1666…、<code>0.(3)</code> 代表 0.333…
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="ex in examples"
          :key="ex"
          type="button"
          class="rounded-lg border border-line px-3 py-1 font-mono text-sm text-ink-700 transition hover:border-brand-300"
          @click="input = ex"
        >
          {{ ex }}
        </button>
      </div>

      <div v-if="result" class="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          class="rounded-xl border border-line p-4 text-left transition hover:border-brand-300"
          @click="copy(`${result.simplest.n}/${result.simplest.d}`)"
        >
          <div class="text-xs text-ink-500">最簡分數</div>
          <div class="mt-1 text-2xl font-bold text-ink-900">
            {{ result.simplest.d === 1 ? result.simplest.n : `${result.simplest.n}/${result.simplest.d}` }}
          </div>
        </button>
        <div class="rounded-xl border border-line p-4">
          <div class="text-xs text-ink-500">帶分數</div>
          <div class="mt-1 text-2xl font-bold text-ink-700">{{ mixedText(result.mixed) }}</div>
        </div>
        <button
          type="button"
          class="rounded-xl border border-line p-4 text-left transition hover:border-brand-300"
          @click="copy(result.decimal)"
        >
          <div class="text-xs text-ink-500">小數(循環節以括號標示)</div>
          <div class="mt-1 text-2xl font-bold text-ink-700">{{ result.decimal }}</div>
        </button>
        <div class="rounded-xl border border-line p-4">
          <div class="text-xs text-ink-500">百分比</div>
          <div class="mt-1 text-2xl font-bold text-ink-700">{{ parseFloat(result.percent.toPrecision(8)) }}%</div>
        </div>
      </div>
      <p v-else class="rounded-xl bg-red-50 p-4 text-sm text-red-700">
        看不懂這個輸入。可填 3/4、1 1/2、5、0.75,或循環小數 0.(3)、0.1(6)。
      </p>
      <p v-if="copied" class="text-sm text-green-600">已複製 {{ copied }} ✓</p>
    </div>

    <!-- 浮點數近似分數 -->
    <div class="card p-6 space-y-4">
      <h2 class="text-lg font-semibold text-ink-900">小數 → 近似分數(連分數)</h2>
      <p class="text-sm text-ink-500">把任意小數(可能不是整齊循環,如量測值、π)近似成「分母不超過上限」的最簡分數。</p>
      <div class="flex flex-wrap items-end gap-3">
        <div>
          <label class="field-label" for="ax">小數</label>
          <input id="ax" v-model="approxInput" type="text" class="field-input w-44 font-mono" />
        </div>
        <div>
          <label class="field-label" for="md">最大分母</label>
          <input id="md" v-model.number="maxDenom" type="number" min="1" step="1" class="field-input w-32 font-mono" />
        </div>
      </div>
      <div v-if="approxResult" class="rounded-xl bg-brand-50 p-5">
        <div class="text-2xl font-black text-ink-900">
          ≈ {{ approxResult.f.d === 1 ? approxResult.f.n : `${approxResult.f.n}/${approxResult.f.d}` }}
        </div>
        <div class="mt-1 text-sm text-ink-600">
          = {{ parseFloat(approxResult.decimal.toPrecision(10)) }} ,誤差 {{ approxResult.error.toExponential(2) }}
        </div>
      </div>
      <p v-else class="text-sm text-red-600">請輸入有效的小數。</p>
    </div>

    <LegalNote title="關於分數 / 循環小數換算">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>約分</strong>用輾轉相除法求最大公因數,分母固定為正、負號放在分子。</li>
        <li><strong>循環小數 → 分數是精確的</strong>:用代數消去循環節(例如 0.1(6) = 1/6),不是近似。輸入時務必把循環的數字用括號標出。</li>
        <li><strong>分數 → 小數</strong>用長除法,會自動偵測循環節並以括號標示;終止小數則直接顯示。</li>
        <li>下方「近似分數」用<strong>連分數</strong>找出分母在上限內最接近的分數,適合處理量測值或無理數(如 π ≈ 355/113)。</li>
        <li>注意 0.(9) 在數學上恰等於 1,屬正常結果。全程在你的瀏覽器計算,<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
