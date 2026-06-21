<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import { jsonToRust, type RustStyle } from '@/features/jsonToRust'

/*
  JSON → Rust —— 貼上 JSON,自動推斷出 Rust struct(可選 serde 衍生與 rename),省去手刻。
  與 json-to-ts(TypeScript)、json-to-go(Go)、json-to-python(Python)互補。
  全程在你的瀏覽器處理,回應不上傳。
*/
const input = ref(
  `{
  "id": 1,
  "userName": "小明",
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
const style = ref<RustStyle>('serde')
const pubFields = ref(true)

const styles: { id: RustStyle; label: string }[] = [
  { id: 'serde', label: 'serde' },
  { id: 'plain', label: '純結構' },
]

const result = computed(() =>
  jsonToRust(input.value, {
    style: style.value,
    rootName: rootName.value.trim() || 'Root',
    pubFields: pubFields.value,
  }),
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
        <label class="field-label" for="jr-in">JSON 內容</label>
        <textarea
          id="jr-in"
          v-model="input"
          rows="11"
          class="field-input font-mono text-xs leading-relaxed"
          spellcheck="false"
        />
        <p class="field-hint">貼上 API 回應或任何 JSON。全程在你的瀏覽器處理,不上傳。</p>
      </div>
      <div class="flex flex-wrap items-end gap-4">
        <div class="sm:w-56">
          <label class="field-label" for="jr-root">根結構名稱</label>
          <input id="jr-root" v-model="rootName" class="field-input" placeholder="Root" />
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
        <label class="flex items-center gap-2 text-sm text-ink-600">
          <input v-model="pubFields" type="checkbox" class="h-4 w-4 rounded border-ink-300" />
          欄位加 <code>pub</code>
        </label>
      </div>
    </div>

    <div v-if="!result.ok" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
      ⚠️ {{ result.error }}
    </div>

    <div v-else class="card p-4 space-y-2">
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-emerald-700">✓ 已產生 Rust struct</span>
        <button class="ml-auto text-sm text-brand-700 underline hover:text-brand-800" @click="copy">
          {{ copied ? '已複製 ✓' : '複製' }}
        </button>
      </div>
      <pre class="overflow-x-auto rounded-lg bg-ink-900 p-4 text-xs leading-relaxed text-ink-50"><code>{{ result.code }}</code></pre>
    </div>

    <div class="text-sm text-ink-500">
      也可以轉成
      <RouterLink to="/tools/json-to-ts" class="font-semibold text-brand-700 underline hover:text-brand-800">TypeScript 型別</RouterLink>、
      <RouterLink to="/tools/json-to-go" class="font-semibold text-brand-700 underline hover:text-brand-800">Go struct</RouterLink>
      或
      <RouterLink to="/tools/json-to-python" class="font-semibold text-brand-700 underline hover:text-brand-800">Python 類別</RouterLink>
      。
    </div>

    <LegalNote title="這個工具能、不能做什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>能</strong>:從範例 JSON 推斷出 Rust <code>struct</code> —— <strong>serde</strong> 樣式自動加 <code>#[derive(Serialize, Deserialize)]</code>,鍵名非 snake_case 時補 <code>#[serde(rename = "…")]</code>;巢狀物件各自成 struct,陣列合併所有元素欄位。</li>
        <li><strong>型別</strong>:整數→<code>i64</code>、含小數→<code>f64</code>、<code>null</code> 或某些物件缺該鍵→<code>Option&lt;…&gt;</code>、型別衝突或全 <code>null</code>→<code>serde_json::Value</code>。</li>
        <li><strong>不能</strong>:推斷 <code>chrono::DateTime</code> 等語意型別、辨識動態鍵的 <code>HashMap</code>;鍵名撞 Rust 關鍵字會加底線,並靠 serde rename 還原。</li>
        <li>全程<strong>在你的瀏覽器</strong>處理,可能含密鑰的回應<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
