<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parseTable, toCSV, toObjects, type Table } from '@/features/tableClean'
import { splitByRows, splitByColumn, uniqueFileNames, type TablePart } from '@/features/tableSplit'

/*
  表格拆分工坊 —— 載入 CSV/TSV/Excel(或貼上試算表),把一份大表拆成多份:
    1. 按列數平均切(每 N 列一份)
    2. 按某欄的值分組(同值歸一份,檔名 = 該欄值)
  匯出:打包 ZIP(每份一個 CSV/JSON),或單一 Excel(每份一個工作表)。
  全程在瀏覽器,不上傳。
*/
const input = ref('')
const delimiter = ref<',' | '\t' | ';'>(',')
const hasHeader = ref(true)
const error = ref('')
const busy = ref(false)

const mode = ref<'rows' | 'column'>('rows')
const rowsPerPart = ref(100)
const groupCol = ref(0)
const dropKeyColumn = ref(false)
const ignoreCase = ref(false)

const delimLabel: Record<string, string> = { ',': '逗號 ,', '\t': 'Tab 定位', ';': '分號 ;' }

const source = computed<Table>(() => {
  error.value = ''
  if (!input.value.trim()) return { headers: [], rows: [] }
  try {
    return parseTable(input.value, { delimiter: delimiter.value, hasHeader: hasHeader.value })
  } catch (e) {
    error.value = '解析錯誤:' + (e as Error).message
    return { headers: [], rows: [] }
  }
})

const parts = computed<TablePart[]>(() => {
  const t = source.value
  if (t.headers.length === 0) return []
  if (mode.value === 'rows') {
    return splitByRows(t, rowsPerPart.value)
  }
  return splitByColumn(t, Math.min(groupCol.value, t.headers.length - 1), {
    dropKeyColumn: dropKeyColumn.value,
    caseSensitive: !ignoreCase.value,
  })
})

const sourceCount = computed(() => source.value.rows.length)

async function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!f) return
  error.value = ''
  const name = f.name.toLowerCase()
  try {
    if (/\.(xlsx|xls|xlsm)$/i.test(name)) {
      busy.value = true
      const { excelToObjects } = await import('../data-convert/xlsx')
      const objs = excelToObjects(await f.arrayBuffer())
      // 物件陣列 → CSV 文字,交給統一的 parseTable 流程
      const headers = objs.length ? Object.keys(objs[0]) : []
      const grid = [headers, ...objs.map((o) => headers.map((h) => String(o[h] ?? '')))]
      input.value = toCSV({ headers: grid[0], rows: grid.slice(1) })
      delimiter.value = ','
      hasHeader.value = true
    } else {
      if (name.endsWith('.tsv')) delimiter.value = '\t'
      input.value = await f.text()
    }
  } catch (err) {
    error.value = '讀取檔案失敗:' + (err as Error).message
  } finally {
    busy.value = false
  }
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

async function downloadZip(format: 'csv' | 'json') {
  const ps = parts.value
  if (ps.length === 0) return
  busy.value = true
  error.value = ''
  try {
    const { buildZip } = await import('@/features/zipStudio')
    const enc = new TextEncoder()
    const ext = format === 'csv' ? (delimiter.value === '\t' ? 'tsv' : 'csv') : 'json'
    const names = uniqueFileNames(ps, ext)
    const files = ps.map((p, i) => ({
      name: names[i],
      data: enc.encode(
        format === 'csv'
          ? toCSV(p.table, delimiter.value)
          : JSON.stringify(toObjects(p.table), null, 2),
      ),
    }))
    const bytes = await buildZip(files, { level: 6 })
    triggerDownload(new Blob([bytes as BlobPart], { type: 'application/zip' }), '拆分結果.zip')
  } catch (err) {
    error.value = '打包失敗:' + (err as Error).message
  } finally {
    busy.value = false
  }
}

async function downloadExcel() {
  const ps = parts.value
  if (ps.length === 0) return
  busy.value = true
  error.value = ''
  try {
    const { sheetsToExcelBlob } = await import('../data-convert/xlsx')
    const blob = sheetsToExcelBlob(ps.map((p) => ({ name: p.name, records: toObjects(p.table) })))
    triggerDownload(blob, '拆分結果.xlsx')
  } catch (err) {
    error.value = '產生 Excel 失敗:' + (err as Error).message
  } finally {
    busy.value = false
  }
}

