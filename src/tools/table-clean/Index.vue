<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  parseTable,
  trimAll,
  dropEmptyRows,
  dedupeRows,
  filterRows,
  sortRows,
  selectColumns,
  toCSV,
  toObjects,
  type Table,
  type FilterOp,
} from '@/features/tableClean'

/*
  表格清理工坊 —— 載入 CSV/TSV(或貼上試算表),做去空白、刪空列、去重複、
  篩選、排序、選欄,再輸出 CSV/JSON。全程在瀏覽器,不上傳。
  管線固定順序:trim → 刪空列 → 去重 → 篩選 → 排序 → 選欄。
*/
const input = ref('')
const delimiter = ref<',' | '\t' | ';'>(',')
const hasHeader = ref(true)
const error = ref('')
const copied = ref(false)

const ops = reactive({
  trim: true,
  dropEmpty: true,
  dedupe: false,
  dedupeKey: -1, // -1 = 整列
  filterEnabled: false,
  filterCol: 0,
  filterOp: 'contains' as FilterOp,
  filterValue: '',
  sortEnabled: false,
  sortCol: 0,
  sortNumeric: false,
  sortDesc: false,
})
// 要保留的欄位索引(以原始欄序);空集合視為全選
const keepCols = ref<Set<number>>(new Set())

const filterOps: { val: FilterOp; label: string; needsValue: boolean }[] = [
  { val: 'contains', label: '包含', needsValue: true },
  { val: 'notContains', label: '不包含', needsValue: true },
  { val: 'equals', label: '等於', needsValue: true },
  { val: 'notEquals', label: '不等於', needsValue: true },
  { val: 'startsWith', label: '開頭是', needsValue: true },
  { val: 'endsWith', label: '結尾是', needsValue: true },
  { val: 'gt', label: '數值大於', needsValue: true },
  { val: 'lt', label: '數值小於', needsValue: true },
  { val: 'notEmpty', label: '不是空白', needsValue: false },
  { val: 'empty', label: '是空白', needsValue: false },
]
const needsValue = computed(() => filterOps.find((o) => o.val === ops.filterOp)?.needsValue ?? true)

const delimLabel: Record<string, string> = { ',': '逗號 ,', '\t': 'Tab 定位', ';': '分號 ;' }

/** 解析後的原始表格 */
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

/** 套用整條清理管線後的結果 */
const result = computed<{ table: Table; removedDup: number }>(() => {
  let t = source.value
  if (t.headers.length === 0) return { table: t, removedDup: 0 }
  if (ops.trim) t = trimAll(t)
  if (ops.dropEmpty) t = dropEmptyRows(t)
  let removedDup = 0
  if (ops.dedupe) {
    const d = dedupeRows(t, { keyCols: ops.dedupeKey >= 0 ? [ops.dedupeKey] : undefined })
    t = d.table
    removedDup = d.removed
  }
  if (ops.filterEnabled && ops.filterCol < t.headers.length) {
    t = filterRows(t, { col: ops.filterCol, op: ops.filterOp, value: ops.filterValue })
  }
  if (ops.sortEnabled && ops.sortCol < t.headers.length) {
    t = sortRows(t, { col: ops.sortCol, numeric: ops.sortNumeric, descending: ops.sortDesc })
  }
  if (keepCols.value.size > 0) {
    const cols = source.value.headers
      .map((_, i) => i)
      .filter((i) => keepCols.value.has(i))
    t = selectColumns(t, cols)
  }
  return { table: t, removedDup }
})

const sourceCount = computed(() => source.value.rows.length)
const resultCount = computed(() => result.value.table.rows.length)
const previewRows = computed(() => result.value.table.rows.slice(0, 50))

function toggleKeep(i: number) {
  const s = new Set(keepCols.value)
  if (s.has(i)) s.delete(i)
  else s.add(i)
  keepCols.value = s
}

async function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!f) return
  if (f.name.toLowerCase().endsWith('.tsv')) delimiter.value = '\t'
  input.value = await f.text()
  keepCols.value = new Set()
}

