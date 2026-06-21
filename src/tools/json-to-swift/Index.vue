<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import { jsonToSwift } from '@/features/jsonToSwift'

/*
  JSON → Swift —— 貼上 JSON,自動推斷出 Swift Codable struct,iOS / macOS 開發省去手刻型別。
  屬性採 camelCase,與原鍵不同時自動產生 CodingKeys。與 json-to-ts / go / python / rust / csharp / kotlin / java 互補。
  全程在你的瀏覽器處理,回應不上傳。
*/
const input = ref(
  `{
  "id": 1,
  "user_name": "小明",
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

const result = computed(() => jsonToSwift(input.value, { rootName: rootName.value.trim() || 'Root' }))

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
        <label class="field-label" for="js-in">JSON 內容</label>
        <textarea
          id="js-in"
          v-model="input"
          rows="11"
          class="field-input font-mono text-xs leading-relaxed"
          spellcheck="false"
        />
        <p class="field-hint">貼上 API 回應或任何 JSON。全程在你的瀏覽器處理,不上傳。</p>
      </div>
      <div class="sm:w-56">
        <label class="field-label" for="js-root">根類別名稱</label>
        <input id="js-root" v-model="rootName" class="field-input" placeholder="Root" />
      </div>
    </div>

    <div v-if="!result.ok" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
      ⚠️ {{ result.error }}
    </div>

    <div v-else class="card p-4 space-y-2">
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-emerald-700">✓ 已產生 Swift Codable struct</span>
        <button class="ml-auto text-sm text-brand-700 underline hover:text-brand-800" @click="copy">
          {{ copied ? '已複製 ✓' : '複製' }}
        </button>
      </div>
      <pre class="overflow-x-auto rounded-lg bg-ink-900 p-4 text-xs leading-relaxed text-ink-50"><code>{{ result.code }}</code></pre>
    </div>

    <div class="text-sm text-ink-500">
      也可以轉成
      <RouterLink to="/tools/json-to-kotlin" class="font-semibold text-brand-700 underline hover:text-brand-800">Kotlin</RouterLink>、
      <RouterLink to="/tools/json-to-java" class="font-semibold text-brand-700 underline hover:text-brand-800">Java</RouterLink>、
      <RouterLink to="/tools/json-to-csharp" class="font-semibold text-brand-700 underline hover:text-brand-800">C#</RouterLink>
      或
      <RouterLink to="/tools/json-to-ts" class="font-semibold text-brand-700 underline hover:text-brand-800">TypeScript</RouterLink>
      。
    </div>

    <LegalNote title="這個工具能、不能做什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>能</strong>:從範例 JSON 推斷出 Swift <code>Codable</code> struct —— 屬性採 camelCase,與原鍵不同時自動產生 <code>CodingKeys</code>(Swift 規定一旦自訂就要列出全部鍵);巢狀物件各自成 struct、陣列合併欄位。</li>
        <li><strong>型別</strong>:整數→<code>Int</code>、含小數→<code>Double</code>、布林→<code>Bool</code>、字串→<code>String</code>;<code>null</code> 或缺鍵→可選 <code>T?</code>(Codable 解碼缺鍵自動為 nil);型別衝突或全 <code>null</code>→<code>AnyCodable</code>(需自訂或引入套件);撞 Swift 關鍵字的屬性名以反引號包覆。</li>
        <li><strong>不能</strong>:推斷 <code>Date</code> / <code>URL</code> 等語意型別、辨識動態鍵字典。</li>
        <li>全程<strong>在你的瀏覽器</strong>處理,可能含密鑰的回應<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
