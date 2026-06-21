<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parseFeed, feedToMarkdown, type Feed } from '@/features/feed'

/*
  RSS / Atom / RDF 訂閱源檢視器 —— 開啟存下來的 feed.xml 就能離線讀文章清單(標題 / 連結 / 日期 /
  作者 / 摘要 / 分類),不必連去原站(避免內嵌追蹤圖片 / 廣告),摘要一律轉乾淨純文字。全程在你瀏覽器解析,不上傳。
*/
const xml = ref('')
const fileName = ref('')
const search = ref('')
const sort = ref<'feed' | 'newest' | 'oldest'>('feed')
const view = ref<'list' | 'markdown'>('list')

function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  fileName.value = f.name
  const reader = new FileReader()
  reader.onload = () => { xml.value = String(reader.result || '') }
  reader.readAsText(f)
}

const feed = computed<Feed | null>(() => (xml.value.trim() ? parseFeed(xml.value) : null))

const kindLabel: Record<string, string> = {
  rss: 'RSS 2.0', atom: 'Atom', rdf: 'RSS 1.0 / RDF', unknown: '無法辨識',
}

const items = computed(() => {
  const f = feed.value
  if (!f) return []
  let list = f.items.slice()
  const q = search.value.trim().toLowerCase()
  if (q) {
    list = list.filter((it) =>
      (it.title || '').toLowerCase().includes(q) ||
      (it.summary || '').toLowerCase().includes(q) ||
      it.categories.some((c) => c.toLowerCase().includes(q)),
    )
  }
  if (sort.value !== 'feed') {
    const dir = sort.value === 'newest' ? -1 : 1
    list.sort((a, b) => {
      const ta = a.iso ? Date.parse(a.iso) : NaN
      const tb = b.iso ? Date.parse(b.iso) : NaN
      if (Number.isNaN(ta) && Number.isNaN(tb)) return 0
      if (Number.isNaN(ta)) return 1
      if (Number.isNaN(tb)) return -1
      return (ta - tb) * dir
    })
  }
  return list
})

const markdown = computed(() => (feed.value ? feedToMarkdown(feed.value) : ''))

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

