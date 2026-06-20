<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import { ndjsonToArray, arrayToNdjson, validateLines, tidyNdjson } from '@/features/ndjson'

/*
  NDJSON / JSON Lines 工具 —— 在「每行一個 JSON」(log、資料匯出、ML 資料集)與「JSON 陣列」
  之間互轉,並逐行指出哪一行壞掉(一般編輯器看不出來)。全程在你瀏覽器,不上傳。
*/

type Mode = 'to-array' | 'to-ndjson'
const mode = ref<Mode>('to-array')

const ndjsonSample = `{"id":1,"name":"小明","active":true}
{"id":2,"name":"小華","active":false}
{"id":3,"name":"小美","active":true}`
const arraySample = `[
  {"id":1,"name":"小明","active":true},
  {"id":2,"name":"小華","active":false}
]`

const input = ref(ndjsonSample)

function switchMode(next: Mode) {
  if (next === mode.value) return
  mode.value = next
  input.value = next === 'to-array' ? ndjsonSample : arraySample
}

const result = computed(() => {
  if (mode.value === 'to-array') {
    const r = ndjsonToArray(input.value)
    return { ok: r.ok, output: r.json ?? '', error: r.error ?? '', errors: r.errors, count: r.count }
  }
  const r = arrayToNdjson(input.value)
  return { ok: r.ok, output: r.ndjson ?? '', error: r.error ?? '', errors: [], count: r.count }
})

// to-array 模式時逐行燈號
const lineStatuses = computed(() =>
  mode.value === 'to-array' ? validateLines(input.value).filter((l) => !l.blank) : [],
)
const badLines = computed(() => lineStatuses.value.filter((l) => !l.ok))

const copied = ref(false)
function copy() {
  if (!result.value.output) return
  navigator.clipboard?.writeText(result.value.output)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

function tidy() {
  const r = tidyNdjson(input.value)
  if (r.ok && r.json !== undefined) input.value = r.json
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div class="inline-flex rounded-lg border border-ink-200 p-0.5 text-sm">
        <button
          type="button"
          class="rounded-md px-3 py-1 transition"
          :class="mode === 'to-array' ? 'bg-brand-600 text-white' : 'text-ink-600'"
          @click="switchMode('to-array')"
        >
          NDJSON → JSON 陣列
        </button>
        <button
          type="button"
          class="rounded-md px-3 py-1 transition"
          :class="mode === 'to-ndjson' ? 'bg-brand-600 text-white' : 'text-ink-600'"
          @click="switchMode('to-ndjson')"
        >
          JSON 陣列 → NDJSON
        </button>
      </div>

      <div>
        <div class="flex items-center justify-between">
          <label class="field-label" for="nd-in">{{ mode === 'to-array' ? '貼上 NDJSON(每行一個 JSON)' : '貼上 JSON 陣列' }}</label>
          <button
            v-if="mode === 'to-array'"
            type="button"
            class="text-xs text-brand-700 underline hover:text-brand-800"
            @click="tidy"
          >
            整理(去空白行)
          </button>
        </div>
        <textarea
          id="nd-in"
          v-model="input"
          rows="9"
          class="field-input font-mono text-xs leading-relaxed"
          spellcheck="false"
        />
        <p class="field-hint">全程在你的瀏覽器處理,內容不連網、不上傳。</p>
      </div>
    </div>

    <div
      v-if="!result.ok"
      class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800 space-y-1"
    >
      <div>⚠️ {{ result.error }}</div>
      <ul v-if="result.errors.length" class="list-disc pl-5">
        <li v-for="e in result.errors" :key="e.line">第 {{ e.line }} 行:{{ e.message }}</li>
      </ul>
    </div>

    <div v-else class="card p-4 space-y-2">
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-emerald-700">
          ✓ {{ mode === 'to-array' ? `${result.count} 筆 → JSON 陣列` : `JSON 陣列 → ${result.count} 行 NDJSON` }}
        </span>
        <button class="ml-auto text-sm text-brand-700 underline hover:text-brand-800" @click="copy">
          {{ copied ? '已複製 ✓' : '複製' }}
        </button>
      </div>
      <pre class="overflow-x-auto rounded-lg bg-ink-900 p-4 text-xs leading-relaxed text-ink-50"><code>{{ result.output }}</code></pre>
    </div>

    <div
      v-if="mode === 'to-array' && badLines.length"
      class="text-xs text-ink-500"
    >
      共 {{ lineStatuses.length }} 行,其中 {{ badLines.length }} 行有問題(行號見上方)。
    </div>

    <div class="text-sm text-ink-500">
      需要 JSON ↔ CSV / Excel?用
      <RouterLink to="/tools/data-convert" class="font-semibold text-brand-700 underline hover:text-brand-800">資料轉換工坊</RouterLink>
      ;想從 JSON 撈特定欄位?用
      <RouterLink to="/tools/json-query" class="font-semibold text-brand-700 underline hover:text-brand-800">JSONPath 查詢</RouterLink>
      。
    </div>

    <LegalNote title="這個工具能、不能做什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>能</strong>:把 <strong>NDJSON / JSON Lines</strong>(每行一個 JSON,常見於 log、資料匯出、ML 資料集、串流 API)轉成 JSON 陣列,或反向把 JSON 陣列拆成每行一筆。</li>
        <li><strong>能</strong>:轉換失敗時<strong>逐行指出哪一行壞掉、行號與錯誤訊息</strong>(一般文字編輯器看不出來);可一鍵「整理」去掉空白行。</li>
        <li><strong>注意</strong>:NDJSON 每行必須是完整、單行的 JSON;轉成 NDJSON 時每個元素會壓成單行(不換行)。最外層需為陣列才能轉 NDJSON。</li>
        <li>全程<strong>在你的瀏覽器</strong>處理,內容<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