function clearAll() {
  input.value = ''
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 sm:p-6 space-y-5">
      <!-- 輸入 -->
      <div>
        <div class="mb-1.5 flex items-center justify-between">
          <label class="field-label !mb-0">貼上 CSV / TSV(或從 Excel、Google 試算表複製整塊貼上)</label>
          <label class="cursor-pointer text-sm text-brand-700 underline">
            或選擇檔案
            <input type="file" accept=".csv,.tsv,.txt,.xlsx,.xls,.xlsm" class="hidden" @change="onFile" />
          </label>
        </div>
        <textarea
          v-model="input"
          rows="6"
          spellcheck="false"
          placeholder="區域,客戶,金額&#10;北區,甲公司,12000&#10;南區,乙公司,9800&#10;北區,丙公司,5400"
          class="field-input font-mono !text-sm leading-relaxed"
        ></textarea>
        <div class="mt-2 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <label class="flex items-center gap-2">
            <span class="text-ink-600">分隔符</span>
            <select v-model="delimiter" class="rounded-lg border border-line bg-white px-2 py-1.5">
              <option v-for="(lab, val) in delimLabel" :key="val" :value="val">{{ lab }}</option>
            </select>
          </label>
          <label class="flex items-center gap-2">
            <input v-model="hasHeader" type="checkbox" class="accent-brand-600 h-4 w-4" />
            <span class="text-ink-700">第一列是欄位名稱(表頭)</span>
          </label>
          <span v-if="sourceCount > 0" class="text-ink-400">讀到 {{ sourceCount }} 列 × {{ source.headers.length }} 欄</span>
        </div>
        <p class="field-hint">資料只在你的瀏覽器處理,不會上傳到任何伺服器。</p>
      </div>

      <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

      <!-- 拆分方式 -->
      <div v-if="source.headers.length > 0" class="space-y-4 rounded-xl border border-line bg-stone-50/60 p-4">
        <p class="text-sm font-semibold text-ink-700">怎麼拆?</p>
        <div class="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <label class="flex items-center gap-2">
            <input v-model="mode" type="radio" value="rows" class="accent-brand-600 h-4 w-4" />
            <span class="text-ink-700">按列數平均切</span>
          </label>
          <label class="flex items-center gap-2">
            <input v-model="mode" type="radio" value="column" class="accent-brand-600 h-4 w-4" />
            <span class="text-ink-700">按某欄的值分組</span>
          </label>
        </div>

        <div v-if="mode === 'rows'" class="flex flex-wrap items-center gap-3 text-sm">
          <span class="text-ink-700">每份</span>
          <input v-model.number="rowsPerPart" type="number" min="1" class="w-24 rounded-lg border border-line bg-white px-2 py-1.5" />
          <span class="text-ink-700">列(不含表頭,表頭會帶進每一份)</span>
        </div>

        <div v-else class="space-y-3 text-sm">
          <div class="flex flex-wrap items-center gap-3">
            <span class="text-ink-700">依</span>
            <select v-model.number="groupCol" class="rounded-lg border border-line bg-white px-2 py-1.5">
              <option v-for="(h, i) in source.headers" :key="i" :value="i">{{ h }}</option>
            </select>
            <span class="text-ink-700">的值分組</span>
          </div>
          <div class="flex flex-wrap gap-x-6 gap-y-2">
            <label class="flex items-center gap-2">
              <input v-model="dropKeyColumn" type="checkbox" class="accent-brand-600 h-4 w-4" />
              <span class="text-ink-700">輸出時移除這一欄</span>
            </label>
            <label class="flex items-center gap-2">
              <input v-model="ignoreCase" type="checkbox" class="accent-brand-600 h-4 w-4" />
              <span class="text-ink-700">忽略英文大小寫</span>
            </label>
          </div>
        </div>
      </div>

      <!-- 結果 -->
      <div v-if="parts.length > 0">
        <div class="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <label class="field-label !mb-0">會拆成 <span class="text-brand-700">{{ parts.length }}</span> 份</label>
          <div class="flex flex-wrap gap-3 text-sm">
            <button :disabled="busy" class="text-brand-700 underline disabled:opacity-50" @click="downloadZip('csv')">下載 ZIP(CSV)</button>
            <button :disabled="busy" class="text-brand-700 underline disabled:opacity-50" @click="downloadZip('json')">下載 ZIP(JSON)</button>
            <button :disabled="busy" class="text-brand-700 underline disabled:opacity-50" @click="downloadExcel">下載 Excel(多工作表)</button>
            <button class="text-ink-400 underline hover:text-red-500" @click="clearAll">清空</button>
          </div>
        </div>
        <div class="overflow-x-auto rounded-xl border border-line">
          <table class="min-w-full text-sm">
            <thead class="bg-stone-100 text-ink-700">
              <tr>
                <th class="px-3 py-2 text-left font-semibold">#</th>
                <th class="px-3 py-2 text-left font-semibold">名稱 / 分組值</th>
                <th class="px-3 py-2 text-right font-semibold">列數</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(p, i) in parts.slice(0, 200)" :key="i" class="border-t border-line/60 odd:bg-white even:bg-stone-50/50">
                <td class="px-3 py-1.5 text-ink-400">{{ i + 1 }}</td>
                <td class="max-w-[22rem] truncate px-3 py-1.5 text-ink-800" :title="p.name">{{ p.name }}</td>
                <td class="px-3 py-1.5 text-right text-ink-700">{{ p.table.rows.length }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="parts.length > 200" class="field-hint">只列出前 200 份,下載會包含全部 {{ parts.length }} 份。</p>
        <p v-if="busy" class="field-hint">處理中,請稍候…</p>
      </div>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>把一份大名單<strong>按每 N 列切成多份</strong>(分批寄送、分派給不同同事、避開上傳筆數限制)。</li>
        <li>或<strong>按某欄的值分組</strong>:例如把全公司訂單依「區域」「業務」「月份」自動拆成各自一份,免一個個篩選複製。</li>
        <li>可一鍵打包成 <strong>ZIP(每份一個 CSV / JSON 檔)</strong>,或匯出成<strong>單一 Excel(每份一個工作表)</strong>。</li>
        <li><strong>不上傳</strong>:含個資的名單全程留在你電腦,不送到陌生伺服器(線上拆分站都要上傳)。</li>
        <li>需要去重、篩選、排序請用「表格清理工坊」;格式互轉(CSV ↔ JSON ↔ Excel)請用「資料轉換工坊」。</li>
      </ul>
    </LegalNote>
  </div>
</template>
