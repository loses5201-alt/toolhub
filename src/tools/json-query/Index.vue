<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { queryJson } from '@/features/jsonQuery'

/*
  JSON 查詢(JSONPath 子集)—— 從又大又深的 API 回應 / 設定 / log 裡用路徑直接撈值。
  API 回應常含 token、個資,不該貼到線上 JSONPath 工具;本工具全程在瀏覽器執行、不上傳。
  邏輯在 src/features/jsonQuery.ts(純函式可測,自刻解析器無 eval)。
*/
const json = ref('')
const path = ref('$.store.book[*].title')
const copied = ref(false)

const result = computed(() => queryJson(json.value, path.value))

// 只有兩個輸入都有內容時才顯示「查無」狀態,避免一開始就跳紅字
const showResult = computed(() => json.value.trim() !== '' && path.value.trim() !== '')

const examples: { label: string; path: string }[] = [
  { label: '所有書名', path: '$.store.book[*].title' },
  { label: '所有作者(遞迴)', path: '$..author' },
  { label: '所有價格', path: '$.store..price' },
  { label: '便宜的書(<10)', path: '$.store.book[?(@.price < 10)]' },
  { label: '小說類', path: '$.store.book[?(@.category == "fiction")]' },
  { label: '最後一本', path: '$.store.book[-1]' },
]

function fillSample() {
  json.value = JSON.stringify(
    {
      store: {
        book: [
          { category: 'reference', author: 'Nigel Rees', title: 'Sayings of the Century', price: 8.95 },
          { category: 'fiction', author: 'Evelyn Waugh', title: 'Sword of Honour', price: 12.99 },
          { category: 'fiction', author: 'Herman Melville', title: 'Moby Dick', isbn: '0-553-21311-3', price: 8.99 },
          { category: 'fiction', author: 'J. R. R. Tolkien', title: 'The Lord of the Rings', price: 22.99 },
        ],
        bicycle: { color: 'red', price: 19.95 },
      },
    },
    null,
    2,
  )
  path.value = '$.store.book[*].title'
}

async function copyOut() {
  if (!result.value.ok || !result.value.output) return
  try {
    await navigator.clipboard.writeText(result.value.output)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    /* 忽略 */
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 sm:p-6 space-y-5">
      <div>
        <div class="flex items-center justify-between gap-2">
          <label class="field-label !mb-0">貼上 JSON</label>
          <button class="text-xs text-brand-600 underline hover:text-brand-700" @click="fillSample">
            填入範例
          </button>
        </div>
        <textarea
          v-model="json"
          rows="9"
          spellcheck="false"
          class="field-input mt-1 font-mono text-sm"
          placeholder='{ "store": { "book": [ ... ] } }'
        ></textarea>
      </div>

      <div>
        <label class="field-label" for="jq-path">查詢路徑</label>
        <input
          id="jq-path"
          v-model="path"
          spellcheck="false"
          class="field-input font-mono text-sm"
          placeholder="$.store.book[*].title"
        />
        <div class="mt-2 flex flex-wrap gap-1.5">
          <button
            v-for="ex in examples"
            :key="ex.path"
            type="button"
            class="rounded-full border border-line bg-white px-2.5 py-1 text-xs text-ink-600 hover:border-brand-300 hover:text-brand-700"
            @click="path = ex.path"
          >
            {{ ex.label }}
          </button>
        </div>
      </div>

      <template v-if="showResult">
        <p
          v-if="!result.ok"
          class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 whitespace-pre-wrap"
        >
          {{ result.error }}
        </p>
        <div v-else>
          <div class="flex items-center justify-between gap-2">
            <label class="field-label !mb-0">
              結果
              <span class="ml-1 font-normal text-ink-500">({{ result.count }} 筆)</span>
            </label>
            <button
              v-if="result.count > 0"
              class="text-xs text-brand-600 underline hover:text-brand-700"
              @click="copyOut"
            >
              {{ copied ? '已複製 ✓' : '複製' }}
            </button>
          </div>
          <p v-if="result.count === 0" class="mt-1 rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-500">
            查無符合此路徑的值。
          </p>
          <pre
            v-else
            class="mt-1 max-h-96 overflow-auto rounded-xl border border-line bg-ink-50 p-3 text-sm font-mono whitespace-pre-wrap break-words text-ink-800"
          >{{ result.output }}</pre>
        </div>
      </template>
    </div>

    <LegalNote title="支援哪些語法?為什麼用這個?">
      <ul class="list-disc pl-5 space-y-1">
        <li>
          <strong>不上傳</strong>:API 回應、設定檔常含 token、金鑰、個資,貼到線上 JSONPath
          工具等於把機密送上陌生伺服器;這支全程在你瀏覽器執行,且自刻解析器、不用 <code>eval</code>。
        </li>
        <li>
          <strong>路徑語法</strong>:<code>$.a.b</code>、<code>["含 空白的鍵"]</code>、<code>[0]</code>/<code>[-1]</code>(負數由尾算)、
          <code>[*]</code> 或 <code>*</code>(全部)、<code>..</code>(任意深度遞迴)、<code>[1:3]</code> 切片。
        </li>
        <li>
          <strong>過濾器</strong>:<code>[?(@.price &lt; 10)]</code>、<code>[?(@.category == "fiction")]</code>,
          運算子 <code>== != &lt; &lt;= &gt; &gt;=</code>,或只寫 <code>[?(@.isbn)]</code> 表示「該欄位存在」。
        </li>
        <li>
          目前<strong>不支援</strong>過濾器的 <code>&amp;&amp;</code> / <code>||</code>、聯集 <code>[a,b]</code> 與運算式函式
          —— 這是刻意收斂的可測子集,複雜查詢請拆成多步。
        </li>
      </ul>
    </LegalNote>
  </div>
</template>
