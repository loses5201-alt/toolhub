<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parseCSV, rowsToObjects, objectsToCSV } from './csv'

/*
  資料轉換工坊 —— CSV / JSON / Excel 三者互轉,純前端、不上傳。
  CSV 用自製解析器(正確處理引號/換行),Excel 用 SheetJS(動態載入,不拖累首頁)。
  所有格式都先轉成「物件陣列」當中介,再輸出成目標格式。
*/
type Fmt = 'csv' | 'json' | 'excel'
const fmtMeta: Record<Fmt, { label: string; icon: string }> = {
  csv: { label: 'CSV / TSV', icon: '📄' },
  json: { label: 'JSON', icon: '🧾' },
  excel: { label: 'Excel', icon: '📊' },
}
const fmtList = Object.keys(fmtMeta) as Fmt[]

const from = ref<Fmt>('csv')
const to = ref<Fmt>('json')

const input = ref('') // csv/json 的文字輸入
const excelBuf = ref<ArrayBuffer | null>(null) // excel 的二進位輸入
const excelName = ref('')

const output = ref('') // csv/json 的文字輸出
const excelBlob = ref<Blob | null>(null) // excel 的二進位輸出
const recordCount = ref(0)
const error = ref('')
const copied = ref(false)

const delimiter = ref<',' | '\t' | ';'>(',')
const hasHeader = ref(true)
const pretty = ref(true)

const delimLabel: Record<string, string> = { ',': '逗號 ,', '\t': 'Tab 定位', ';': '分號 ;' }
const showDelim = computed(() => from.value === 'csv' || to.value === 'csv')

/** 把目前的來源資料解析成物件陣列(統一中介格式) */
async function readRecords(): Promise<Record<string, unknown>[]> {
  if (from.value === 'excel') {
    if (!excelBuf.value) return []
    const { excelToObjects } = await import('./xlsx')
    return excelToObjects(excelBuf.value)
  }
  const text = input.value.trim()
  if (!text) return []
  if (from.value === 'csv') {
    const rows = parseCSV(input.value, delimiter.value)
    return rowsToObjects(rows, hasHeader.value)
  }
  const data = JSON.parse(text)
  const arr = Array.isArray(data) ? data : [data]
  if (!arr.every((x) => x && typeof x === 'object' && !Array.isArray(x))) {
    throw new Error('JSON 需為「物件陣列」,例如 [{"name":"小明","age":18}, ...]')
  }
  return arr as Record<string, unknown>[]
}

async function convert() {
  error.value = ''
  output.value = ''
  excelBlob.value = null
  recordCount.value = 0
  try {
    const records = await readRecords()
    if (!records.length) return
    recordCount.value = records.length
    if (to.value === 'json') {
      output.value = JSON.stringify(records, null, pretty.value ? 2 : 0)
    } else if (to.value === 'csv') {
      output.value = objectsToCSV(records, delimiter.value)
    } else {
      const { objectsToExcelBlob } = await import('./xlsx')
      excelBlob.value = objectsToExcelBlob(records)
    }
  } catch (e) {
    error.value = (from.value === 'json' ? 'JSON 解析錯誤:' : '轉換錯誤:') + (e as Error).message
  }
}

function setFrom(f: Fmt) {
  from.value = f
  if (to.value === f) to.value = fmtList.find((x) => x !== f)!
  convert()
}
function setTo(t: Fmt) {
  to.value = t
  if (from.value === t) from.value = fmtList.find((x) => x !== t)!
  convert()
}

