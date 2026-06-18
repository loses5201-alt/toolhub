<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { jsonToTs } from '@/features/jsonToTs'

/*
  JSON → TypeScript 型別 —— 貼上 JSON,自動推斷出對應的 interface,省去手刻型別。
  全程在你的瀏覽器,可能含密鑰的回應不上傳。
*/
const input = ref(
  '{\n  "id": 1,\n  "name": "小明",\n  "vip": false,\n  "tags": ["new", "vip"],\n  "orders": [\n    { "no": "A001", "amount": 1200 },\n    { "no": "A002", "amount": 980, "note": "急件" }\n  ]\n}',
)
const rootName = ref('Root')

const result = computed(() => jsonToTs(input.value, rootName.value.trim() || 'Root'))

const copied = ref(false)
function copy() {
  if (!result.value.ok) return
  navigator.clipboard?.writeText(result.value.code!)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">JSON 內容</label>
        <textarea v-model="input" rows="11" class="field-input font-mono text-xs leading-relaxed" spellcheck="false" />
        <p class="field-hint">貼上 API 回應或任何 JSON。全程在你的瀏覽器處理,不上傳。</p>
      </div>
      <div class="sm:w-64">
        <label class="field-label">根型別名稱</label>
        <input v-model="rootName" class="field-input" placeholder="Root" />
      </div>
    </div>

    <div v-if="!result.ok" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
      ⚠️ JSON 解析失敗:{{ result.error }}
    </div>

    <div v-else class="card p-4 space-y-2">
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-ink-700">TypeScript 型別</span>
        <button class="ml-auto text-sm text-brand-700 underline hover:text-brand-800" @click="copy">
          {{ copied ? '已複製 ✓' : '複製' }}
        </button>
      </div>
      <pre class="overflow-x-auto rounded-lg bg-ink-900 p-4 text-xs leading-relaxed text-ink-50"><code>{{ result.code }}</code></pre>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>把一段 <strong>API 回應 / JSON</strong> 直接變成 TypeScript <code>interface</code>,寫前端、Node、型別定義免一個個手敲。</li>
        <li>巢狀物件會各自產生具名 interface;陣列內多筆物件會<strong>合併</strong>成一個型別,某些筆才有的鍵自動標成可選(<code>?</code>),同鍵不同型別合成聯集。</li>
        <li>不合法的識別字鍵(含 <code>-</code>、數字開頭、中文)會自動加上引號,貼進專案即可編譯。</li>
        <li>本工具<strong>不連網、不上傳</strong>,可能含密鑰或個資的回應只留在你的瀏覽器。推斷型別僅供起點,請依實際 API 文件校正(例如可為 null 的欄位)。</li>
      </ul>
    </LegalNote>
  </div>
</template>
