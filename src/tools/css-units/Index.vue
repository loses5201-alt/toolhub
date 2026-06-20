<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { convertAll, UNITS, round } from '@/features/cssUnits'

/*
  CSS 單位換算 —— px / rem / em / pt / pc / in / cm / mm / % 互轉。
  rem 依根字級;em 與 % 依目前文字脈絡字級。全程在你的瀏覽器計算,不連網、不上傳。
*/

const value = ref<number | null>(24)
const unit = ref('px')
const rootFont = ref<number | null>(16)
const contextFont = ref<number | null>(16)

const result = computed(() =>
  convertAll(Number(value.value), unit.value, Number(rootFont.value), Number(contextFont.value)),
)

const copied = ref('')
async function copyVal(u: string, v: number) {
  const text = `${round(v, 4)}${u === '%' ? '%' : u}`
  try {
    await navigator.clipboard.writeText(text)
    copied.value = u
    setTimeout(() => (copied.value = ''), 1200)
  } catch {
    /* 忽略複製失敗 */
  }
}

const PRESETS = [12, 14, 16, 18, 24, 32]
</script>

<template>
  <div class="space-y-6">
    <div class="card p-5 space-y-4">
      <label class="block text-sm">
        <span class="text-ink-500">數值與單位</span>
        <div class="mt-1 flex gap-2">
          <input v-model.number="value" type="number" step="any" class="cu-input flex-1" />
          <select v-model="unit" class="cu-input w-24">
            <option v-for="u in UNITS" :key="u" :value="u">{{ u }}</option>
          </select>
        </div>
      </label>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="p in PRESETS"
          :key="p"
          type="button"
          class="rounded-lg border border-ink-200 px-2.5 py-1 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          @click="value = p; unit = 'px'"
        >
          {{ p }}px
        </button>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <label class="text-sm">
          <span class="text-ink-500">根字級(供 rem,px)</span>
          <input v-model.number="rootFont" type="number" min="1" step="any" class="cu-input mt-1 w-full" />
        </label>
        <label class="text-sm">
          <span class="text-ink-500">脈絡字級(供 em / %,px)</span>
          <input v-model.number="contextFont" type="number" min="1" step="any" class="cu-input mt-1 w-full" />
        </label>
      </div>
    </div>

    <div v-if="result.valid" class="card p-5 space-y-1">
      <h2 class="text-sm font-semibold text-ink-700 pb-1">換算結果(點數值可複製)</h2>
      <button
        v-for="v in result.values"
        :key="v.unit"
        type="button"
        class="flex w-full items-center justify-between border-b border-ink-100 py-2 text-left last:border-0 hover:bg-ink-50 rounded px-1"
        @click="copyVal(v.unit, v.value)"
      >
        <span class="text-ink-500 w-16">{{ v.unit }}</span>
        <span class="font-mono text-ink-800" :class="{ 'font-semibold text-brand-600': v.unit === unit }">
          {{ round(v.value, 4) }}<span class="text-ink-400">{{ v.unit === '%' ? '%' : v.unit }}</span>
        </span>
        <span class="w-12 text-right text-xs text-emerald-600">{{ copied === v.unit ? '已複製' : '' }}</span>
      </button>
    </div>
    <p v-else class="card p-5 text-sm text-rose-600">{{ result.error }}</p>

    <LegalNote>
      依 CSS 規範:<strong>1in = 96px</strong>(參考像素)、<strong>1pt = 1/72 in = 96/72 px</strong>、
      <strong>1pc = 12pt = 16px</strong>、1cm = 96/2.54 px、1mm = 96/25.4 px。
      <strong>rem</strong> 相對於<strong>根元素</strong>字級(瀏覽器預設 16px);
      <strong>em</strong> 與 <strong>%</strong> 相對於<strong>目前文字脈絡</strong>字級(可在上方分別設定)。
      實際渲染還會受縮放、裝置像素比影響;此處為規範下的理想換算,<strong>不上傳任何資料</strong>。
      與 clamp 產生器、box-shadow 等 CSS 工坊互補。
    </LegalNote>
  </div>
</template>

<style scoped>
.cu-input {
  border: 1px solid var(--color-ink-200, #e2e8f0);
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
  font-size: 0.95rem;
}
</style>
