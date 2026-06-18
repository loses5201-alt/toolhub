<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { amountToEnglish } from '@/features/amountEnglish'

/*
  英文金額大寫 —— 把金額轉成英文文字寫法,供外銷發票(commercial invoice)、
  外幣支票、信用狀、合約使用(這些單據金額一律要寫成英文文字以防竄改)。
  與「金額大寫互轉」(中文)互補。全程在你瀏覽器計算,不上傳。
*/
const input = ref('')
const currency = ref('USD')
const centsStyle = ref<'fraction' | 'words'>('fraction')

const CURRENCIES = ['USD', 'NT DOLLARS', 'EUR', 'JPY', 'CNY', 'GBP', 'HKD', '(不加)']

const result = computed(() => {
  const t = input.value.trim()
  if (!t) return null
  try {
    const cur = currency.value === '(不加)' ? '' : currency.value
    const r = amountToEnglish(t, { currency: cur, centsStyle: centsStyle.value })
    return { ok: true as const, ...r }
  } catch (e) {
    return { ok: false as const, error: (e as Error).message }
  }
})

const copied = ref<string | null>(null)
function copy(text: string, tag: string) {
  navigator.clipboard?.writeText(text)
  copied.value = tag
  setTimeout(() => (copied.value = null), 1500)
}

const examples = ['1234.56', '38500', '1000000', '99.99']
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">輸入金額(阿拉伯數字)</label>
        <input
          v-model="input"
          type="text"
          inputmode="decimal"
          placeholder="例:1234.56 或 38500"
          class="field-input text-lg"
        />
        <p class="field-hint">可含千分位逗號,小數會四捨五入到兩位(分 / cents)。全程在你的瀏覽器計算,不會上傳。</p>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label">幣別</label>
          <select v-model="currency" class="field-input">
            <option v-for="c in CURRENCIES" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <div>
          <label class="field-label">小數寫法</label>
          <select v-model="centsStyle" class="field-input">
            <option value="fraction">56/100(支票最常見)</option>
            <option value="words">fifty-six cents(文字)</option>
          </select>
        </div>
      </div>

      <div class="flex flex-wrap gap-2 text-sm">
        <span class="text-ink-500">試試:</span>
        <button
          v-for="ex in examples"
          :key="ex"
          class="rounded-lg border border-line bg-white px-2.5 py-1 font-mono text-ink-600 hover:bg-stone-50"
          @click="input = ex"
        >
          {{ ex }}
        </button>
      </div>

      <div v-if="result && !result.ok" class="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-800">
        ⚠️ {{ result.error }}
      </div>

      <template v-if="result && result.ok">
        <!-- 支票 / 發票寫法(主角) -->
        <div class="rounded-2xl border border-brand-200 bg-brand-50/50 p-5">
          <div class="mb-1 flex items-center gap-3">
            <span class="text-sm font-medium text-ink-500">支票 / 發票寫法</span>
            <button class="text-sm text-brand-700 underline hover:text-brand-800" @click="copy(result.cheque, 'cheque')">
              {{ copied === 'cheque' ? '已複製 ✓' : '複製' }}
            </button>
          </div>
          <p class="text-xl font-bold leading-relaxed tracking-wide text-ink-900 break-words">{{ result.cheque }}</p>
        </div>

        <!-- 純文字寫法 -->
        <div class="rounded-2xl border border-line p-5">
          <div class="mb-1 flex items-center gap-3">
            <span class="text-sm font-medium text-ink-500">純文字寫法(小寫)</span>
            <button class="text-sm text-brand-700 underline hover:text-brand-800" @click="copy(result.words, 'words')">
              {{ copied === 'words' ? '已複製 ✓' : '複製' }}
            </button>
          </div>
          <p class="text-lg font-medium leading-relaxed text-ink-800 break-words">{{ result.words }}</p>
        </div>
      </template>
    </div>

    <LegalNote title="什麼時候要把金額寫成英文?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>外銷發票(commercial invoice)、外幣支票、信用狀(L/C)、英文合約</strong>都要求金額並列「英文文字寫法」,和阿拉伯數字互相對照,以防被竄改(例:把 1 改成 7、後面加個 0)。</li>
        <li>常見格式為「<strong>幣別 + 金額英文 + AND NN/100 + ONLY</strong>」,例:<em>USD ONE THOUSAND TWO HUNDRED THIRTY-FOUR AND 56/100 ONLY</em>。小數也可改成文字「fifty-six cents」。</li>
        <li>採用美式短級數(thousand / million / billion / trillion),小數四捨五入到兩位。</li>
        <li>本工具<strong>不連網、不上傳</strong>,只在你的瀏覽器換算;送出單據前請務必再核對一次金額與幣別。</li>
      </ul>
    </LegalNote>
  </div>
</template>
