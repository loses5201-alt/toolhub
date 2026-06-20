<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { validateGtin, completeGtin, lookupPrefix } from '@/features/gtin'

/*
  GTIN / 商品條碼檢查碼 —— 驗證 EAN-13 / UPC-A / EAN-8 / GTIN-14,或由前置碼補上檢查碼。
  全程在你的瀏覽器計算,不連網、不上傳;只做數學驗證,不查詢商品資料。
*/

type Mode = 'validate' | 'complete'
const mode = ref<Mode>('validate')
const input = ref('4710088012345')

const result = computed(() => validateGtin(input.value))
const completed = computed(() => completeGtin(input.value))
const prefix = computed(() => {
  const d = (input.value || '').replace(/\D/g, '')
  // EAN-13 / GTIN-14 才有 GS1 國別前置;14 碼首位是包裝指示碼,取後 13 碼前 3 碼
  if (d.length === 14) return lookupPrefix(d.slice(1))
  if (d.length >= 3) return lookupPrefix(d)
  return null
})

const copied = ref('')
async function copy(text: string, key: string) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = key
    setTimeout(() => (copied.value = ''), 1200)
  } catch {
    /* 忽略 */
  }
}

const EXAMPLES_V = [
  { label: '臺灣 EAN-13', v: '4710088012345' },
  { label: 'UPC-A', v: '036000291452' },
  { label: 'EAN-8', v: '96385074' },
  { label: 'GTIN-14', v: '10614141000415' },
]
const EXAMPLES_C = [
  { label: 'EAN-13 前 12 碼', v: '471008801234' },
  { label: 'UPC-A 前 11 碼', v: '03600029145' },
]
</script>

<template>
  <div class="space-y-6">
    <div class="card p-5 space-y-4">
      <div class="flex gap-2">
        <button
          type="button"
          class="flex-1 rounded-lg border px-3 py-2 text-sm font-medium"
          :class="
            mode === 'validate'
              ? 'border-brand-400 bg-brand-50 text-brand-700'
              : 'border-ink-200 text-ink-600 hover:bg-ink-50'
          "
          @click="mode = 'validate'"
        >
          驗證完整條碼
        </button>
        <button
          type="button"
          class="flex-1 rounded-lg border px-3 py-2 text-sm font-medium"
          :class="
            mode === 'complete'
              ? 'border-brand-400 bg-brand-50 text-brand-700'
              : 'border-ink-200 text-ink-600 hover:bg-ink-50'
          "
          @click="mode = 'complete'"
        >
          補上檢查碼
        </button>
      </div>

      <label class="block text-sm">
        <span class="text-ink-500">{{
          mode === 'validate'
            ? '輸入完整條碼數字(8 / 12 / 13 / 14 碼)'
            : '輸入不含檢查碼的前置碼(7 / 11 / 12 / 13 碼)'
        }}</span>
        <input v-model="input" type="text" inputmode="numeric" class="gt-input font-mono" />
      </label>

      <div class="flex flex-wrap gap-2">
        <button
          v-for="ex in mode === 'validate' ? EXAMPLES_V : EXAMPLES_C"
          :key="ex.label"
          type="button"
          class="rounded-lg border border-ink-200 px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          @click="input = ex.v"
        >
          {{ ex.label }}
        </button>
      </div>
    </div>

    <!-- 驗證模式 -->
    <template v-if="mode === 'validate'">
      <div v-if="result.valid" class="card p-5 space-y-2 border-emerald-200 bg-emerald-50/40">
        <div class="flex items-center gap-2 text-emerald-700 font-semibold">
          <span class="text-xl">✓</span><span>檢查碼正確 —— {{ result.type }}</span>
        </div>
        <div class="text-sm text-ink-600">
          資料碼 <code class="font-mono">{{ result.dataPart }}</code> + 檢查碼
          <code class="font-mono font-semibold text-emerald-700">{{ result.expectedCheck }}</code>
        </div>
      </div>
      <div v-else-if="input.trim()" class="card p-5 space-y-1 border-rose-200 bg-rose-50/40">
        <div class="flex items-center gap-2 text-rose-700 font-semibold">
          <span class="text-xl">✗</span><span>無效</span>
        </div>
        <ul class="text-sm text-rose-600 space-y-0.5">
          <li v-for="(e, i) in result.errors" :key="i">• {{ e }}</li>
        </ul>
      </div>
    </template>

    <!-- 補碼模式 -->
    <template v-else>
      <div v-if="completed.full" class="card p-5 space-y-2">
        <span class="text-sm font-semibold text-ink-700">補上檢查碼後的完整條碼</span>
        <div class="flex items-center gap-3">
          <code class="font-mono text-2xl text-ink-800">{{ completed.full.slice(0, -1) }}<span class="text-brand-600 font-semibold">{{ completed.full.slice(-1) }}</span></code>
          <button
            type="button"
            class="rounded-lg border border-ink-200 px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
            @click="copy(completed.full, 'full')"
          >
            {{ copied === 'full' ? '已複製' : '複製' }}
          </button>
        </div>
        <div class="text-sm text-ink-500">檢查碼 = {{ completed.check }}</div>
      </div>
      <div v-else-if="input.trim()" class="card p-5">
        <p class="text-sm text-rose-600">{{ completed.error }}</p>
      </div>
    </template>

    <!-- 國別前置碼 -->
    <div v-if="prefix" class="card p-5 space-y-1">
      <span class="text-sm font-semibold text-ink-700">GS1 國別 / 用途前置碼</span>
      <div class="text-sm text-ink-600">
        前置碼 <code class="font-mono">{{ prefix.code }}</code> → <strong>{{ prefix.label }}</strong>
      </div>
      <p class="text-xs text-ink-400">
        前置碼代表「發碼的 GS1 組織所在地」,不一定等於商品實際產地。
      </p>
    </div>

    <LegalNote>
      <p>
        <strong>GTIN</strong>(全球貿易品項識別碼)涵蓋 <strong>EAN-13、UPC-A(12 碼)、EAN-8、GTIN-14</strong>,
        最後一碼是 <strong>GS1 mod-10 檢查碼</strong>:由最右側資料碼起,權重交替 3、1、3、1…,
        加總後取 10 的補數即檢查碼,用來偵測掃描或輸入錯誤。
      </p>
      <p>
        本工具可<strong>驗證</strong>完整條碼是否正確,或由前置碼<strong>補上</strong>缺少的檢查碼,
        並解讀 EAN-13 的國別/用途前置碼(教育用對照,非即時資料庫)。與條碼產生器、ISBN / 信用卡號檢查互補。
      </p>
      <p>只做數學驗證,<strong>不查詢任何商品或廠商資料,全程在你的瀏覽器計算、不連網、不上傳</strong>。</p>
    </LegalNote>
  </div>
</template>

<style scoped>
.gt-input {
  width: 100%;
  margin-top: 0.25rem;
  border: 1px solid var(--color-ink-200, #e2e8f0);
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
  font-size: 1rem;
  letter-spacing: 0.05em;
}
</style>
