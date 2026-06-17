<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parseTable, toCSV } from '@/features/tableClean'
import { tableToMarkdown, markdownToTable } from '@/features/markdownTable'

/*
  CSV ↔ Markdown 表格互轉 —— 把 CSV/Excel 表格轉成 GitHub/Notion 風格的
  Markdown 表格,或把 Markdown 表格轉回 CSV。全程瀏覽器、不上傳。
*/
type Mode = 'toMd' | 'toCsv'
const mode = ref<Mode>('toMd')
const input = ref('')
const delimiter = ref<',' | '\t' | ';'>(',')
const hasHeader = ref(true)
const copied = ref(false)
const error = ref('')

const output = computed(() => {
  error.value = ''
  if (!input.value.trim()) return ''
  try {
    if (mode.value === 'toMd') {
      const t = parseTable(input.value, { delimiter: delimiter.value, hasHeader: hasHeader.value })
      return tableToMarkdown(t)
    }
    const r = markdownToTable(input.value)
    if (!r.ok) {
      error.value = r.error ?? '解析失敗'
      return ''
    }
    return toCSV(r.table, delimiter.value)
  } catch (e) {
    error.value = (e as Error).message
    return ''
  }
})

function switchMode(m: Mode) {
  if (m === mode.value) return
  mode.value = m
  // 把上一步的輸出帶成新的輸入,方便來回檢視
  if (output.value && !error.value) input.value = output.value
  else input.value = ''
}

const mdSample = '| 名稱 | 數量 | 單價 |\n|:--|--:|--:|\n| 蘋果 | 3 | 30 |\n| 香蕉 | 5 | 12 |'
const csvSample = '名稱,數量,單價\n蘋果,3,30\n香蕉,5,12'
function loadSample() {
  input.value = mode.value === 'toMd' ? csvSample : mdSample
}
function clearAll() {
  input.value = ''
}
async function copyOut() {
  if (!output.value) return
  try {
    await navigator.clipboard.writeText(output.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    /* 使用者可手動複製 */
  }
}
function download() {
  if (!output.value) return
  const isMd = mode.value === 'toMd'
  const blob = new Blob([output.value], { type: (isMd ? 'text/markdown' : 'text/csv') + ';charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = isMd ? '表格.md' : '表格.' + (delimiter.value === '\t' ? 'tsv' : 'csv')
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
async function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (f) input.value = await f.text()
}
const delimLabel: Record<string, string> = { ',': '逗號 ,', '\t': 'Tab 定位', ';': '分號 ;' }
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 sm:p-6 space-y-5">
      <div class="grid grid-cols-2 gap-1.5">
        <button
          class="rounded-lg border px-3 py-2.5 text-sm font-semibold transition"
          :class="mode === 'toMd' ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-300 text-ink-900' : 'border-line bg-white text-ink-600 hover:bg-stone-50'"
          @click="switchMode('toMd')"
        >CSV → Markdown 表格</button>
        <button
          class="rounded-lg border px-3 py-2.5 text-sm font-semibold transition"
          :class="mode === 'toCsv' ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-300 text-ink-900' : 'border-line bg-white text-ink-600 hover:bg-stone-50'"
          @click="switchMode('toCsv')"
        >Markdown 表格 → CSV</button>
      </div>

      <div>
        <div class="mb-1.5 flex items-center justify-between">
          <label class="field-label !mb-0">{{ mode === 'toMd' ? '貼上 CSV / TSV(或從 Excel 複製)' : '貼上 Markdown 表格' }}</label>
          <div class="flex gap-3 text-sm">
            <button class="text-brand-700 underline" @click="loadSample">載入範例</button>
            <label class="cursor-pointer text-brand-700 underline">
              選擇檔案
              <input type="file" :accept="mode === 'toMd' ? '.csv,.tsv,.txt' : '.md,.markdown,.txt'" class="hidden" @change="onFile" />
            </label>
          </div>
        </div>
        <textarea
          v-model="input"
          rows="7"
          spellcheck="false"
          :placeholder="mode === 'toMd' ? '姓名,年齡\n小明,18' : '| 姓名 | 年齡 |\n|---|---|\n| 小明 | 18 |'"
          class="field-input font-mono !text-sm leading-relaxed"
        ></textarea>
        <div class="mt-2 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <label class="flex items-center gap-2">
            <span class="text-ink-600">CSV 分隔符</span>
            <select v-model="delimiter" class="rounded-lg border border-line bg-white px-2 py-1.5">
              <option v-for="(lab, val) in delimLabel" :key="val" :value="val">{{ lab }}</option>
            </select>
          </label>
          <label v-if="mode === 'toMd'" class="flex items-center gap-2">
            <input v-model="hasHeader" type="checkbox" class="accent-brand-600 h-4 w-4" />
            <span class="text-ink-700">第一列是欄位名稱</span>
          </label>
        </div>
        <p class="field-hint">資料只在你的瀏覽器處理,不會上傳到任何伺服器。</p>
      </div>

      <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

      <div v-if="output">
        <div class="mb-1.5 flex items-center justify-between">
          <label class="field-label !mb-0">結果({{ mode === 'toMd' ? 'Markdown' : 'CSV' }})</label>
          <div class="flex gap-3 text-sm">
            <button class="text-brand-700 underline" @click="copyOut">{{ copied ? '已複製 ✓' : '複製' }}</button>
            <button class="text-brand-700 underline" @click="download">下載</button>
            <button class="text-ink-400 underline hover:text-red-500" @click="clearAll">清空</button>
          </div>
        </div>
        <textarea :value="output" rows="9" readonly spellcheck="false" class="field-input font-mono !text-sm leading-relaxed bg-stone-50"></textarea>
      </div>
    </div>

    <LegalNote title="什麼時候用得到?">
      <ul class="list-disc pl-5 space-y-1">
        <li>寫 <strong>GitHub README / issue、Notion、HackMD、技術文件</strong>時,要把 Excel 表格貼成 Markdown 表格 —— 這支直接幫你排好、欄位對齊。</li>
        <li>反過來,把網路上看到的 Markdown 表格<strong>轉回 CSV</strong> 丟進 Excel 統計。</li>
        <li>正確處理儲存格內的 <code>|</code>(自動逸出成 <code>\|</code>)與換行;可指定靠左/置中/靠右對齊。</li>
        <li><strong>不上傳</strong>:全程在你瀏覽器轉換。需要 CSV/JSON/Excel 互轉請用「資料轉換工坊」。</li>
      </ul>
    </LegalNote>
  </div>
</template>
