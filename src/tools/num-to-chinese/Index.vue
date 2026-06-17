<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { amountToChinese, chineseToNumber } from '@/features/amountChinese'

/*
  金額大寫互轉 —— 阿拉伯數字 → 中文大寫(壹貳參…元角分整,支票/合約防竄改);
  以及反向中文數字 → 阿拉伯數字(核對大寫金額、讀老文件)。全程瀏覽器,不上傳。
*/
type Mode = 'toCN' | 'toNum'
const mode = ref<Mode>('toCN')
const input = ref('')

const result = computed(() => (mode.value === 'toCN' && input.value.trim() ? amountToChinese(input.value) : null))
const parsed = computed(() => (mode.value === 'toNum' && input.value.trim() ? chineseToNumber(input.value) : null))
const parsedDisplay = computed(() => {
  if (!parsed.value || !parsed.value.ok) return ''
  return parsed.value.value.toLocaleString('en-US', { maximumFractionDigits: 6 })
})

const copied = ref<string | null>(null)
function copy(text: string, tag: string) {
  navigator.clipboard?.writeText(text)
  copied.value = tag
  setTimeout(() => (copied.value = null), 1500)
}
function switchMode(m: Mode) {
  if (m === mode.value) return
  mode.value = m
  input.value = ''
}

const examples = ['38500', '1234.56', '1000000', '100.05']
const cnExamples = ['壹佰貳拾參萬肆仟', '一百二十三', '兩千零五十', '三點一四']
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <!-- 模式切換 -->
      <div class="grid grid-cols-2 gap-1.5">
        <button
          class="rounded-lg border px-3 py-2.5 text-sm font-semibold transition"
          :class="mode === 'toCN' ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-300 text-ink-900' : 'border-line bg-white text-ink-600 hover:bg-stone-50'"
          @click="switchMode('toCN')"
        >123 → 中文大寫</button>
        <button
          class="rounded-lg border px-3 py-2.5 text-sm font-semibold transition"
          :class="mode === 'toNum' ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-300 text-ink-900' : 'border-line bg-white text-ink-600 hover:bg-stone-50'"
          @click="switchMode('toNum')"
        >中文數字 → 123</button>
      </div>

      <div v-if="mode === 'toCN'">
        <label class="field-label">輸入金額(阿拉伯數字)</label>
        <input
          v-model="input"
          type="text"
          inputmode="decimal"
          placeholder="例:38500 或 1234.56"
          class="field-input text-lg"
        />
        <p class="field-hint">可含千分位逗號,小數會四捨五入到「分」。全程在你的瀏覽器計算,不會上傳。</p>
      </div>
      <div v-else>
        <label class="field-label">輸入中文數字</label>
        <input
          v-model="input"
          type="text"
          placeholder="例:壹佰貳拾參萬 或 一百二十三"
          class="field-input text-lg"
        />
        <p class="field-hint">支援大寫(壹貳參拾佰仟)與一般(一二三十百千)、萬億兆、兩=2,可核對支票/合約大寫。</p>
      </div>

      <div class="flex flex-wrap gap-2 text-sm">
        <span class="text-ink-500">試試:</span>
        <button
          v-for="ex in (mode === 'toCN' ? examples : cnExamples)"
          :key="ex"
          class="rounded-lg border border-line bg-white px-2.5 py-1 font-mono text-ink-600 hover:bg-stone-50"
          @click="input = ex"
        >
          {{ ex }}
        </button>
      </div>

      <!-- 反向:中文 → 數字 結果 -->
      <div v-if="parsed && !parsed.ok" class="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-800">
        ⚠️ {{ parsed.error }}
      </div>
      <div v-else-if="parsed && parsed.ok" class="rounded-2xl border border-brand-200 bg-brand-50/50 p-5">
        <div class="mb-1 flex items-center gap-3">
          <span class="text-sm font-medium text-ink-500">阿拉伯數字</span>
          <button class="text-sm text-brand-700 underline hover:text-brand-800" @click="copy(String(parsed.value), 'num')">
            {{ copied === 'num' ? '已複製 ✓' : '複製' }}
          </button>
        </div>
        <p class="text-2xl font-bold leading-relaxed tracking-wide text-ink-900">{{ parsedDisplay }}</p>
      </div>

      <div v-if="result && !result.ok" class="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-800">
        ⚠️ {{ result.error }}
      </div>

      <template v-if="result && result.ok">
        <!-- 金額寫法(主角) -->
        <div class="rounded-2xl border border-brand-200 bg-brand-50/50 p-5">
          <div class="mb-1 flex items-center gap-3">
            <span class="text-sm font-medium text-ink-500">金額大寫(支票 / 合約用)</span>
            <button class="text-sm text-brand-700 underline hover:text-brand-800" @click="copy('新臺幣' + result.currency, 'currency')">
              {{ copied === 'currency' ? '已複製 ✓' : '複製' }}
            </button>
          </div>
          <p class="text-2xl font-bold leading-relaxed tracking-wide text-ink-900">新臺幣 {{ result.currency }}</p>
        </div>

        <!-- 純整數大寫 -->
        <div class="rounded-2xl border border-line p-5">
          <div class="mb-1 flex items-center gap-3">
            <span class="text-sm font-medium text-ink-500">純數字大寫</span>
            <button class="text-sm text-brand-700 underline hover:text-brand-800" @click="copy(result.digits, 'digits')">
              {{ copied === 'digits' ? '已複製 ✓' : '複製' }}
            </button>
          </div>
          <p class="text-xl font-semibold tracking-wide text-ink-800">{{ result.digits }}</p>
          <p class="mt-1 text-sm text-ink-400">對應數字:{{ result.normalized }}</p>
        </div>
      </template>
    </div>

    <LegalNote title="為什麼支票、合約要用大寫金額?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>防竄改</strong>:阿拉伯數字「1」很容易被加一筆改成「7」、後面再加個「0」就翻十倍;國字大寫(壹、柒、零)幾乎無法竄改,所以正式票據、合約都要求並列大寫。</li>
        <li>採用台灣常用的大寫字:<strong>零壹貳參肆伍陸柒捌玖</strong>、<strong>拾佰仟萬億兆</strong>,金額後加「<strong>整</strong>」表示無零頭。</li>
        <li>小數會<strong>四捨五入到「分」</strong>(小數第 2 位);可表示到「兆」級金額。</li>
        <li>本工具<strong>不連網、不上傳</strong>,只在你的瀏覽器換算文字;請務必再核對一次金額是否正確。</li>
      </ul>
    </LegalNote>
  </div>
</template>
