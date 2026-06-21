<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import { jsonToCsharp, type CsStyle, type CsJsonLib } from '@/features/jsonToCsharp'

/*
  JSON → C# —— 貼上 JSON,自動推斷出 C# class / record(可選 System.Text.Json 或 Newtonsoft 標註),省去手刻。
  與 json-to-ts / go / python / rust 互補。全程在你的瀏覽器處理,回應不上傳。
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
const namespace = ref('')
const style = ref<CsStyle>('class')
const jsonLib = ref<CsJsonLib>('system')

const styles: { id: CsStyle; label: string }[] = [
  { id: 'class', label: 'class' },
  { id: 'record', label: 'record' },
]
const libs: { id: CsJsonLib; label: string }[] = [
  { id: 'system', label: 'System.Text.Json' },
  { id: 'newtonsoft', label: 'Newtonsoft' },
  { id: 'none', label: '無標註' },
]

const result = computed(() =>
  jsonToCsharp(input.value, {
    style: style.value,
    jsonLib: jsonLib.value,
    rootName: rootName.value.trim() || 'Root',
    namespace: namespace.value.trim(),
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
        <label class="field-label" for="jc-in">JSON 內容</label>
        <textarea
          id="jc-in"
          v-model="input"
          rows="11"
          class="field-input font-mono text-xs leading-relaxed"
          spellcheck="false"
        />
        <p class="field-hint">貼上 API 回應或任何 JSON。全程在你的瀏覽器處理,不上傳。</p>
      </div>
      <div class="flex flex-wrap items-end gap-4">
        <div class="sm:w-44">
          <label class="field-label" for="jc-root">根類別名稱</label>
          <input id="jc-root" v-model="rootName" class="field-input" placeholder="Root" />
        </div>
        <div class="sm:w-52">
          <label class="field-label" for="jc-ns">命名空間(可留空)</label>
          <input id="jc-ns" v-model="namespace" class="field-input" placeholder="MyApp.Models" />
        </div>
        <div>
          <span class="field-label">型態</span>
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
        <div>
          <span class="field-label">JSON 標註</span>
          <div class="inline-flex rounded-lg border border-ink-200 p-0.5 text-sm">
            <button
              v-for="l in libs"
              :key="l.id"
              type="button"
              class="rounded-md px-2.5 py-1 transition"
              :class="jsonLib === l.id ? 'bg-brand-600 text-white' : 'text-ink-600'"
              @click="jsonLib = l.id"
            >
              {{ l.label }}
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
        <span class="text-sm font-semibold text-emerald-700">✓ 已產生 C# {{ style }}</span>
        <button class="ml-auto text-sm text-brand-700 underline hover:text-brand-800" @click="copy">
          {{ copied ? '已複製 ✓' : '複製' }}
        </button>
      </div>
      <pre class="overflow-x-auto rounded-lg bg-ink-900 p-4 text-xs leading-relaxed text-ink-50"><code>{{ result.code }}</code></pre>
    </div>

    <div class="text-sm text-ink-500">
      也可以轉成
      <RouterLink to="/tools/json-to-ts" class="font-semibold text-brand-700 underline hover:text-brand-800">TypeScript</RouterLink>、
      <RouterLink to="/tools/json-to-go" class="font-semibold text-brand-700 underline hover:text-brand-800">Go</RouterLink>、
      <RouterLink to="/tools/json-to-python" class="font-semibold text-brand-700 underline hover:text-brand-800">Python</RouterLink>
      或
      <RouterLink to="/tools/json-to-rust" class="font-semibold text-brand-700 underline hover:text-brand-800">Rust</RouterLink>
      。
    </div>

    <LegalNote title="這個工具能、不能做什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>能</strong>:從範例 JSON 推斷出 C# <code>class</code> 或 <code>record</code> —— 可選 <strong>System.Text.Json</strong>(<code>[JsonPropertyName]</code>)或 <strong>Newtonsoft</strong>(<code>[JsonProperty]</code>)標註;屬性採 PascalCase,與原鍵不同時自動加標註;巢狀物件各自成類別、陣列合併欄位。</li>
        <li><strong>型別</strong>:整數→<code>long</code>、含小數→<code>double</code>、<code>null</code> 或缺鍵→實值型別加 <code>?</code>(<code>long?</code>)、型別衝突或全 <code>null</code>→<code>object</code>。</li>
        <li><strong>不能</strong>:推斷 <code>DateTime</code> / <code>Guid</code> 等語意型別、辨識 <code>Dictionary</code> 動態鍵;參考型別的可空性需自行依專案 NRT 設定調整。</li>
        <li>全程<strong>在你的瀏覽器</strong>處理,可能含密鑰的回應<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
