<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import { sampleFromSchema } from '@/features/schemaSample'

/*
  JSON Schema → 範例 JSON —— 貼上 JSON Schema(draft-07 等),產生一筆符合 schema 的範例資料,
  用於 API mock、測試假資料、快速看懂 schema 長相。與 json-schema(反向)、fake-data 互補。
  全程在你的瀏覽器處理,不上傳。
*/
const input = ref(
  `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["id", "email"],
  "properties": {
    "id": { "type": "integer", "minimum": 1 },
    "email": { "type": "string", "format": "email" },
    "active": { "type": "boolean" },
    "roles": {
      "type": "array",
      "items": { "type": "string", "enum": ["admin", "user"] }
    },
    "profile": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "age": { "type": "integer", "minimum": 18 }
      }
    }
  }
}`,
)
const requiredOnly = ref(false)
const arrayCount = ref(1)

const result = computed(() =>
  sampleFromSchema(input.value, {
    requiredOnly: requiredOnly.value,
    arrayCount: Math.max(1, Math.min(10, Number(arrayCount.value) || 1)),
  }),
)

const copied = ref(false)
function copy() {
  if (!result.value.ok || !result.value.sample) return
  navigator.clipboard?.writeText(result.value.sample)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label" for="ss-in">JSON Schema</label>
        <textarea
          id="ss-in"
          v-model="input"
          rows="13"
          class="field-input font-mono text-xs leading-relaxed"
          spellcheck="false"
        />
        <p class="field-hint">貼上 JSON Schema(draft-07 / 2020-12 常見子集)。全程在你的瀏覽器處理,不上傳。</p>
      </div>
      <div class="flex flex-wrap items-end gap-5">
        <label class="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" v-model="requiredOnly" class="h-4 w-4" />
          只輸出 required 欄位
        </label>
        <div class="w-40">
          <label class="field-label" for="ss-count">陣列產生筆數</label>
          <input id="ss-count" type="number" min="1" max="10" v-model="arrayCount" class="field-input" />
        </div>
      </div>
    </div>

    <div v-if="!result.ok" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
      ⚠️ {{ result.error }}
    </div>

    <div v-else class="card p-4 space-y-2">
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-emerald-700">✓ 已產生範例 JSON</span>
        <button class="ml-auto text-sm text-brand-700 underline hover:text-brand-800" @click="copy">
          {{ copied ? '已複製 ✓' : '複製' }}
        </button>
      </div>
      <pre class="overflow-x-auto rounded-lg bg-ink-900 p-4 text-xs leading-relaxed text-ink-50"><code>{{ result.sample }}</code></pre>
    </div>

    <div class="text-sm text-ink-500">
      反向(範例 JSON → Schema)請用
      <RouterLink to="/tools/json-schema" class="font-semibold text-brand-700 underline hover:text-brand-800">JSON Schema 產生器</RouterLink>;
      需要大量隨機假資料看
      <RouterLink to="/tools/fake-data" class="font-semibold text-brand-700 underline hover:text-brand-800">假資料產生器</RouterLink>。
    </div>

    <LegalNote title="這個工具能、不能做什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>能</strong>:由 JSON Schema 產生一筆符合結構的範例 JSON —— 支援 <code>type</code>(含 nullable 陣列型別)、<code>properties</code> / <code>required</code>、<code>items</code>(含 tuple)、<code>$ref</code>(本地 <code>#/definitions</code>、<code>#/$defs</code>)、<code>allOf</code> 合併、<code>anyOf</code> / <code>oneOf</code>(取第一個)、<code>const</code> / <code>default</code> / <code>examples</code> / <code>enum</code>(依此優先序)。</li>
        <li><strong>值的來源</strong>:字串依 <code>format</code>(email / date / date-time / uri / uuid…)給代表值,數字取 <code>minimum</code> / <code>multipleOf</code>,陣列依 <code>minItems</code> / <code>maxItems</code> 與設定筆數。</li>
        <li><strong>不能</strong>:不保證滿足 <code>pattern</code>(正則)、複雜的 <code>if/then/else</code>、<code>not</code>、跨欄位條件;遞迴 <code>$ref</code> 會在第二層截斷以免無限展開。產出僅供 mock / 參考,正式驗證請用 schema validator。</li>
        <li>全程<strong>在你的瀏覽器</strong>處理,不連網、不上傳。</li>
      </ul>
    </LegalNote>
  </div>
</template>