async function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!f) return
  const name = f.name.toLowerCase()
  if (/\.(xlsx|xls|xlsm)$/i.test(name)) {
    from.value = 'excel'
    if (to.value === 'excel') to.value = 'json'
    excelBuf.value = await f.arrayBuffer()
    excelName.value = f.name
    input.value = ''
  } else {
    from.value = name.endsWith('.json') ? 'json' : 'csv'
    if (to.value === from.value) to.value = from.value === 'json' ? 'csv' : 'json'
    if (name.endsWith('.tsv')) delimiter.value = '\t'
    input.value = await f.text()
  }
  convert()
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function download() {
  if (to.value === 'excel') {
    if (excelBlob.value) triggerDownload(excelBlob.value, '轉換結果.xlsx')
    return
  }
  if (!output.value) return
  const ext = to.value === 'json' ? 'json' : delimiter.value === '\t' ? 'tsv' : 'csv'
  const mime = to.value === 'json' ? 'application/json' : 'text/csv'
  const blob = new Blob([output.value], { type: mime + ';charset=utf-8' })
  triggerDownload(blob, '轉換結果.' + ext)
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

function clearAll() {
  input.value = ''
  output.value = ''
  excelBuf.value = null
  excelName.value = ''
  excelBlob.value = null
  error.value = ''
  recordCount.value = 0
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 sm:p-6 space-y-5">
      <!-- 格式選擇:來源 → 目標 -->
      <div class="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <div>
          <label class="field-label">來源格式</label>
          <div class="grid grid-cols-3 gap-1.5">
            <button
              v-for="f in fmtList"
              :key="'from-' + f"
              class="rounded-lg border px-2 py-2.5 text-sm font-semibold transition"
              :class="from === f ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-300 text-ink-900' : 'border-line bg-white text-ink-600 hover:bg-stone-50'"
              @click="setFrom(f)"
            >{{ fmtMeta[f].icon }} {{ fmtMeta[f].label }}</button>
          </div>
        </div>
        <div class="hidden pb-2.5 text-2xl text-ink-300 sm:block">→</div>
        <div>
          <label class="field-label">轉換成</label>
          <div class="grid grid-cols-3 gap-1.5">
            <button
              v-for="t in fmtList"
              :key="'to-' + t"
              class="rounded-lg border px-2 py-2.5 text-sm font-semibold transition"
              :class="to === t ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-300 text-ink-900' : 'border-line bg-white text-ink-600 hover:bg-stone-50'"
              @click="setTo(t)"
            >{{ fmtMeta[t].icon }} {{ fmtMeta[t].label }}</button>
          </div>
        </div>
      </div>

      <!-- 選項 -->
      <div class="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
        <label v-if="showDelim" class="flex items-center gap-2">
          <span class="text-ink-600">CSV 分隔符</span>
          <select v-model="delimiter" class="rounded-lg border border-line bg-white px-2 py-1.5" @change="convert">
            <option v-for="(lab, val) in delimLabel" :key="val" :value="val">{{ lab }}</option>
          </select>
        </label>
        <label v-if="from === 'csv'" class="flex items-center gap-2">
          <input v-model="hasHeader" type="checkbox" class="accent-brand-600 h-4 w-4" @change="convert" />
          <span class="text-ink-700">第一列是欄位名稱(表頭)</span>
        </label>
        <label v-if="to === 'json'" class="flex items-center gap-2">
          <input v-model="pretty" type="checkbox" class="accent-brand-600 h-4 w-4" @change="convert" />
          <span class="text-ink-700">JSON 縮排美化</span>
        </label>
      </div>

      <!-- 輸入 -->
      <div>
        <div class="mb-1.5 flex items-center justify-between">
          <label class="field-label !mb-0">{{ from === 'excel' ? '選擇 Excel 檔' : '貼上 ' + fmtMeta[from].label + ' 內容' }}</label>
          <label class="cursor-pointer text-sm text-brand-700 underline">
            {{ from === 'excel' ? '重新選擇檔案' : '或選擇檔案' }}
            <input type="file" accept=".csv,.tsv,.txt,.json,.xlsx,.xls,.xlsm" class="hidden" @change="onFile" />
          </label>
        </div>

        <div v-if="from === 'excel'">
          <label class="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-line bg-stone-50 px-4 py-8 text-center transition hover:border-brand-300 hover:bg-brand-50/40">
            <input type="file" accept=".xlsx,.xls,.xlsm" class="hidden" @change="onFile" />
            <span class="text-3xl">📊</span>
            <span class="mt-2 font-semibold text-ink-800">{{ excelName || '點此選擇 Excel 檔(.xlsx / .xls)' }}</span>
            <span class="mt-1 text-sm text-ink-500">讀取第一個工作表,以第一列當欄位名稱</span>
          </label>
        </div>
        <textarea
          v-else
          v-model="input"
          rows="7"
          spellcheck="false"
          :placeholder="from === 'csv' ? '姓名,年齡\n小明,18\n小華,20' : '[{&quot;姓名&quot;:&quot;小明&quot;,&quot;年齡&quot;:18}]'"
          class="field-input font-mono !text-sm leading-relaxed"
          @input="convert"
        ></textarea>
        <p class="field-hint">資料只在你的瀏覽器處理,不會上傳到任何伺服器。</p>
      </div>

      <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

      <!-- 輸出 -->
      <div v-if="recordCount > 0">
        <div class="mb-1.5 flex items-center justify-between">
          <label class="field-label !mb-0">結果<span class="ml-2 text-sm font-normal text-ink-400">{{ recordCount }} 筆</span></label>
          <div class="flex gap-3 text-sm">
            <button v-if="to !== 'excel'" class="text-brand-700 underline" @click="copyOut">{{ copied ? '已複製 ✓' : '複製' }}</button>
            <button class="text-brand-700 underline" @click="download">下載{{ to === 'excel' ? ' Excel' : '檔案' }}</button>
            <button class="text-ink-400 underline hover:text-red-500" @click="clearAll">清空</button>
          </div>
        </div>
        <div v-if="to === 'excel'" class="rounded-xl border border-line bg-stone-50 px-4 py-6 text-center">
          <span class="text-3xl">📊</span>
          <p class="mt-2 font-semibold text-ink-800">已轉換 {{ recordCount }} 筆資料</p>
          <button class="mt-3 rounded-lg bg-brand-600 px-5 py-2.5 font-semibold text-white transition hover:bg-brand-700" @click="download">下載 Excel(.xlsx)</button>
        </div>
        <textarea v-else :value="output" rows="9" readonly spellcheck="false" class="field-input font-mono !text-sm leading-relaxed bg-stone-50"></textarea>
      </div>
    </div>

    <LegalNote title="為什麼用這個,而不是網路上的免費轉換站?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>不上傳</strong>:名單、訂單、客戶資料、Excel 試算表全程留在你電腦,不送到陌生伺服器。</li>
        <li><strong>無廣告、免註冊、不限筆數</strong>,完全免費。</li>
        <li>Excel 直接讀寫 <code>.xlsx</code>,免「另存成 CSV」這一步;也正確處理含逗號、換行、雙引號的欄位。</li>
        <li>Excel 讀取第一個工作表、以第一列為欄位名稱;轉出的 .xlsx 可直接用 Excel / Google 試算表開啟。</li>
      </ul>
    </LegalNote>
  </div>
</template>
