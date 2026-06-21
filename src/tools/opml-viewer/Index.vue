<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  parseOpml, flattenOutlines, countOutlines, findDuplicateFeeds, toOutlineText, toMarkdown, toCsv,
  type Opml,
} from '@/features/opml'

/*
  OPML 大綱 / 訂閱清單檢視器 —— 開啟 RSS 閱讀器匯出的 .opml,看訂閱了哪些站、分在哪個資料夾、
  有沒有重複,並轉成 Markdown / CSV / 純文字大綱。全程在你瀏覽器處理,不上傳。
*/
const xml = ref('')
const fileName = ref('')
const search = ref('')
const view = ref<'list' | 'duplicates' | 'outline' | 'markdown' | 'csv'>('list')

function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  fileName.value = f.name
  const reader = new FileReader()
  reader.onload = () => { xml.value = String(reader.result || '') }
  reader.readAsText(f)
}

const opml = computed<Opml | null>(() => (xml.value.trim() ? parseOpml(xml.value) : null))
const flat = computed(() => (opml.value ? flattenOutlines(opml.value.outlines) : []))
const counts = computed(() => (opml.value ? countOutlines(opml.value.outlines) : { folders: 0, feeds: 0, total: 0 }))
const duplicates = computed(() => findDuplicateFeeds(flat.value))

const feeds = computed(() => flat.value.filter((f) => f.outline.xmlUrl))
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return feeds.value
  return feeds.value.filter(
    (f) =>
      (f.outline.text || '').toLowerCase().includes(q) ||
      (f.outline.xmlUrl || '').toLowerCase().includes(q) ||
      f.folder.toLowerCase().includes(q),
  )
})

const outlineText = computed(() => (opml.value ? toOutlineText(opml.value.outlines) : ''))
const markdown = computed(() => (opml.value ? toMarkdown(opml.value) : ''))
const csv = computed(() => toCsv(flat.value))

const copied = ref('')
async function copy(text: string, tag: string) {
  try { await navigator.clipboard.writeText(text); copied.value = tag; setTimeout(() => (copied.value = ''), 1500) } catch { /* ignore */ }
}
function download(text: string, name: string, mime: string) {
  const blob = new Blob([text], { type: mime })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}
