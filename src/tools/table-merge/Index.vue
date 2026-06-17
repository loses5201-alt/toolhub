<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parseTable, toCSV, toObjects, type Table } from '@/features/tableClean'
import { mergeTables, type JoinType } from '@/features/tableMerge'

/*
  表格合併 / VLOOKUP —— 把兩份表格依「對應欄」併成一張(等同 Excel VLOOKUP / SQL JOIN)。
  例:左=客戶名單、右=訂單金額,依 Email 對起來。全程瀏覽器、不上傳。
*/
const leftText = ref('')
const rightText = ref('')
const delimiter = ref<',' | '\t' | ';'>(',')
const hasHeader = ref(true)
const leftKey = ref(0)
const rightKey = ref(0)
const joinType = ref<JoinType>('left')
const caseSensitive = ref(false)
const includeRightKey = ref(false)
const copied = ref(false)
const error = ref('')

function parse(text: string): Table {
  if (!text.trim()) return { headers: [], rows: [] }
  return parseTable(text, { delimiter: delimiter.value, hasHeader: hasHeader.value })
}
const left = computed(() => parse(leftText.value))
const right = computed(() => parse(rightText.value))

// 欄數變動時把越界的 key 索引拉回 0
watch(left, (t) => { if (leftKey.value >= t.headers.length) leftKey.value = 0 })
watch(right, (t) => { if (rightKey.value >= t.headers.length) rightKey.value = 0 })

const ready = computed(() => left.value.headers.length > 0 && right.value.headers.length > 0)

const result = computed(() => {
  error.value = ''
  if (!ready.value) return null
  try {
    return mergeTables(left.value, right.value, {
      leftKey: leftKey.value,
      rightKey: rightKey.value,
      type: joinType.value,
      caseSensitive: caseSensitive.value,
      includeRightKey: includeRightKey.value,
    })
  } catch (e) {
    error.value = '合併錯誤:' + (e as Error).message
    return null
  }
})

