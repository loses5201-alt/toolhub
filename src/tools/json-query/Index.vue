<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import { evaluate } from '@/features/jsonPath'

/*
  JSONPath 查詢 —— 用路徑運算式($.store.book[?(@.price<10)].title)從一大包 JSON 裡
  精準撈出要的欄位、過濾陣列、跨層級蒐集。整理 API 回應、設定檔、log 最好用。
  全程在你的瀏覽器計算,可能含密鑰的資料不連網、不上傳。
*/

const json = ref(`{
  "store": {
    "book": [
      { "category": "reference", "author": "Nigel Rees", "title": "Sayings of the Century", "price": 8.95 },
      { "category": "fiction", "author": "Evelyn Waugh", "title": "Sword of Honour", "price": 12.99 },
      { "category": "fiction", "author": "Herman Melville", "title": "Moby Dick", "isbn": "0-553-21311-3", "price": 8.99 },
      { "category": "fiction", "author": "J. R. R. Tolkien", "title": "The Lord of the Rings", "price": 22.99 }
    ],
    "bicycle": { "color": "red", "price": 19.95 }
  }
}`)
const path = ref('$.store.book[?(@.price < 10)].title')

const examples: { label: string; expr: string }[] = [
  { label: '所有書名', expr: '$.store.book[*].title' },
  { label: '所有作者(遞迴)', expr: '$..author' },
  { label: '所有價格', expr: '$..price' },
  { label: '便宜的書(<10)', expr: '$.store.book[?(@.price < 10)].title' },
  { label: '有 ISBN 的書', expr: '$.store.book[?(@.isbn)]' },
  { label: '前兩本', expr: '$.store.book[:2].title' },
  { label: '最後一本', expr: '$.store.book[-1]' },
  { label: 'AND 條件', expr: "$.store.book[?(@.price < 10 && @.category == 'fiction')].title" },
]

const result = computed(() => evaluate(json.value, path.value))

const valuesText = computed(() => {
  if (!result.value.ok) return ''
  return JSON.stringify(
    result.value.matches.map((m) => m.value),
    null,
    2,
  )
})

const copied = ref(false)
function copy() {
  if (!valuesText.value) return
  navigator.clipboard?.writeText(valuesText.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

function preview(v: unknown): string {
  const s = JSON.stringify(v)
  if (s === undefined) return String(v)
  return s.length > 120 ? s.slice(0, 117) + '…' : s
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label" for="jq-json">貼上 JSON</label>
        <textarea
          id="jq-json"
          v-model="json"
          rows="10"
          class="field-input font-mono text-xs leading-relaxed"
          spellcheck="false"
        />
      </div>
      <div>
        <label class="field-label" for="jq-path">JSONPath 路徑</label>
        <input
          id="jq-path"
          v-model="path"
          class="field-input font-mono text-sm"
          spellcheck="false"
          placeholder="$.store.book[?(@.price < 10)].title"
        />
        <p class="field-hint">
          <code>$</code> 根、<code>.key</code> / <code>['key']</code>、<code>[0]</code> / <code>[-1]</code>、<code>[*]</code>、<code>[1:3]</code> 切片、<code>..</code> 遞迴、<code>[?(@.x &gt; 1)]</code> 過濾。全程在你瀏覽器,不上傳。
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="ex in examples"
          :key="ex.expr"
          type="button"
          class="rounded-full border border-ink-200 px-3 py-1 text-xs text-ink-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
          @click="path = ex.expr"
        >
          {{ ex.label }}
        </button>
      </div>
    </div>

    <div
      v-if="!result.ok"
      class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800"
    >
      ⚠️ {{ result.error }}
    </div>

    <div v-else class="card p-4 space-y-3">
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold" :class="result.matches.length ? 'text-emerald-700' : 'text-ink-500'">
          {{ result.matches.length ? `命中 ${result.matches.length} 筆` : '沒有符合的結果' }}
        </span>
        <button
          v-if="result.matches.length"
          class="ml-auto text-sm text-brand-700 underline hover:text-brand-800"
          @click="copy"
        >
          {{ copied ? '已複製 ✓' : '複製值(JSON 陣列)' }}
        </button>
      </div>

      <div v-if="result.matches.length" class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="border-b border-ink-200 text-ink-500">
              <th class="py-1.5 pr-3 font-medium">#</th>
              <th class="py-1.5 pr-3 font-medium">路徑</th>
              <th class="py-1.5 font-medium">值</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(m, i) in result.matches" :key="i" class="border-b border-ink-100 align-top">
              <td class="py-1.5 pr-3 text-ink-400">{{ i + 1 }}</td>
              <td class="py-1.5 pr-3 font-mono text-brand-700">{{ m.path }}</td>
              <td class="py-1.5 font-mono text-ink-700 break-all">{{ preview(m.value) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="result.matches.length">
        <label class="field-label">擷取出的值</label>
        <pre class="overflow-x-auto rounded-lg bg-ink-900 p-4 text-xs leading-relaxed text-ink-50"><code>{{ valuesText }}</code></pre>
      </div>
    </div>

    <div class="text-sm text-ink-500">
      想反過來把 JSON 修成標準格式或攤平?用
      <RouterLink to="/tools/json-repair" class="font-semibold text-brand-700 underline hover:text-brand-800">JSON 修復</RouterLink>
      、
      <RouterLink to="/tools/json-flatten" class="font-semibold text-brand-700 underline hover:text-brand-800">JSON 攤平</RouterLink>
      或
      <RouterLink to="/tools/json-diff" class="font-semibold text-brand-700 underline hover:text-brand-800">JSON 比對</RouterLink>
      。
    </div>

    <LegalNote title="這個工具能、不能做什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>能</strong>:用 JSONPath 從巢狀 JSON 撈值 —— <code>$</code> 根、<code>.key</code> 與 <code>['key']</code>(鍵含特殊字元用後者)、陣列 <code>[0]</code> / 負數 <code>[-1]</code>、萬用 <code>[*]</code>、切片 <code>[start:end:step]</code>、遞迴下降 <code>..</code>。</li>
        <li><strong>能</strong>:陣列過濾 <code>[?(...)]</code> —— 支援 <code>== != &lt; &lt;= &gt; &gt;=</code>、<code>&amp;&amp;</code> / <code>||</code>、<code>@</code> 相對路徑,以及字串、數字、<code>true/false/null</code> 字面值。可同時看到每筆的<strong>正規化路徑</strong>。</li>
        <li><strong>不能</strong>:正則過濾(<code>=~</code>)、運算式函式(<code>length()</code> 等)、括號分組優先序等進階語法尚未支援。</li>
        <li>全程<strong>在你的瀏覽器</strong>計算,內容<strong>不連網、不上傳</strong>,可放心查含敏感欄位的資料。</li>
      </ul>
    </LegalNote>
  </div>
</template>