const base = computed(() => fileName.value.replace(/\.[^.]+$/, '') || 'subscriptions')
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-3">
      <label class="field-label">開啟 OPML 檔(.opml / .xml)</label>
      <input type="file" accept=".opml,.xml,text/xml,application/xml,text/x-opml" class="block w-full text-sm" @change="onFile" />
      <p class="field-hint">
        在 Feedly / Inoreader / NetNewsWire 等 RSS 閱讀器「匯出訂閱(Export OPML)」會得到這個檔。
        全程在你瀏覽器處理,清單<strong>不上傳</strong>、不連網。
      </p>
      <details class="text-xs text-ink-500">
        <summary class="cursor-pointer select-none">或直接貼上 OPML 內容</summary>
        <textarea v-model="xml" rows="5" class="field-input mt-2 font-mono text-xs" placeholder="<opml>…</opml>"></textarea>
      </details>
    </div>

    <div v-if="opml" class="space-y-4">
      <!-- 摘要 -->
      <div class="card p-4 space-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <span v-if="opml.title" class="font-semibold text-ink-900 break-all">{{ opml.title }}</span>
          <span class="text-sm text-ink-600">{{ counts.feeds }} 個訂閱</span>
          <span class="text-ink-300">·</span>
          <span class="text-sm text-ink-600">{{ counts.folders }} 個資料夾</span>
          <span v-if="duplicates.length" class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">{{ duplicates.length }} 組重複 feed</span>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <button v-for="t in (['list','duplicates','outline','markdown','csv'] as const)" :key="t" type="button"
            class="rounded-lg px-3 py-1 text-sm"
            :class="view === t ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'"
            @click="view = t">
            {{ { list: '訂閱清單', duplicates: `重複 (${duplicates.length})`, outline: '大綱', markdown: 'Markdown', csv: 'CSV' }[t] }}
          </button>
        </div>
      </div>

      <!-- 訂閱清單 -->
      <div v-if="view === 'list'" class="card p-5 space-y-3">
        <input v-model="search" type="search" class="field-input" placeholder="搜尋標題、Feed 網址或資料夾…" />
        <p class="text-xs text-ink-400">{{ filtered.length }} / {{ feeds.length }} 個訂閱</p>
        <ul class="divide-y divide-ink-50">
          <li v-for="(f, i) in filtered.slice(0, 1000)" :key="i" class="flex items-start gap-3 py-2">
            <div class="min-w-0 flex-1">
              <a v-if="f.outline.htmlUrl" :href="f.outline.htmlUrl" target="_blank" rel="noopener noreferrer" class="font-medium text-brand-700 hover:underline break-all">{{ f.outline.text || '(無標題)' }}</a>
              <span v-else class="font-medium text-ink-800 break-all">{{ f.outline.text || '(無標題)' }}</span>
              <p class="text-xs text-ink-400 break-all">
                <span class="font-mono">{{ f.outline.xmlUrl }}</span>
                <span v-if="f.folder" class="text-ink-300"> · {{ f.folder }}</span>
              </p>
            </div>
          </li>
        </ul>
        <p v-if="filtered.length > 1000" class="text-xs text-ink-400">僅顯示前 1000 筆,請用搜尋縮小範圍。</p>
      </div>

      <!-- 重複 -->
      <div v-else-if="view === 'duplicates'" class="card p-5 space-y-3">
        <p v-if="!duplicates.length" class="text-ink-500">🎉 沒有重複的 feed 網址。</p>
        <div v-for="(d, i) in duplicates" :key="i" class="rounded-lg border border-ink-100 p-3">
          <p class="mb-1 font-mono text-xs text-ink-700 break-all">{{ d.url }}</p>
          <ul class="space-y-1 text-sm">
            <li v-for="(e, j) in d.entries" :key="j" class="flex items-baseline gap-2">
              <span class="text-ink-300">{{ j + 1 }}.</span>
              <span class="text-ink-800">{{ e.outline.text || '(無標題)' }}</span>
              <span v-if="e.folder" class="text-xs text-ink-400">({{ e.folder }})</span>
            </li>
          </ul>
        </div>
      </div>

      <!-- 大綱 -->
      <div v-else-if="view === 'outline'" class="card p-5 space-y-3">
        <div class="flex gap-2">
          <button type="button" class="rounded-lg bg-ink-100 px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-200" @click="copy(outlineText, 'txt')">{{ copied === 'txt' ? '已複製!' : '複製大綱' }}</button>
          <button type="button" class="rounded-lg bg-ink-100 px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-200" @click="download(outlineText, base + '.txt', 'text/plain')">下載 .txt</button>
        </div>
        <pre class="overflow-x-auto rounded-lg bg-ink-50 p-3 text-xs leading-relaxed text-ink-700">{{ outlineText }}</pre>
      </div>

      <!-- Markdown -->
      <div v-else-if="view === 'markdown'" class="card p-5 space-y-3">
        <div class="flex gap-2">
          <button type="button" class="rounded-lg bg-ink-100 px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-200" @click="copy(markdown, 'md')">{{ copied === 'md' ? '已複製!' : '複製 Markdown' }}</button>
          <button type="button" class="rounded-lg bg-ink-100 px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-200" @click="download(markdown, base + '.md', 'text/markdown')">下載 .md</button>
        </div>
        <textarea :value="markdown" readonly rows="16" class="field-input font-mono text-xs"></textarea>
      </div>

      <!-- CSV -->
      <div v-else class="card p-5 space-y-3">
        <div class="flex gap-2">
          <button type="button" class="rounded-lg bg-ink-100 px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-200" @click="copy(csv, 'csv')">{{ copied === 'csv' ? '已複製!' : '複製 CSV' }}</button>
          <button type="button" class="rounded-lg bg-ink-100 px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-200" @click="download(csv, base + '.csv', 'text/csv')">下載 .csv</button>
        </div>
        <textarea :value="csv" readonly rows="14" class="field-input font-mono text-xs"></textarea>
      </div>
    </div>

    <LegalNote>
      本工具僅在你的瀏覽器內解析 OPML XML,不會上傳檔案、不連網。匯出的 CSV 含 BOM,可直接用 Excel 開啟。
      重複判斷以 feed 網址比對(忽略尾斜線與大小寫)。
    </LegalNote>
  </div>
</template>
