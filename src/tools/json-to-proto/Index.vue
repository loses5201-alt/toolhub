<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import { jsonToProto } from '@/features/jsonToProto'

/*
  JSON → Protobuf —— 貼上 JSON,自動推斷出 proto3 message 定義,省去手刻 .proto。
  整數→int64、含小數→double、布林→bool、字串→string、物件→巢狀 message、陣列→repeated。
  與 json-to-ts / go / python / rust / csharp / kotlin / java / swift / dart 互補。全程在你的瀏覽器處理,不上傳。
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
const packageName = ref('')

const result = computed(() =>
  jsonToProto(input.value, {
    rootName: rootName.value.trim() || 'Root',
    packageName: packageName.value.trim(),
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
      <div class="flex flex-wrap gap-4">
        <div class="sm:w-56">
          <label class="field-label" for="jp-root">根 message 名稱</label>
          <input id="jp-root" v-model="rootName" class="field-input" placeholder="Root" />
        </div>
        <div class="sm:w-56">
          <label class="field-label" for="jp-pkg">package(選填)</label>
          <input id="jp-pkg" v-model="packageName" class="field-input" placeholder="my.api.v1" />
        </div>
      </div>
    </div>

    <div v-if="!result.ok" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
      ⚠️ {{ result.error }}
    </div>

    <div v-else class="card p-4 space-y-2">
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-emerald-700">✓ 已產生 proto3 定義</span>
        <button class="ml-auto text-sm text-brand-700 underline hover:text-brand-800" @click="copy">
          {{ copied ? '已複製 ✓' : '複製' }}
        </button>
      </div>
      <pre class="overflow-x-auto rounded-lg bg-ink-900 p-4 text-xs leading-relaxed text-ink-50"><code>{{ result.code }}</code></pre>
    </div>

    <div class="text-sm text-ink-500">
      也可以轉成
      <RouterLink to="/tools/json-to-go" class="font-semibold text-brand-700 underline hover:text-brand-800">Go</RouterLink>、
      <RouterLink to="/tools/json-to-dart" class="font-semibold text-brand-700 underline hover:text-brand-800">Dart</RouterLink>、
      <RouterLink to="/tools/json-to-rust" class="font-semibold text-brand-700 underline hover:text-brand-800">Rust</RouterLink>
      或
      <RouterLink to="/tools/json-to-ts" class="font-semibold text-brand-700 underline hover:text-brand-800">TypeScript</RouterLink>
      。
    </div>

    <LegalNote title="這個工具能、不能做什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>能</strong>:從範例 JSON 推斷出 proto3 <code>message</code> 定義 —— 欄位採 snake_case 並依序編號;巢狀物件各自成 message、陣列轉 <code>repeated</code>。snake_case 與原鍵不同時自動補 <code>[json_name = "..."]</code>。</li>
        <li><strong>型別</strong>:整數→<code>int64</code>、含小數→<code>double</code>(整數與小數混用也→<code>double</code>)、布林→<code>bool</code>、字串→<code>string</code>;型別衝突或全 <code>null</code>→<code>google.protobuf.Value</code>(自動加 <code>import</code>)。proto3 欄位皆為 optional 語意(無 required),故 <code>null</code> / 缺鍵不影響型別。</li>
        <li><strong>陣列的陣列</strong>:proto3 不允許 <code>repeated repeated</code>,自動產生 wrapper message(欄位 <code>values</code>)維持合法。</li>
        <li><strong>不能</strong>:推斷 <code>enum</code>、<code>map&lt;k,v&gt;</code>、<code>oneof</code>、timestamp 等語意型別;欄位編號僅供起點,正式 schema 演進請固定編號。</li>
        <li>全程<strong>在你的瀏覽器</strong>處理,可能含密鑰的回應<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
