<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { flattenJson, flattenedToCSV } from '@/features/jsonFlatten'

/*
  JSON 攤平轉表格 —— 把巢狀 JSON(物件/陣列)壓平成路徑鍵(a.b、a[0].c),
  轉成 CSV / 表格一列一筆,方便丟進 Excel。全程瀏覽器、不上傳。
*/
const input = ref('')
const delimiter = ref<',' | '\t'>(',')
const copied = ref(false)

const result = computed(() => (input.value.trim() ? flattenJson(input.value) : null))
const headers = computed(() => {
  if (!result.value?.ok) return []
  const seen: string[] = []
  const set = new Set<string>()
  for (const row of result.value.rows) {
    for (const k of Object.keys(row)) {
      if (!set.has(k)) {
        set.add(k)
        seen.push(k)
      }
    }
  }
  return seen
})
const previewRows = computed(() => result.value?.ok ? result.value.rows.slice(0, 50) : [])

const sample = `[
  { "id": 1, "name": "小明", "addr": { "city": "台北", "zip": "100" }, "tags": ["vip", "新客"] },
  { "id": 2, "name": "小華", "addr": { "city": "高雄", "zip": "800" }, "tags": [] }
]`
function loadSample() {
  input.value = sample
}
function clearAll() {
  input.value = ''
}

function csvText() {
  return result.value?.ok ? flattenedToCSV(result.value.rows, delimiter.value) : ''
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
  const t = csvText()
  if (t) triggerDownload(t, '攤平結果.' + (delimiter.value === '\t' ? 'tsv' : 'csv'), 'text/csv')
}
function downloadJSON() {
  if (result.value?.ok) triggerDownload(JSON.stringify(result.value.rows, null, 2), '攤平結果.json', 'application/json')
}
async function copyCSV() {
  const t = csvText()
  if (!t) return
  try {
    await navigator.clipboard.writeText(t)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    /* 使用者可改用下載 */
  }
}
async function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (f) input.value = await f.text()
}
// 為對齊預覽欄位用:把扁平物件依 headers 取值
function cell(row: Record<string, string>, key: string): string {
  return key in row ? row[key] : ''
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 sm:p-6 space-y-5">
      <div>
        <div class="mb-1.5 flex items-center justify-between">
          <label class="field-label !mb-0">貼上 JSON(物件、或物件陣列)</label>
          <div class="flex gap-3 text-sm">
            <button class="text-brand-700 underline" @click="loadSample">載入範例</button>
            <label class="cursor-pointer text-brand-700 underline">
              選擇檔案
              <input type="file" accept=".json,.txt" class="hidden" @change="onFile" />
            </label>
          </div>
        </div>
        <textarea
          v-model="input"
          rows="8"
          spellcheck="false"
          placeholder='{"user":{"name":"小明","tags":["vip","新客"]}}'
          class="field-input font-mono !text-sm leading-relaxed"
        ></textarea>
        <p class="field-hint">JSON 只在你的瀏覽器處理,不會上傳到任何伺服器。</p>
      </div>

      <p v-if="result && !result.ok" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ result.error }}</p>

      <!-- 結果 -->
      <div v-if="result && result.ok && headers.length > 0">
        <div class="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <label class="field-label !mb-0">攤平結果<span class="ml-2 text-sm font-normal text-ink-400">{{ result.rows.length }} 列 × {{ headers.length }} 欄</span></label>
          <div class="flex items-center gap-3 text-sm">
            <label class="flex items-center gap-1.5">
              <span class="text-ink-500">分隔</span>
              <select v-model="delimiter" class="rounded-lg border border-line bg-white px-2 py-1">
                <option value=",">逗號</option>
                <option value="&#9;">Tab</option>
              </select>
            </label>
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
                <th v-for="h in headers" :key="h" class="whitespace-nowrap px-3 py-2 text-left font-mono text-xs font-semibold">{{ h }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, ri) in previewRows" :key="ri" class="border-t border-line/60 odd:bg-white even:bg-stone-50/50">
                <td v-for="h in headers" :key="h" class="max-w-[18rem] truncate px-3 py-1.5 text-ink-700" :title="cell(r, h)">{{ cell(r, h) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="result.rows.length > previewRows.length" class="field-hint">只預覽前 {{ previewRows.length }} 列,下載/複製為完整 {{ result.rows.length }} 列。</p>
      </div>
    </div>

    <LegalNote title="什麼時候需要它?">
      <ul class="list-disc pl-5 space-y-1">
        <li>從 API、後台、程式匯出的 JSON 常是<strong>巢狀的</strong>(物件裡有物件、有陣列),Excel 打不開、「資料轉換工坊」也只吃扁平的物件陣列。</li>
        <li>這支把巢狀結構<strong>壓平成路徑欄位</strong>(<code>addr.city</code>、<code>tags[0]</code>),一列一筆,直接貼進 Excel / Google 試算表。</li>
        <li>頂層是<strong>陣列</strong>就一個元素一列;是<strong>單一物件</strong>就攤成一列。缺的欄位自動補空。</li>
        <li><strong>不上傳</strong>:含資料的 JSON 全程留在你電腦。需要 CSV/JSON/Excel 互轉(已是扁平)請用「資料轉換工坊」。</li>
      </ul>
    </LegalNote>
  </div>
</template>