function fmtDate(it: { iso?: string; date?: string }): string {
  if (it.iso) return new Date(it.iso).toLocaleString()
  return it.date || ''
}
function host(url?: string): string {
  if (!url) return ''
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-3">
      <label class="field-label">開啟訂閱源檔(.xml / .rss / .atom)</label>
      <input type="file" accept=".xml,.rss,.atom,.rdf,application/rss+xml,application/atom+xml,text/xml,application/xml" class="block w-full text-sm" @change="onFile" />
      <p class="field-hint">
        在瀏覽器開啟 feed 網址(常見如 <code>網址/feed</code>、<code>/rss.xml</code>、<code>/atom.xml</code>)後另存,或從閱讀器匯出。
        支援 RSS 2.0 / Atom / RSS 1.0(RDF)。全程在你瀏覽器處理,內容<strong>不上傳</strong>、不連網。
      </p>
      <details class="text-xs text-ink-500">
        <summary class="cursor-pointer select-none">或直接貼上 XML 內容</summary>
        <textarea v-model="xml" rows="5" class="field-input mt-2 font-mono text-xs" placeholder="<rss>…</rss> 或 <feed>…</feed>"></textarea>
      </details>
    </div>

    <div v-if="feed" class="space-y-4">
      <div v-if="feed.kind === 'unknown'" class="card p-5 text-ink-600">
        無法辨識這個檔案的格式。請確認它是 RSS / Atom / RDF 訂閱源 XML。
      </div>

      <template v-else>
        <!-- 頻道摘要 -->
        <div class="card p-5 space-y-2">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-lg font-semibold text-ink-900 break-all">{{ feed.title || '(未命名來源)' }}</h2>
            <span class="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">{{ kindLabel[feed.kind] }}</span>
          </div>
          <p v-if="feed.description" class="text-sm text-ink-600">{{ feed.description }}</p>
          <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-400">
            <a v-if="feed.link" :href="feed.link" target="_blank" rel="noopener noreferrer" class="text-brand-600 hover:underline break-all">{{ feed.link }}</a>
            <span v-if="feed.updated">更新:{{ feed.updated }}</span>
            <span v-if="feed.generator">產生器:{{ feed.generator }}</span>
            <span class="font-semibold text-ink-600">{{ feed.items.length }} 篇文章</span>
          </div>
        </div>

        <!-- 工具列 -->
        <div class="card p-4 space-y-3">
          <div class="flex flex-wrap gap-1.5">
            <button v-for="t in (['list','markdown'] as const)" :key="t" type="button"
              class="rounded-lg px-3 py-1 text-sm"
              :class="view === t ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'"
              @click="view = t">
              {{ { list: '文章清單', markdown: 'Markdown' }[t] }}
            </button>
          </div>
          <div v-if="view === 'list'" class="flex flex-wrap items-center gap-2">
            <input v-model="search" type="search" class="field-input flex-1 min-w-[12rem]" placeholder="搜尋標題、摘要或分類…" />
            <select v-model="sort" class="field-input w-auto">
              <option value="feed">原始順序</option>
              <option value="newest">日期新→舊</option>
              <option value="oldest">日期舊→新</option>
            </select>
          </div>
        </div>

        <!-- 清單 -->
        <div v-if="view === 'list'" class="card p-5 space-y-3">
          <p class="text-xs text-ink-400">{{ items.length }} / {{ feed.items.length }} 篇</p>
          <p v-if="!items.length" class="text-ink-500">沒有符合的文章。</p>
          <article v-for="(it, i) in items.slice(0, 500)" :key="i" class="border-t border-ink-50 pt-3 first:border-t-0 first:pt-0">
            <a v-if="it.link" :href="it.link" target="_blank" rel="noopener noreferrer" class="font-semibold text-brand-700 hover:underline break-words">{{ it.title || '(無標題)' }}</a>
            <span v-else class="font-semibold text-ink-800 break-words">{{ it.title || '(無標題)' }}</span>
            <div class="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-400">
              <span v-if="fmtDate(it)">🕓 {{ fmtDate(it) }}</span>
              <span v-if="it.author">✍️ {{ it.author }}</span>
              <span v-if="host(it.link)">{{ host(it.link) }}</span>
            </div>
            <p v-if="it.summary" class="mt-1.5 whitespace-pre-line text-sm text-ink-600">{{ it.summary }}</p>
            <div v-if="it.categories.length" class="mt-1.5 flex flex-wrap gap-1">
              <span v-for="(c, j) in it.categories" :key="j" class="rounded bg-ink-100 px-1.5 py-0.5 text-[11px] text-ink-500">{{ c }}</span>
            </div>
          </article>
          <p v-if="items.length > 500" class="text-xs text-ink-400">僅顯示前 500 篇,請用搜尋縮小範圍。</p>
        </div>

        <!-- Markdown -->
        <div v-else class="card p-5 space-y-3">
          <div class="flex gap-2">
            <button type="button" class="rounded-lg bg-ink-100 px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-200" @click="copy(markdown, 'md')">{{ copied === 'md' ? '已複製!' : '複製 Markdown' }}</button>
            <button type="button" class="rounded-lg bg-ink-100 px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-200" @click="download(markdown, (fileName.replace(/\.[^.]+$/, '') || 'feed') + '.md', 'text/markdown')">下載 .md</button>
          </div>
          <textarea :value="markdown" readonly rows="16" class="field-input font-mono text-xs"></textarea>
        </div>
      </template>
    </div>

    <LegalNote>
      本工具僅在你的瀏覽器內解析訂閱源 XML,不會上傳檔案、不連網抓原文。文章摘要會轉成純文字並過濾標籤,
      不載入內嵌的遠端圖片或追蹤連結。若摘要僅含部分內文,屬來源本身只提供節錄,非工具裁切。
    </LegalNote>
  </div>
</template>
