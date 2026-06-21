<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import { jsonToKotlin, type KtLib } from '@/features/jsonToKotlin'

/*
  JSON → Kotlin —— 貼上 JSON,自動推斷出 Kotlin data class(可選 kotlinx.serialization / Gson / Moshi 標註),
  Android / 後端開發省去手刻。與 json-to-ts / go / python / rust / csharp 互補。
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
const lib = ref<KtLib>('kotlinx')

const libs: { id: KtLib; label: string }[] = [
  { id: 'kotlinx', label: 'kotlinx' },
  { id: 'gson', label: 'Gson' },
  { id: 'moshi', label: 'Moshi' },
  { id: 'none', label: '無標註' },
]

const result = computed(() =>
  jsonToKotlin(input.value, { lib: lib.value, rootName: rootName.value.trim() || 'Root' }),
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
        <label class="field-label" for="jk-in">JSON 內容</label>
        <textarea
          id="jk-in"
          v-model="input"
          rows="11"
          class="field-input font-mono text-xs leading-relaxed"
          spellcheck="false"
        />
        <p class="field-hint">貼上 API 回應或任何 JSON。全程在你的瀏覽器處理,不上傳。</p>
      </div>
      <div class="flex flex-wrap items-end gap-4">
        <div class="sm:w-56">
          <label class="field-label" for="jk-root">根類別名稱</label>
          <input id="jk-root" v-model="rootName" class="field-input" placeholder="Root" />
        </div>
        <div>
          <span class="field-label">序列化標註</span>
          <div class="inline-flex rounded-lg border border-ink-200 p-0.5 text-sm">
            <button
              v-for="l in libs"
              :key="l.id"
              type="button"
              class="rounded-md px-3 py-1 transition"
              :class="lib === l.id ? 'bg-brand-600 text-white' : 'text-ink-600'"
              @click="lib = l.id"
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
        <span class="text-sm font-semibold text-emerald-700">✓ 已產生 Kotlin data class</span>
        <button class="ml-auto text-sm text-brand-700 underline hover:text-brand-800" @click="copy">
          {{ copied ? '已複製 ✓' : '複製' }}
        </button>
      </div>
      <pre class="overflow-x-auto rounded-lg bg-ink-900 p-4 text-xs leading-relaxed text-ink-50"><code>{{ result.code }}</code></pre>
    </div>

    <div class="text-sm text-ink-500">
      也可以轉成
      <RouterLink to="/tools/json-to-ts" class="font-semibold text-brand-700 underline hover:text-brand-800">TypeScript</RouterLink>、
      <RouterLink to="/tools/json-to-csharp" class="font-semibold text-brand-700 underline hover:text-brand-800">C#</RouterLink>、
      <RouterLink to="/tools/json-to-rust" class="font-semibold text-brand-700 underline hover:text-brand-800">Rust</RouterLink>
      或
      <RouterLink to="/tools/json-to-python" class="font-semibold text-brand-700 underline hover:text-brand-800">Python</RouterLink>
      。
    </div>

    <LegalNote title="這個工具能、不能做什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>能</strong>:從範例 JSON 推斷出 Kotlin <code>data class</code> —— 可選 <strong>kotlinx.serialization</strong>(<code>@SerialName</code>)、<strong>Gson</strong>(<code>@SerializedName</code>)、<strong>Moshi</strong>(<code>@Json</code>)標註;屬性採 camelCase,與原鍵不同時自動加標註;巢狀物件各自成類別、陣列合併欄位。</li>
        <li><strong>型別</strong>:整數→<code>Long</code>、含小數→<code>Double</code>、<code>null</code> 或缺鍵→可空 <code>T? = null</code>、型別衝突或全 <code>null</code>→<code>Any</code>;撞 Kotlin 關鍵字的屬性名以反引號包覆。</li>
        <li><strong>不能</strong>:推斷 <code>Date</code> / <code>BigDecimal</code> 等語意型別、辨識 <code>Map</code> 動態鍵。</li>
        <li>全程<strong>在你的瀏覽器</strong>處理,可能含密鑰的回應<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
