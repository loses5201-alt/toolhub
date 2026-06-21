<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import { jsonToJava, type JavaLib, type JavaStyle } from '@/features/jsonToJava'

/*
  JSON → Java —— 貼上 JSON,自動推斷出 Java class 或 record(可選 Jackson / Gson 標註),
  後端 / Android 開發省去手刻。與 json-to-ts / go / python / rust / csharp / kotlin 互補。
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
const lib = ref<JavaLib>('jackson')
const style = ref<JavaStyle>('class')

const libs: { id: JavaLib; label: string }[] = [
  { id: 'jackson', label: 'Jackson' },
  { id: 'gson', label: 'Gson' },
  { id: 'none', label: '無標註' },
]
const styles: { id: JavaStyle; label: string }[] = [
  { id: 'class', label: 'class' },
  { id: 'record', label: 'record' },
]

const result = computed(() =>
  jsonToJava(input.value, {
    lib: lib.value,
    style: style.value,
    rootName: rootName.value.trim() || 'Root',
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
        <label class="field-label" for="jj-in">JSON 內容</label>
        <textarea
          id="jj-in"
          v-model="input"
          rows="11"
          class="field-input font-mono text-xs leading-relaxed"
          spellcheck="false"
        />
        <p class="field-hint">貼上 API 回應或任何 JSON。全程在你的瀏覽器處理,不上傳。</p>
      </div>
      <div class="flex flex-wrap items-end gap-4">
        <div class="sm:w-56">
          <label class="field-label" for="jj-root">根類別名稱</label>
          <input id="jj-root" v-model="rootName" class="field-input" placeholder="Root" />
        </div>
        <div>
          <span class="field-label">樣式</span>
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
        <span class="text-sm font-semibold text-emerald-700">✓ 已產生 Java {{ style === 'record' ? 'record' : 'class' }}</span>
        <button class="ml-auto text-sm text-brand-700 underline hover:text-brand-800" @click="copy">
          {{ copied ? '已複製 ✓' : '複製' }}
        </button>
      </div>
      <pre class="overflow-x-auto rounded-lg bg-ink-900 p-4 text-xs leading-relaxed text-ink-50"><code>{{ result.code }}</code></pre>
      <p class="text-xs text-ink-500">
        一個 <code>.java</code> 檔只能有一個 <code>public</code> 頂層型別,故根類別為 <code>public</code>、其餘為 package-private;若要分檔請各自加上 <code>public</code>。
      </p>
    </div>

    <div class="text-sm text-ink-500">
      也可以轉成
      <RouterLink to="/tools/json-to-kotlin" class="font-semibold text-brand-700 underline hover:text-brand-800">Kotlin</RouterLink>、
      <RouterLink to="/tools/json-to-csharp" class="font-semibold text-brand-700 underline hover:text-brand-800">C#</RouterLink>、
      <RouterLink to="/tools/json-to-go" class="font-semibold text-brand-700 underline hover:text-brand-800">Go</RouterLink>
      或
      <RouterLink to="/tools/json-to-ts" class="font-semibold text-brand-700 underline hover:text-brand-800">TypeScript</RouterLink>
      。
    </div>

    <LegalNote title="這個工具能、不能做什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>能</strong>:從範例 JSON 推斷出 Java <code>class</code> 或 <code>record</code> —— 可選 <strong>Jackson</strong>(<code>@JsonProperty</code>)、<strong>Gson</strong>(<code>@SerializedName</code>)標註;屬性採 camelCase,與原鍵不同時自動加標註;巢狀物件各自成類別、陣列合併欄位。</li>
        <li><strong>型別</strong>:一律用裝箱型別(整數→<code>Long</code>、含小數→<code>Double</code>、布林→<code>Boolean</code>、字串→<code>String</code>),這樣 JSON 缺值或 <code>null</code> 才放得進去;型別衝突或全 <code>null</code>→<code>Object</code>;撞 Java 關鍵字的屬性名補底線並用標註對映原鍵。</li>
        <li><strong>不能</strong>:推斷 <code>BigDecimal</code> / <code>LocalDate</code> 等語意型別、辨識 <code>Map</code> 動態鍵、產生 getter/setter(<code>class</code> 樣式用 public 欄位,可搭配 Lombok 或改用 <code>record</code>)。</li>
        <li>全程<strong>在你的瀏覽器</strong>處理,可能含密鑰的回應<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
