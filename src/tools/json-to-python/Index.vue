<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import { jsonToPython, type PyStyle } from '@/features/jsonToPython'

/*
  JSON → Python —— 貼上 JSON,自動推斷出 dataclass / TypedDict / Pydantic 類別,省去手刻。
  與 json-to-ts(TypeScript)、json-to-go(Go)互補。全程在你的瀏覽器處理,回應不上傳。
*/
const input = ref(
  `{
  "id": 1,
  "name": "小明",
  "vip": false,
  "score": 9.5,
  "tags": ["new", "vip"],
  "address": { "city": "台北", "zip": "100" },
  "orders": [
    { "no": "A001", "amount": 1200 },
    { "no": "A002", "amount": 980, "note": "急件" }
  ]
}`,
)
const rootName = ref('Root')
const style = ref<PyStyle>('dataclass')

const styles: { id: PyStyle; label: string }[] = [
  { id: 'dataclass', label: 'dataclass' },
  { id: 'typeddict', label: 'TypedDict' },
  { id: 'pydantic', label: 'Pydantic' },
]

const result = computed(() =>
  jsonToPython(input.value, { style: style.value, rootName: rootName.value.trim() || 'Root' }),
)

const copied = ref(false)
function copy() {
  if (!result.value.ok || !result.value.code) return
  navigator.clipboard?.writeText(result.value.code)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label" for="jp-in">JSON 內容</label>
        <textarea
          id="jp-in"
          v-model="input"
          rows="11"
          class="field-input font-mono text-xs leading-relaxed"
          spellcheck="false"
        />
        <p class="field-hint">貼上 API 回應或任何 JSON。全程在你的瀏覽器處理,不上傳。</p>
      </div>
      <div class="flex flex-wrap items-end gap-4">
        <div class="sm:w-56">
          <label class="field-label" for="jp-root">根類別名稱</label>
          <input id="jp-root" v-model="rootName" class="field-input" placeholder="Root" />
        </div>
        <div>
          <span class="field-label">輸出樣式</span>
          <div class="inline-flex rounded-lg border border-ink-200 p-0.5 text-sm">
            <button
              v-for="s in styles"
              :key="s.id"
              type="button"
              class="rounded-md px-3 py-1 transition"
              :class="style === s.id ? 'bg-brand-600 text-white' : 'text-ink-600'"
              @click="style = s.id"
            >
              {{ s.label }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!result.ok" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
      ⚠️ {{ result.error }}
    </div>

    <div v-else class="card p-4 space-y-2">
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-emerald-700">✓ 已產生 {{ styles.find((s) => s.id === style)?.label }} 類別</span>
        <button class="ml-auto text-sm text-brand-700 underline hover:text-brand-800" @click="copy">
          {{ copied ? '已複製 ✓' : '複製' }}
        </button>
      </div>
      <pre class="overflow-x-auto rounded-lg bg-ink-900 p-4 text-xs leading-relaxed text-ink-50"><code>{{ result.code }}</code></pre>
    </div>

    <div class="text-sm text-ink-500">
      也可以轉成
      <RouterLink to="/tools/json-to-ts" class="font-semibold text-brand-700 underline hover:text-brand-800">TypeScript 型別</RouterLink>
      或
      <RouterLink to="/tools/json-to-go" class="font-semibold text-brand-700 underline hover:text-brand-800">Go struct</RouterLink>
      。
    </div>

    <LegalNote title="這個工具能、不能做什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>能</strong>:從範例 JSON 推斷出 Python 類別 —— 可選 <strong>dataclass</strong>、<strong>TypedDict</strong>、<strong>Pydantic BaseModel</strong> 三種樣式;巢狀物件各自成類別,陣列合併所有元素欄位。</li>
        <li><strong>型別</strong>:整數→<code>int</code>、含小數→<code>float</code>、<code>null</code> 或某些物件缺該鍵→<code>Optional[...]</code>、型別衝突或空→<code>Any</code>;用 <code>from __future__ import annotations</code> 讓類別順序不受限。</li>
        <li><strong>不能</strong>:推斷 <code>datetime</code> / <code>Decimal</code> 等語意型別、辨識「字典型」動態鍵物件;鍵名非合法識別字會自動改名並加註原始鍵。</li>
        <li>全程<strong>在你的瀏覽器</strong>處理,可能含密鑰的回應<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
