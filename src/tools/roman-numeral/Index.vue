<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { toRoman, fromRoman, ROMAN_MIN, ROMAN_MAX } from '@/features/roman'

/*
  羅馬數字轉換 —— 阿拉伯數字(1–3999)↔ 標準羅馬數字。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

type Mode = 'toRoman' | 'fromRoman'
const mode = ref<Mode>('toRoman')

const numInput = ref('2024')
const romanInput = ref('MMXXIV')

const toRomanResult = computed(() => {
  const n = Number(numInput.value)
  if (numInput.value.trim() === '') return null
  if (!Number.isFinite(n)) return { ok: false, error: '請輸入數字。' }
  return toRoman(n)
})

const fromRomanResult = computed(() => {
  if (romanInput.value.trim() === '') return null
  return fromRoman(romanInput.value)
})

async function copy(text?: string) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* 忽略 */
  }
}

const examples = [
  { n: 4, r: 'IV' },
  { n: 49, r: 'XLIX' },
  { n: 2024, r: 'MMXXIV' },
  { n: 1994, r: 'MCMXCIV' },
  { n: 3888, r: 'MMMDCCCLXXXVIII' },
]
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="m in (['toRoman', 'fromRoman'] as Mode[])"
          :key="m"
          type="button"
          class="rounded-lg border px-3 py-1.5 text-sm transition"
          :class="
            mode === m
              ? 'border-brand-500 bg-brand-600 text-white'
              : 'border-ink-200 text-ink-600 hover:bg-ink-50'
          "
          @click="mode = m"
        >
          {{ m === 'toRoman' ? '數字 → 羅馬' : '羅馬 → 數字' }}
        </button>
      </div>

      <!-- 數字 → 羅馬 -->
      <template v-if="mode === 'toRoman'">
        <div>
          <label class="field-label">阿拉伯數字({{ ROMAN_MIN }}–{{ ROMAN_MAX }})</label>
          <input
            v-model="numInput"
            type="number"
            class="field-input font-mono text-lg"
            placeholder="2024"
          />
        </div>
        <div
          v-if="toRomanResult && !toRomanResult.ok"
          class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800"
        >
          ⚠️ {{ toRomanResult.error }}
        </div>
        <button
          v-else-if="toRomanResult && toRomanResult.ok"
          type="button"
          class="block w-full rounded-lg bg-ink-50 px-4 py-4 text-center transition hover:bg-ink-100"
          title="點一下複製"
          @click="copy(toRomanResult.value)"
        >
          <div class="font-mono text-4xl font-bold tracking-wider text-ink-800">{{ toRomanResult.value }}</div>
          <div class="mt-1 text-xs text-ink-400">點一下複製</div>
        </button>
      </template>

      <!-- 羅馬 → 數字 -->
      <template v-else>
        <div>
          <label class="field-label">羅馬數字</label>
          <input
            v-model="romanInput"
            class="field-input font-mono text-lg uppercase"
            placeholder="MMXXIV"
            spellcheck="false"
            autocomplete="off"
          />
        </div>
        <div
          v-if="fromRomanResult && !fromRomanResult.ok"
          class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800"
        >
          ⚠️ {{ fromRomanResult.error }}
        </div>
        <button
          v-else-if="fromRomanResult && fromRomanResult.ok"
          type="button"
          class="block w-full rounded-lg bg-ink-50 px-4 py-4 text-center transition hover:bg-ink-100"
          title="點一下複製"
          @click="copy(String(fromRomanResult.value))"
        >
          <div class="font-mono text-4xl font-bold text-ink-800">{{ fromRomanResult.value }}</div>
          <div class="mt-1 text-xs text-ink-400">點一下複製</div>
        </button>
      </template>

      <div class="flex flex-wrap gap-1.5 pt-1">
        <button
          v-for="ex in examples"
          :key="ex.n"
          type="button"
          class="rounded-md border border-ink-200 px-2 py-1 font-mono text-xs text-ink-500 transition hover:bg-ink-50"
          @click="mode === 'toRoman' ? (numInput = String(ex.n)) : (romanInput = ex.r)"
        >
          {{ mode === 'toRoman' ? ex.n : ex.r }}
        </button>
      </div>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>讀懂時鐘、書本章節、電影/賽事年份、版權年(如 <strong>MMXXIV = 2024</strong>)、大綱編號的羅馬數字。</li>
        <li>採<strong>標準減法記號</strong>:4 = IV、9 = IX、40 = XL、90 = XC、400 = CD、900 = CM。</li>
        <li>解析時<strong>嚴格驗證</strong>:像 <code>IIII</code>、<code>VV</code>、<code>IC</code> 這類非規範寫法會被擋下並提示正確寫法。</li>
        <li>標準羅馬數字範圍為 <strong>{{ ROMAN_MIN }}–{{ ROMAN_MAX }}</strong>(更大的數需要上劃線等延伸記法,本工具不處理)。</li>
        <li>全程<strong>在你的瀏覽器</strong>計算,<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
