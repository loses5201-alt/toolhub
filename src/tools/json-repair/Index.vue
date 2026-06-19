<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import { repairJson } from '@/features/jsonRepair'

/*
  JSON 修復 / 寬鬆解析 —— 把「不嚴謹的 JSON」(單引號、未加引號的鍵、結尾逗號、註解、
  Python None/True/False、NaN/Infinity)修成標準 JSON。常用於整理 LLM 輸出、JS 物件、log。
  全程在你的瀏覽器處理,可能含密鑰的內容不上傳。
*/

const input = ref(
  "{\n  name: 'ToolHub',   // 專案名\n  tags: ['工具', '隱私',],\n  active: True,\n  score: NaN,\n  config: { retries: 3, timeout: 0x1F, }\n}",
)
const minify = ref(false)

const result = computed(() => repairJson(input.value, 2))
const output = computed(() => {
  if (!result.value.ok) return ''
  return minify.value ? result.value.minified! : result.value.json!
})

const copied = ref(false)
function copy() {
  if (!output.value) return
  navigator.clipboard?.writeText(output.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">貼上有問題的 JSON</label>
        <textarea
          v-model="input"
          rows="10"
          class="field-input font-mono text-xs leading-relaxed"
          spellcheck="false"
        />
        <p class="field-hint">會自動修正單引號、未加引號的鍵、結尾逗號、註解等。全程在你的瀏覽器處理,不上傳。</p>
      </div>
      <label class="flex items-center gap-1.5 text-sm text-ink-600">
        <input v-model="minify" type="checkbox" class="rounded" />
        壓縮成單行(minify)
      </label>
    </div>

    <div v-if="!result.ok" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
      ⚠️ 無法修復:{{ result.error }}
    </div>

    <div v-else class="card p-4 space-y-2">
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-emerald-700">✓ 已修復為標準 JSON</span>
        <button class="ml-auto text-sm text-brand-700 underline hover:text-brand-800" @click="copy">
          {{ copied ? '已複製 ✓' : '複製' }}
        </button>
      </div>
      <pre class="overflow-x-auto rounded-lg bg-ink-900 p-4 text-xs leading-relaxed text-ink-50"><code>{{ output }}</code></pre>
    </div>

    <div class="text-sm text-ink-500">
      想把 JSON 變成 <strong>TypeScript 型別</strong>或 <strong>JSON Schema</strong>?用
      <RouterLink to="/tools/json-to-ts" class="font-semibold text-brand-700 underline hover:text-brand-800">JSON 轉 TypeScript</RouterLink>
      或
      <RouterLink to="/tools/json-schema" class="font-semibold text-brand-700 underline hover:text-brand-800">JSON Schema 產生器</RouterLink>
      。
    </div>

    <LegalNote title="這個工具能、不能做什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>能</strong>:修正最常見的不嚴謹寫法 —— 單引號、<strong>未加引號的物件鍵</strong>、<strong>結尾多餘逗號</strong>、<code>//</code> 與 <code>/* */</code> 註解、Python 風格 <code>None/True/False</code>、十六進位/底線分隔的數字。</li>
        <li><strong>能</strong>:把 <code>NaN</code>、<code>Infinity</code>、<code>undefined</code> 轉成 <code>null</code>(JSON 沒有這些值),讓結果是合法 JSON。</li>
        <li><strong>不能</strong>:猜測你漏打的引號或括號 —— 結構嚴重損壞(缺右括號、缺值)時會誠實報錯,不會亂修。</li>
        <li>很適合整理 <strong>LLM 回傳、JS 物件字面值、log 片段</strong>。複雜數字仍以 JavaScript 數值表示,超大整數可能失準。</li>
        <li>全程<strong>在你的瀏覽器</strong>處理,內容<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
