<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parseCSV, rowsToObjects, objectsToCSV } from './csv'

/*
  資料轉換工坊 —— CSV ↔ JSON 互轉,純前端、不上傳。
  自製 CSV 解析器正確處理引號/換行;JSON 物件陣列 ↔ 表格。
*/
type Dir = 'csv2json' | 'json2csv'
const dir = ref<Dir>('csv2json')
const input = ref('')
const output = ref('')
const error = ref('')
const copied = ref(false)

const delimiter = ref<','|'\t'|';'>(',')
const hasHeader = ref(true)
const pretty = ref(true)

const delimLabel: Record<string, string> = { ',': '逗號 ,', '\t': 'Tab 定位', ';': '分號 ;' }

function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  const reader = new FileReader()
  reader.onload = () => {
    input.value = String(reader.result ?? '')
    // 依副檔名自動切換方向
    if (f.name.toLowerCase().endsWith('.json')) dir.value = 'json2csv'
    else if (/\.(csv|tsv|txt)$/i.test(f.name)) dir.value = 'csv2json'
    if (f.name.toLowerCase().endsWith('.tsv')) delimiter.value = '\t'
    convert()
  }
  reader.readAsText(f)
  ;(e.target as HTMLInputElement).value = ''
}

function convert() {
  error.value = ''
  output.value = ''
  const text = input.value.trim()
  if (!text) return
  try {
    if (dir.value === 'csv2json') {
      const rows = parseCSV(input.value, delimiter.value)
      const objs = rowsToObjects(rows, hasHeader.value)
      output.value = JSON.stringify(objs, null, pretty.value ? 2 : 0)
    } else {
      const data = JSON.parse(text)
      const arr = Array.isArray(data) ? data : [data]
      if (!arr.every((x) => x && typeof x === 'object' && !Array.isArray(x))) {
        throw new Error('JSON 需為「物件陣列」,例如 [{"name":"小明","age":18}, ...]')
      }
      output.value = objectsToCSV(arr as Record<string, unknown>[], delimiter.value)
    }
  } catch (e) {
    error.value = (dir.value === 'json2csv' ? 'JSON 解析錯誤:' : '轉換錯誤:') + (e as Error).message
  }
}

function setDir(d: Dir) {
  dir.value = d
  convert()
}

async function copyOut() {
  if (!output.value) return
  try {
    await navigator.clipboard.writeText(output.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    error.value = '無法存取剪貼簿,請手動複製。'
  }
}

function download() {
  if (!output.value) return
  const isJson = dir.value === 'csv2json'
  const ext = isJson ? 'json' : delimiter.value === '\t' ? 'tsv' : 'csv'
  const mime = isJson ? 'application/json' : 'text/csv'
  const blob = new Blob([output.value], { type: mime + ';charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '轉換結果.' + ext
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function clearAll() {
  input.value = ''
  output.value = ''
  error.value = ''
}

const rowCount = computed(() => {
  if (!output.value) return 0
  if (dir.value === 'csv2json') {
    try {
      return JSON.parse(output.value).length
    } catch {
      return 0
    }
  }
  return Math.max(0, output.value.split('\n').length - 1)
})
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 sm:p-6 space-y-5">
      <!-- 方向切換 -->
      <div class="grid grid-cols-2 gap-2">
        <button
          class="rounded-xl border px-3 py-3 font-semibold transition"
          :class="dir === 'csv2json' ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-300 text-ink-900' : 'border-line bg-white text-ink-600 hover:bg-stone-50'"
          @click="setDir('csv2json')"
        >📄 CSV → JSON</button>
        <button
          class="rounded-xl border px-3 py-3 font-semibold transition"
          :class="dir === 'json2csv' ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-300 text-ink-900' : 'border-line bg-white text-ink-600 hover:bg-stone-50'"
          @click="setDir('json2csv')"
        >🧾 JSON → CSV</button>
      </div>

      <!-- 選項 -->
      <div class="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
        <label class="flex items-center gap-2">
          <span class="text-ink-600">分隔符</span>
          <select v-model="delimiter" class="rounded-lg border border-line bg-white px-2 py-1.5" @change="convert">
            <option v-for="(lab, val) in delimLabel" :key="val" :value="val">{{ lab }}</option>
          </select>
        </label>
        <label v-if="dir === 'csv2json'" class="flex items-center gap-2">
          <input v-model="hasHeader" type="checkbox" class="accent-brand-600 h-4 w-4" @change="convert" />
          <span class="text-ink-700">第一列是欄位名稱(表頭)</span>
        </label>
        <label v-if="dir === 'csv2json'" class="flex items-center gap-2">
          <input v-model="pretty" type="checkbox" class="accent-brand-600 h-4 w-4" @change="convert" />
          <span class="text-ink-700">JSON 縮排美化</span>
        </label>
      </div>

      <!-- 輸入 -->
      <div>
        <div class="mb-1.5 flex items-center justify-between">
          <label class="field-label !mb-0">貼上{{ dir === 'csv2json' ? ' CSV/TSV' : ' JSON' }} 內容</label>
          <label class="cursor-pointer text-sm text-brand-700 underline">
            或選擇檔案
            <input type="file" accept=".csv,.tsv,.txt,.json" class="hidden" @change="onFile" />
          </label>
        </div>
        <textarea
          v-model="input"
          rows="7"
          spellcheck="false"
          :placeholder="dir === 'csv2json' ? '姓名,年齡\n小明,18\n小華,20' : '[{&quot;姓名&quot;:&quot;小明&quot;,&quot;年齡&quot;:18}]'"
          class="field-input font-mono !text-sm leading-relaxed"
          @input="convert"
        ></textarea>
        <p class="field-hint">資料只在你的瀏覽器處理,不會上傳到任何伺服器。</p>
      </div>

      <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

      <!-- 輸出 -->
      <div v-if="output">
        <div class="mb-1.5 flex items-center justify-between">
          <label class="field-label !mb-0">結果<span class="ml-2 text-sm font-normal text-ink-400">{{ rowCount }} 筆</span></label>
          <div class="flex gap-3 text-sm">
            <button class="text-brand-700 underline" @click="copyOut">{{ copied ? '已複製 ✓' : '複製' }}</button>
            <button class="text-brand-700 underline" @click="download">下載檔案</button>
            <button class="text-ink-400 underline hover:text-red-500" @click="clearAll">清空</button>
          </div>
        </div>
        <textarea :value="output" rows="9" readonly spellcheck="false" class="field-input font-mono !text-sm leading-relaxed bg-stone-50"></textarea>
      </div>
    </div>

    <LegalNote title="為什麼用這個,而不是網路上的免費轉換站?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>不上傳</strong>:名單、訂單、客戶資料等試算表內容全程留在你電腦,不送到陌生伺服器。</li>
        <li><strong>無廣告、免註冊、不限筆數</strong>,完全免費。</li>
        <li>正確處理含逗號、換行、雙引號的欄位(很多簡易轉換器會在這裡出錯)。</li>
        <li>Excel 可「另存新檔 → CSV」後貼上;轉好的 CSV 也能直接用 Excel 開啟。</li>
      </ul>
    </LegalNote>
  </div>
</template>