function triggerDownload(text: string, filename: string, mime: string) {
  const blob = new Blob([text], { type: mime + ';charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function downloadCSV() {
  if (resultCount.value === 0) return
  const ext = delimiter.value === '\t' ? 'tsv' : 'csv'
  triggerDownload(toCSV(result.value.table, delimiter.value), '整理結果.' + ext, 'text/csv')
}
function downloadJSON() {
  if (resultCount.value === 0) return
  triggerDownload(JSON.stringify(toObjects(result.value.table), null, 2), '整理結果.json', 'application/json')
}
async function copyCSV() {
  if (resultCount.value === 0) return
  try {
    await navigator.clipboard.writeText(toCSV(result.value.table, delimiter.value))
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    error.value = '無法存取剪貼簿,請手動複製或改用下載。'
  }
}
function clearAll() {
  input.value = ''
  keepCols.value = new Set()
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
            <input type="file" accept=".csv,.tsv,.txt" class="hidden" @change="onFile" />
          </label>
        </div>
        <textarea
          v-model="input"
          rows="6"
          spellcheck="false"
          placeholder="姓名,Email,金額&#10;小明,a@x.com,1200&#10;小華,b@x.com,980&#10;小明,a@x.com,1200"
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

      <!-- 清理選項 -->
      <div v-if="source.headers.length > 0" class="space-y-4 rounded-xl border border-line bg-stone-50/60 p-4">
        <p class="text-sm font-semibold text-ink-700">清理動作(可疊加,依序套用)</p>

        <div class="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <label class="flex items-center gap-2">
            <input v-model="ops.trim" type="checkbox" class="accent-brand-600 h-4 w-4" />
            <span class="text-ink-700">去除每格前後空白</span>
          </label>
          <label class="flex items-center gap-2">
            <input v-model="ops.dropEmpty" type="checkbox" class="accent-brand-600 h-4 w-4" />
            <span class="text-ink-700">刪除整列空白</span>
          </label>
        </div>

        <!-- 去重 -->
        <div class="flex flex-wrap items-center gap-3 text-sm">
          <label class="flex items-center gap-2">
            <input v-model="ops.dedupe" type="checkbox" class="accent-brand-600 h-4 w-4" />
            <span class="text-ink-700">去除重複列,依</span>
          </label>
          <select v-model.number="ops.dedupeKey" :disabled="!ops.dedupe" class="rounded-lg border border-line bg-white px-2 py-1.5 disabled:opacity-50">
            <option :value="-1">整列完全相同</option>
            <option v-for="(h, i) in source.headers" :key="i" :value="i">「{{ h }}」欄相同</option>
          </select>
          <span v-if="ops.dedupe && result.removedDup > 0" class="text-amber-600">已移除 {{ result.removedDup }} 筆重複</span>
        </div>

        <!-- 篩選 -->
        <div class="flex flex-wrap items-center gap-3 text-sm">
          <label class="flex items-center gap-2">
            <input v-model="ops.filterEnabled" type="checkbox" class="accent-brand-600 h-4 w-4" />
            <span class="text-ink-700">只保留</span>
          </label>
          <select v-model.number="ops.filterCol" :disabled="!ops.filterEnabled" class="rounded-lg border border-line bg-white px-2 py-1.5 disabled:opacity-50">
            <option v-for="(h, i) in source.headers" :key="i" :value="i">{{ h }}</option>
          </select>
          <select v-model="ops.filterOp" :disabled="!ops.filterEnabled" class="rounded-lg border border-line bg-white px-2 py-1.5 disabled:opacity-50">
            <option v-for="o in filterOps" :key="o.val" :value="o.val">{{ o.label }}</option>
          </select>
          <input v-if="needsValue" v-model="ops.filterValue" :disabled="!ops.filterEnabled" type="text" placeholder="關鍵字 / 數值" class="rounded-lg border border-line bg-white px-2 py-1.5 disabled:opacity-50" />
        </div>

        <!-- 排序 -->
        <div class="flex flex-wrap items-center gap-3 text-sm">
          <label class="flex items-center gap-2">
            <input v-model="ops.sortEnabled" type="checkbox" class="accent-brand-600 h-4 w-4" />
            <span class="text-ink-700">依</span>
          </label>
          <select v-model.number="ops.sortCol" :disabled="!ops.sortEnabled" class="rounded-lg border border-line bg-white px-2 py-1.5 disabled:opacity-50">
            <option v-for="(h, i) in source.headers" :key="i" :value="i">{{ h }}</option>
          </select>
          <label class="flex items-center gap-2">
            <input v-model="ops.sortDesc" type="checkbox" :disabled="!ops.sortEnabled" class="accent-brand-600 h-4 w-4" />
            <span class="text-ink-700">遞減</span>
          </label>
          <label class="flex items-center gap-2">
            <input v-model="ops.sortNumeric" type="checkbox" :disabled="!ops.sortEnabled" class="accent-brand-600 h-4 w-4" />
            <span class="text-ink-700">當數字排</span>
          </label>
        </div>

        <!-- 選欄 -->
        <div class="text-sm">
          <p class="mb-1.5 text-ink-700">保留欄位(不勾任何欄=全部保留)</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="(h, i) in source.headers"
              :key="i"
              type="button"
              class="rounded-full border px-3 py-1 transition"
              :class="keepCols.size === 0 || keepCols.has(i) ? 'border-brand-400 bg-brand-50 text-ink-800' : 'border-line bg-white text-ink-400 line-through'"
              @click="toggleKeep(i)"
            >{{ h }}</button>
          </div>
        </div>
      </div>

      <!-- 結果 -->
      <div v-if="source.headers.length > 0">
        <div class="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <label class="field-label !mb-0">結果<span class="ml-2 text-sm font-normal text-ink-400">{{ resultCount }} 列</span></label>
          <div class="flex gap-3 text-sm">
            <button class="text-brand-700 underline" @click="copyCSV">{{ copied ? '已複製 ✓' : '複製 CSV' }}</button>
            <button class="text-brand-700 underline" @click="downloadCSV">下載 CSV</button>
            <button class="text-brand-700 underline" @click="downloadJSON">下載 JSON</button>
            <button class="text-ink-400 underline hover:text-red-500" @click="clearAll">清空</button>
          </div>
        </div>
        <div class="overflow-x-auto rounded-xl border border-line">
          <table class="min-w-full text-sm">
            <thead class="bg-stone-100 text-ink-700">
              <tr>
                <th v-for="(h, i) in result.table.headers" :key="i" class="whitespace-nowrap px-3 py-2 text-left font-semibold">{{ h }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, ri) in previewRows" :key="ri" class="border-t border-line/60 odd:bg-white even:bg-stone-50/50">
                <td v-for="(c, ci) in r" :key="ci" class="max-w-[18rem] truncate px-3 py-1.5 text-ink-700" :title="c">{{ c }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="resultCount > previewRows.length" class="field-hint">只預覽前 {{ previewRows.length }} 列,下載/複製為完整 {{ resultCount }} 列。</p>
        <p v-else-if="resultCount === 0" class="field-hint">目前條件下沒有符合的列。</p>
      </div>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>把一份雜亂名單(含客戶、Email、訂單)<strong>去掉重複、清掉空白列、篩出要的列、排序、只留需要的欄</strong>,再匯出。</li>
        <li><strong>不上傳</strong>:含個資的名單全程留在你電腦,不送到陌生伺服器(線上 CSV 清理站都要上傳)。</li>
        <li>正確處理含逗號、換行、雙引號的欄位;支援 CSV / TSV,也能直接從 Excel、Google 試算表複製整塊貼上。</li>
        <li>「當數字排」會把含千分位逗號(如 1,200)的數值正確比較;非數值會排到最後。</li>
        <li>需要在格式之間互轉(CSV ↔ JSON ↔ Excel)請用「資料轉換工坊」;比對兩份清單異同請用「清單比對」。</li>
      </ul>
    </LegalNote>
  </div>
</template>
