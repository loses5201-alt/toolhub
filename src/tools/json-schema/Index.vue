<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import { generate } from '@/features/jsonSchema'

/*
  JSON Schema 產生器 —— 貼上一段範例 JSON,推斷出 JSON Schema(draft-07),
  用於 API 合約、表單驗證、文件。陣列會合併所有元素結構,物件 required 取所有樣本都有的鍵。
  全程在你的瀏覽器,可能含密鑰的回應不上傳。
*/

const input = ref(
  '{\n  "id": 1,\n  "email": "a@example.com",\n  "active": true,\n  "score": 4.5,\n  "tags": ["new", "vip"],\n  "items": [\n    { "sku": "A001", "qty": 2 },\n    { "sku": "A002", "qty": 1, "note": "急件" }\n  ]\n}',
)
const detectFormat = ref(true)
const requireAll = ref(true)

const result = computed(() =>
  generate(input.value, {
    detectFormat: detectFormat.value,
    requireAll: requireAll.value,
  }),
)

const copied = ref(false)
function copy() {
  if (!result.value.ok || !result.value.schema) return
  navigator.clipboard?.writeText(result.value.schema)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

function download() {
  if (!result.value.ok || !result.value.schema) return
  const blob = new Blob([result.value.schema], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'schema.json'
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">範例 JSON</label>
        <textarea
          v-model="input"
          rows="11"
          class="field-input font-mono text-xs leading-relaxed"
          spellcheck="false"
        />
        <p class="field-hint">貼上 API 回應或任何 JSON。全程在你的瀏覽器處理,不上傳。</p>
      </div>
      <div class="flex flex-wrap gap-4 text-sm text-ink-600">
        <label class="flex items-center gap-1.5">
          <input v-model="detectFormat" type="checkbox" class="rounded" />
          偵測字串格式(email / date / uri / uuid)
        </label>
        <label class="flex items-center gap-1.5">
          <input v-model="requireAll" type="checkbox" class="rounded" />
          所有鍵列為 required
        </label>
      </div>
    </div>

    <div v-if="!result.ok" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
      ⚠️ {{ result.error }}
    </div>

    <div v-else class="card p-4 space-y-2">
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-ink-700">JSON Schema(draft-07)</span>
        <div class="ml-auto flex gap-3">
          <button class="text-sm text-brand-700 underline hover:text-brand-800" @click="copy">
            {{ copied ? '已複製 ✓' : '複製' }}
          </button>
          <button class="text-sm text-brand-700 underline hover:text-brand-800" @click="download">
            下載 .json
          </button>
        </div>
      </div>
      <pre class="overflow-x-auto rounded-lg bg-ink-900 p-4 text-xs leading-relaxed text-ink-50"><code>{{ result.schema }}</code></pre>
    </div>

    <div class="text-sm text-ink-500">
      想要的是 <strong>TypeScript 型別</strong>而不是 Schema?用
      <RouterLink to="/tools/json-to-ts" class="font-semibold text-brand-700 underline hover:text-brand-800">
        JSON 轉 TypeScript
      </RouterLink>
      。
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>把一段<strong>範例 JSON</strong> 變成 <strong>JSON Schema(draft-07)</strong>,用於 API 合約、請求/回應驗證、表單規則、文件。</li>
        <li>陣列會<strong>合併所有元素</strong>的結構;物件陣列裡只有部分筆才有的鍵會<strong>從 required 移除</strong>(取交集)。</li>
        <li>整數與小數混用會推成 <code>number</code>;不同型別混用會合成 <code>anyOf</code>。</li>
        <li>可選擇偵測常見字串<strong>格式</strong>(email、date、date-time、uri、uuid)。</li>
        <li>推斷結果僅供起點 —— 請依實際需求補上 <code>enum</code>、長度、可為 null 等限制。本工具<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
