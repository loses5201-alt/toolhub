<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parseTable, toCSV, toObjects } from '@/features/tableClean'
import { computeStats, aggLabels, type Agg } from '@/features/tableStats'

/*
  表格統計 / 樞紐 —— 依某欄分組,對另一欄做統計(等同 Excel 樞紐分析 / GROUP BY)。
  例:依「地區」加總「金額」、依「狀態」數筆數。全程瀏覽器、不上傳。
*/
const input = ref('')
const delimiter = ref<',' | '\t' | ';'>(',')
const hasHeader = ref(true)
const groupCol = ref(0)
const valueCol = ref(1)
const agg = ref<Agg>('count')
const copied = ref(false)

const source = computed(() => (input.value.trim() ? parseTable(input.value, { delimiter: delimiter.value, hasHeader: hasHeader.value }) : { headers: [], rows: [] }))
const ready = computed(() => source.value.headers.length > 0)

watch(source, (t) => {
  if (groupCol.value >= t.headers.length) groupCol.value = 0
  if (valueCol.value >= t.headers.length) valueCol.value = Math.min(1, t.headers.length - 1)
})

const aggList = Object.keys(aggLabels) as Agg[]
const needsValue = computed(() => agg.value !== 'count')

const result = computed(() => {
  if (!ready.value) return null
  return computeStats(source.value, { groupCol: groupCol.value, valueCol: valueCol.value, agg: agg.value })
})
const previewRows = computed(() => result.value?.table.rows.slice(0, 100) ?? [])

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
  if (result.value) triggerDownload(toCSV(result.value.table, delimiter.value), '統計結果.csv', 'text/csv')
}
function downloadJSON() {
  if (result.value) triggerDownload(JSON.stringify(toObjects(result.value.table), null, 2), '統計結果.json', 'application/json')
}
async function copyCSV() {
  if (!result.value) return
  try {
    await navigator.clipboard.writeText(toCSV(result.value.table, delimiter.value))
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    /* 使用者可手動下載 */
  }
}
async function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!f) return
  if (f.name.toLowerCase().endsWith('.tsv')) delimiter.value = '\t'
  input.value = await f.text()
}
const delimLabel: Record<string, string> = { ',': '逗號 ,', '\t': 'Tab 定位', ';': '分號 ;' }
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 sm:p-6 space-y-5">
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
          placeholder="地區,金額&#10;北區,1200&#10;南區,800&#10;北區,500&#10;南區,300"
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
            <span class="text-ink-700">第一列是欄位名稱</span>
          </label>
          <span v-if="ready" class="text-ink-400">{{ source.rows.length }} 列 × {{ source.headers.length }} 欄</span>
        </div>
        <p class="field-hint">資料只在你的瀏覽器處理,不會上傳到任何伺服器。</p>
      </div>

      <!-- 設定 -->
      <div v-if="ready" class="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-stone-50/60 p-4 text-sm">
        <span class="text-ink-700">依</span>
        <select v-model.number="groupCol" class="rounded-lg border border-line bg-white px-2 py-1.5">
          <option :value="-1">不分組(全部)</option>
          <option v-for="(h, i) in source.headers" :key="i" :value="i">{{ h }}</option>
        </select>
        <span class="text-ink-700">分組,計算</span>
        <select v-if="needsValue" v-model.number="valueCol" class="rounded-lg border border-line bg-white px-2 py-1.5">
          <option v-for="(h, i) in source.headers" :key="i" :value="i">{{ h }}</option>
        </select>
        <span v-if="needsValue" class="text-ink-700">的</span>
        <select v-model="agg" class="rounded-lg border border-line bg-white px-2 py-1.5">
          <option v-for="a in aggList" :key="a" :value="a">{{ aggLabels[a] }}</option>
        </select>
      </div>

      <!-- 結果 -->
      <div v-if="result">
        <div class="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <label class="field-label !mb-0">統計結果<span class="ml-2 text-sm font-normal text-ink-400">{{ result.groups }} 組</span></label>
          <div class="flex gap-3 text-sm">
            <button class="text-brand-700 underline" @click="copyCSV">{{ copied ? '已複製 ✓' : '複製 CSV' }}</button>
            <button class="text-brand-700 underline" @click="downloadCSV">下載 CSV</button>
            <button class="text-brand-700 underline" @click="downloadJSON">下載 JSON</button>
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
                <td v-for="(c, ci) in r" :key="ci" class="max-w-[18rem] truncate px-3 py-1.5 text-ink-700" :title="c">{{ c || '(空白)' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="result.groups > previewRows.length" class="field-hint">只預覽前 {{ previewRows.length }} 組,下載為完整 {{ result.groups }} 組。</p>
      </div>
    </div>

    <LegalNote title="這就是 Excel 的「樞紐分析」,但更快也不外洩">
      <ul class="list-disc pl-5 space-y-1">
        <li>把一份明細<strong>依分類欄分組,馬上算出各組的筆數、加總、平均、最大/最小、不重複數</strong> —— 不用拉樞紐表。</li>
        <li>常見用途:依地區/業務加總業績、依狀態數訂單筆數、依品項算平均單價。</li>
        <li><strong>不上傳</strong>:含營業數字、客戶明細的資料全程留在你電腦。</li>
        <li>數值會自動忽略<strong>千分位逗號與前後空白</strong>;某格不是數字時(加總/平均)會略過,不會整組壞掉。</li>
        <li>需要單張表格去重/篩選/排序用「表格清理工坊」;把兩份表對起來用「表格合併 / VLOOKUP」。</li>
      </ul>
    </LegalNote>
  </div>
</template>
