<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  parseBookmarks, flattenBookmarks, countNodes, findDuplicates, toMarkdown, toCsv,
  type Folder,
} from '@/features/bookmarks'

/*
  瀏覽器書籤整理 —— 開啟 Chrome / Edge / Firefox / Safari 匯出的書籤 .html,
  看資料夾樹、搜尋、找出重複網址,並轉成 Markdown / CSV。書籤全程在你瀏覽器處理,不上傳。
*/
const html = ref('')
const fileName = ref('')
const search = ref('')
const view = ref<'tree' | 'duplicates' | 'markdown' | 'csv'>('tree')

function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  fileName.value = f.name
  const reader = new FileReader()
  reader.onload = () => { html.value = String(reader.result || '') }
  reader.readAsText(f)
}

const root = computed<Folder | null>(() => (html.value.trim() ? parseBookmarks(html.value) : null))
const flat = computed(() => (root.value ? flattenBookmarks(root.value) : []))
const counts = computed(() => (root.value ? countNodes(root.value) : { folders: 0, links: 0 }))
const duplicates = computed(() => findDuplicates(flat.value))

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return flat.value
  return flat.value.filter(
    (f) => f.bookmark.title.toLowerCase().includes(q) || f.bookmark.url.toLowerCase().includes(q) || f.folder.toLowerCase().includes(q),
  )
})

const markdown = computed(() => (root.value ? toMarkdown(root.value) : ''))
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

function fmtDate(ms?: number): string {
  return ms ? new Date(ms).toLocaleDateString() : ''
}
function host(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-3">
      <label class="field-label">開啟書籤 .html 檔</label>
      <input type="file" accept=".html,text/html" class="block w-full text-sm" @change="onFile" />
      <p class="field-hint">
        在瀏覽器「書籤管理員 → 匯出書籤」會得到一個 .html 檔。全程在你瀏覽器處理,書籤<strong>不上傳</strong>、不連網。
      </p>
    </div>

    <div v-if="root" class="space-y-4">
      <!-- 摘要 + 分頁 -->
      <div class="card p-4 space-y-3">
        <div class="flex flex-wrap items-center gap-3 text-sm">
          <span class="font-semibold text-ink-900">{{ counts.links }} 個書籤</span>
          <span class="text-ink-400">·</span>
          <span class="text-ink-600">{{ counts.folders }} 個資料夾</span>
          <span v-if="duplicates.length" class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">{{ duplicates.length }} 組重複網址</span>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <button v-for="t in (['tree','duplicates','markdown','csv'] as const)" :key="t"
            type="button"
            class="rounded-lg px-3 py-1 text-sm"
            :class="view === t ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'"
            @click="view = t">
            {{ { tree: '清單 / 搜尋', duplicates: `重複 (${duplicates.length})`, markdown: 'Markdown', csv: 'CSV' }[t] }}
          </button>
        </div>
      </div>

      <!-- 清單 / 搜尋 -->
      <div v-if="view === 'tree'" class="card p-5 space-y-3">
        <input v-model="search" type="search" class="field-input" placeholder="搜尋標題、網址或資料夾…" />
        <p class="text-xs text-ink-400">{{ filtered.length }} / {{ flat.length }} 筆</p>
        <ul class="divide-y divide-ink-50">
          <li v-for="(f, i) in filtered.slice(0, 1000)" :key="i" class="flex items-start gap-3 py-2">
            <div class="min-w-0 flex-1">
              <a :href="f.bookmark.url" target="_blank" rel="noopener noreferrer" class="font-medium text-brand-700 hover:underline break-all">{{ f.bookmark.title }}</a>
              <p class="text-xs text-ink-400 break-all">{{ host(f.bookmark.url) }} <span v-if="f.folder" class="text-ink-300">· {{ f.folder }}</span></p>
            </div>
            <span v-if="fmtDate(f.bookmark.addDate)" class="shrink-0 text-[11px] text-ink-400">{{ fmtDate(f.bookmark.addDate) }}</span>
          </li>
        </ul>
        <p v-if="filtered.length > 1000" class="text-xs text-ink-400">僅顯示前 1000 筆,請用搜尋縮小範圍。</p>
      </div>

      <!-- 重複 -->
      <div v-else-if="view === 'duplicates'" class="card p-5 space-y-3">
        <p v-if="!duplicates.length" class="text-ink-500">🎉 沒有重複的網址。</p>
        <div v-for="(d, i) in duplicates" :key="i" class="rounded-lg border border-ink-100 p-3">
          <p class="mb-1 font-mono text-xs text-ink-700 break-all">{{ d.url }}</p>
          <ul class="space-y-1 text-sm">
            <li v-for="(e, j) in d.entries" :key="j" class="flex items-baseline gap-2">
              <span class="text-ink-300">{{ j + 1 }}.</span>
              <span class="text-ink-800">{{ e.bookmark.title }}</span>
              <span v-if="e.folder" class="text-xs text-ink-400">({{ e.folder }})</span>
            </li>
          </ul>
        </div>
      </div>

      <!-- Markdown -->
      <div v-else-if="view === 'markdown'" class="card p-5 space-y-2">
        <div class="flex gap-2">
          <button type="button" class="rounded-lg bg-ink-100 px-3 py-1 text-sm text-ink-700 hover:bg-ink-200" @click="copy(markdown, 'md')">{{ copied === 'md' ? '已複製' : '複製' }}</button>
          <button type="button" class="rounded-lg bg-ink-100 px-3 py-1 text-sm text-ink-700 hover:bg-ink-200" @click="download(markdown, 'bookmarks.md', 'text/markdown')">下載 .md</button>
        </div>
        <textarea :value="markdown" rows="16" readonly class="field-input font-mono text-xs" spellcheck="false"></textarea>
      </div>

      <!-- CSV -->
      <div v-else class="card p-5 space-y-2">
        <div class="flex gap-2">
          <button type="button" class="rounded-lg bg-ink-100 px-3 py-1 text-sm text-ink-700 hover:bg-ink-200" @click="copy(csv, 'csv')">{{ copied === 'csv' ? '已複製' : '複製' }}</button>
          <button type="button" class="rounded-lg bg-ink-100 px-3 py-1 text-sm text-ink-700 hover:bg-ink-200" @click="download(csv, 'bookmarks.csv', 'text/csv')">下載 .csv(Excel 可開)</button>
        </div>
        <textarea :value="csv" rows="16" readonly class="field-input font-mono text-xs" spellcheck="false"></textarea>
      </div>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>把瀏覽器「匯出書籤」存的 <strong>.html</strong> 攤開成清晰清單:每個書籤的標題、網域、所在資料夾與加入日期一目了然。</li>
        <li>一鍵<strong>找出重複網址</strong>(忽略尾斜線 / 錨點 / 大小寫網域差異),清掉年久累積的重複收藏。</li>
        <li>關鍵字<strong>搜尋</strong>標題 / 網址 / 資料夾,大量書籤也能快速翻找。</li>
        <li>匯出成 <strong>Markdown</strong>(貼到筆記軟體)或 <strong>CSV</strong>(用 Excel 整理 / 備份)。</li>
        <li>書籤透露你的興趣與常用服務,屬個人資料;本工具<strong>全程在你瀏覽器處理,完全不上傳、不連網</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