const previewRows = computed(() => result.value?.table.rows.slice(0, 50) ?? [])

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
  if (!result.value) return
  const ext = delimiter.value === '\t' ? 'tsv' : 'csv'
  triggerDownload(toCSV(result.value.table, delimiter.value), '合併結果.' + ext, 'text/csv')
}
function downloadJSON() {
  if (!result.value) return
  triggerDownload(JSON.stringify(toObjects(result.value.table), null, 2), '合併結果.json', 'application/json')
}
async function copyCSV() {
  if (!result.value) return
  try {
    await navigator.clipboard.writeText(toCSV(result.value.table, delimiter.value))
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    error.value = '無法存取剪貼簿,請改用下載。'
  }
}
async function onFile(e: Event, side: 'left' | 'right') {
  const f = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!f) return
  if (f.name.toLowerCase().endsWith('.tsv')) delimiter.value = '\t'
  const text = await f.text()
  if (side === 'left') leftText.value = text
  else rightText.value = text
}
const delimLabel: Record<string, string> = { ',': '逗號 ,', '\t': 'Tab 定位', ';': '分號 ;' }
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 sm:p-6 space-y-5">
      <!-- 兩份表格輸入 -->
      <div class="grid gap-4 md:grid-cols-2">
        <div v-for="side in (['left','right'] as const)" :key="side">
          <div class="mb-1.5 flex items-center justify-between">
            <label class="field-label !mb-0">{{ side === 'left' ? '左表(主表,保留它的列)' : '右表(要對過來的資料)' }}</label>
            <label class="cursor-pointer text-sm text-brand-700 underline">
              選擇檔案
              <input type="file" accept=".csv,.tsv,.txt" class="hidden" @change="(e) => onFile(e, side)" />
            </label>
          </div>
          <textarea
            :value="side === 'left' ? leftText : rightText"
            rows="5"
            spellcheck="false"
            :placeholder="side === 'left' ? 'email,姓名\na@x.com,小明\nb@x.com,小華' : 'email,金額\na@x.com,1200'"
            class="field-input font-mono !text-sm leading-relaxed"
            @input="(e) => side === 'left' ? (leftText = (e.target as HTMLTextAreaElement).value) : (rightText = (e.target as HTMLTextAreaElement).value)"
          ></textarea>
          <p class="field-hint">{{ (side === 'left' ? left : right).rows.length }} 列 × {{ (side === 'left' ? left : right).headers.length }} 欄</p>
        </div>
      </div>

      <!-- 設定 -->
      <div class="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
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
      </div>

      <div v-if="ready" class="space-y-4 rounded-xl border border-line bg-stone-50/60 p-4 text-sm">
        <div class="flex flex-wrap items-center gap-3">
          <span class="text-ink-700">依</span>
          <span class="text-ink-500">左表</span>
          <select v-model.number="leftKey" class="rounded-lg border border-line bg-white px-2 py-1.5">
            <option v-for="(h, i) in left.headers" :key="i" :value="i">{{ h }}</option>
          </select>
          <span class="text-ink-700">對應</span>
          <span class="text-ink-500">右表</span>
          <select v-model.number="rightKey" class="rounded-lg border border-line bg-white px-2 py-1.5">
            <option v-for="(h, i) in right.headers" :key="i" :value="i">{{ h }}</option>
          </select>
        </div>
        <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
          <label class="flex items-center gap-2">
            <input v-model="joinType" type="radio" value="left" class="accent-brand-600" />
            <span class="text-ink-700">保留所有左表的列(對不到留空)</span>
          </label>
          <label class="flex items-center gap-2">
            <input v-model="joinType" type="radio" value="inner" class="accent-brand-600" />
            <span class="text-ink-700">只保留有對到的列</span>
          </label>
        </div>
        <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
          <label class="flex items-center gap-2">
            <input v-model="caseSensitive" type="checkbox" class="accent-brand-600 h-4 w-4" />
            <span class="text-ink-700">對應欄區分英文大小寫</span>
          </label>
          <label class="flex items-center gap-2">
            <input v-model="includeRightKey" type="checkbox" class="accent-brand-600 h-4 w-4" />
            <span class="text-ink-700">結果保留右表的對應欄</span>
          </label>
        </div>
      </div>

      <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

      <!-- 結果 -->
      <div v-if="result">
        <div class="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-600">
          <span class="font-semibold text-ink-800">合併結果 {{ result.table.rows.length }} 列</span>
          <span class="text-emerald-700">對到 {{ result.matched }} 筆</span>
          <span v-if="result.unmatched > 0" class="text-amber-600">未對到 {{ result.unmatched }} 筆</span>
          <span v-if="result.rightDuplicates > 0" class="text-ink-400">右表有 {{ result.rightDuplicates }} 筆重複 key(取第一筆)</span>
        </div>
        <div class="mb-1.5 flex justify-end gap-3 text-sm">
          <button class="text-brand-700 underline" @click="copyCSV">{{ copied ? '已複製 ✓' : '複製 CSV' }}</button>
          <button class="text-brand-700 underline" @click="downloadCSV">下載 CSV</button>
          <button class="text-brand-700 underline" @click="downloadJSON">下載 JSON</button>
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
        <p v-if="result.table.rows.length > previewRows.length" class="field-hint">只預覽前 {{ previewRows.length }} 列,下載/複製為完整 {{ result.table.rows.length }} 列。</p>
      </div>
    </div>

    <LegalNote title="這就是 Excel 的 VLOOKUP,但更簡單也不外洩">
      <ul class="list-disc pl-5 space-y-1">
        <li>把兩份名單<strong>依共同欄位(如 Email、學號、統編)對起來併成一張</strong> —— 不用寫 VLOOKUP 公式、不怕拉錯範圍。</li>
        <li><strong>不上傳</strong>:含個資的兩份名單全程留在你電腦(線上合併站都要上傳)。</li>
        <li>右表若同一個 key 出現多次,取<strong>第一筆</strong>(與 VLOOKUP 相同),並會提示有幾筆重複。</li>
        <li>對應欄預設<strong>忽略英文大小寫、自動去除前後空白</strong>,避免「 A@X.com 」對不到「a@x.com」。</li>
        <li>需要單張表格去重/篩選/排序請用「表格清理工坊」;只想比對兩份清單的異同請用「清單比對」。</li>
      </ul>
    </LegalNote>
  </div>
</template>
