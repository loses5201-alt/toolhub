<script setup lang="ts">
import { ref, computed } from 'vue'
import JSZip from 'jszip'
import LegalNote from '@/components/LegalNote.vue'
import {
  parseDocument, blocksToText, blocksToMarkdown, countChars, parseCore, parseApp,
  type Block, type DocxCore, type DocxApp,
} from '@/features/docx'

/*
  .docx 檢視器 —— 打開 Word 文件,不必裝 Office 就能看內容與資訊,並轉成乾淨純文字 / Markdown。
  .docx 是 ZIP:用 JSZip 解壓後,把 document.xml / core.xml / app.xml 餵進純函式引擎解析。
  文件全程在你瀏覽器處理,不上傳。
*/
const fileName = ref('')
const loading = ref(false)
const error = ref('')
const blocks = ref<Block[]>([])
const core = ref<DocxCore | null>(null)
const app = ref<DocxApp | null>(null)
const view = ref<'preview' | 'text' | 'markdown'>('preview')
const copied = ref(false)

function reset() {
  error.value = ''
  blocks.value = []
  core.value = null
  app.value = null
  view.value = 'preview'
}

async function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  reset()
  fileName.value = f.name
  loading.value = true
  try {
    const zip = await JSZip.loadAsync(await f.arrayBuffer())
    const docFile = zip.file('word/document.xml')
    if (!docFile) throw new Error('找不到 word/document.xml,可能不是有效的 .docx(舊版 .doc 不支援,請先用 Word 另存為 .docx)。')
    blocks.value = parseDocument(await docFile.async('string'))
    const coreFile = zip.file('docProps/core.xml')
    if (coreFile) core.value = parseCore(await coreFile.async('string'))
    const appFile = zip.file('docProps/app.xml')
    if (appFile) app.value = parseApp(await appFile.async('string'))
  } catch (err) {
    error.value = err instanceof Error ? err.message : '解析失敗,請確認檔案為 .docx 格式。'
  } finally {
    loading.value = false
  }
}

const plainText = computed(() => blocksToText(blocks.value))
const markdown = computed(() => blocksToMarkdown(blocks.value))
const charCount = computed(() => countChars(blocks.value))
const hasContent = computed(() => blocks.value.length > 0)

const metaRows = computed(() => {
  const c = core.value
  const a = app.value
  const rows: { label: string; value: string }[] = []
  if (c?.creator) rows.push({ label: '作者', value: c.creator })
  if (c?.lastModifiedBy) rows.push({ label: '最後修改者', value: c.lastModifiedBy })
  if (c?.created) rows.push({ label: '建立日期', value: fmtDate(c.created) })
  if (c?.modified) rows.push({ label: '修改日期', value: fmtDate(c.modified) })
  if (c?.revision) rows.push({ label: '修訂版次', value: c.revision })
  if (c?.subject) rows.push({ label: '主旨', value: c.subject })
  if (c?.keywords) rows.push({ label: '關鍵字', value: c.keywords })
  if (a?.pages) rows.push({ label: '頁數', value: a.pages })
  if (a?.words) rows.push({ label: 'Word 統計字數', value: a.words })
  if (a?.company) rows.push({ label: '公司', value: a.company })
  if (a?.application) rows.push({ label: '製作程式', value: a.application })
  return rows
})
const title = computed(() => core.value?.title || fileName.value.replace(/\.docx$/i, ''))

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

async function copyCurrent() {
  const text = view.value === 'markdown' ? markdown.value : plainText.value
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch { /* 忽略 */ }
}

function downloadCurrent() {
  const isMd = view.value === 'markdown'
  const text = isMd ? markdown.value : plainText.value
  const base = (title.value || 'document').replace(/[\\/:*?"<>|]+/g, '_')
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = base + (isMd ? '.md' : '.txt')
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-3">
      <label class="field-label">開啟 .docx 文件</label>
      <input
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        class="block text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-brand-500 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-brand-600"
        @change="onFile"
      />
      <p v-if="fileName" class="text-sm text-ink-500">{{ fileName }}</p>
      <p class="field-hint">全程在你瀏覽器解析,文件<strong>不上傳</strong>、不連網。支援新版 Word 的 .docx(舊版 .doc 請先在 Word 另存為 .docx)。</p>
    </div>

    <div v-if="loading" class="card p-6 text-center text-ink-500">📄 解析中…</div>
    <div v-if="error" class="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-sm text-rose-700">⚠️ {{ error }}</div>

    <template v-if="hasContent && !loading">
      <!-- 文件資訊 -->
      <div class="card p-5 space-y-3">
        <h2 class="text-lg font-semibold text-ink-900 break-all">{{ title || '(無標題)' }}</h2>
        <dl v-if="metaRows.length" class="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          <div v-for="(r, i) in metaRows" :key="i">
            <dt class="text-ink-500">{{ r.label }}</dt>
            <dd class="font-medium text-ink-900 break-all">{{ r.value }}</dd>
          </div>
        </dl>
        <p class="text-sm text-ink-500">內容約 {{ charCount.toLocaleString('en-US') }} 字(不含空白)。</p>
      </div>

      <!-- 檢視切換 + 動作 -->
      <div class="card p-5 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="inline-flex rounded-xl bg-ink-100 p-1 text-sm">
            <button
              v-for="t in [['preview', '預覽'], ['text', '純文字'], ['markdown', 'Markdown']]"
              :key="t[0]"
              type="button"
              class="rounded-lg px-3 py-1.5 font-medium transition"
              :class="view === t[0] ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-500 hover:text-ink-700'"
              @click="view = t[0] as typeof view"
            >{{ t[1] }}</button>
          </div>
          <div v-if="view !== 'preview'" class="flex gap-2">
            <button type="button" class="rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-50" @click="copyCurrent">
              {{ copied ? '已複製 ✓' : '複製' }}
            </button>
            <button type="button" class="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-600" @click="downloadCurrent">
              下載 {{ view === 'markdown' ? '.md' : '.txt' }}
            </button>
          </div>
        </div>

        <!-- 預覽:依段落樣式渲染 -->
        <div v-if="view === 'preview'" class="docx-preview space-y-2 text-[15px] leading-relaxed text-ink-800">
          <template v-for="(b, i) in blocks" :key="i">
            <table v-if="b.type === 'table'" class="my-2 w-full border-collapse text-sm">
              <tbody>
                <tr v-for="(row, ri) in b.rows" :key="ri">
                  <td v-for="(cell, ci) in row" :key="ci" class="border border-ink-200 px-2 py-1 align-top whitespace-pre-line">{{ cell }}</td>
                </tr>
              </tbody>
            </table>
            <component
              v-else-if="b.heading > 0"
              :is="'h' + Math.min(b.heading + 1, 6)"
              class="font-semibold text-ink-900"
              :class="b.heading === 1 ? 'text-xl mt-3' : b.heading === 2 ? 'text-lg mt-2' : 'text-base mt-1'"
            >
              <span v-for="(r, ri) in b.runs" :key="ri">{{ r.text }}</span>
            </component>
            <div v-else-if="b.list >= 0" class="flex gap-2" :style="{ paddingLeft: b.list * 1.5 + 'rem' }">
              <span class="text-ink-400">•</span>
              <span><span v-for="(r, ri) in b.runs" :key="ri" :class="{ 'font-semibold': r.bold, italic: r.italic }">{{ r.text }}</span></span>
            </div>
            <p v-else-if="b.runs.length" class="whitespace-pre-line">
              <span v-for="(r, ri) in b.runs" :key="ri" :class="{ 'font-semibold': r.bold, italic: r.italic }">{{ r.text }}</span>
            </p>
            <div v-else class="h-3"></div>
          </template>
        </div>

        <!-- 純文字 / Markdown 原始碼 -->
        <pre v-else class="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-ink-50 p-4 text-sm text-ink-700">{{ view === 'markdown' ? markdown : plainText }}</pre>
      </div>
    </template>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>收到 <strong>.docx</strong>(履歷、合約、報告)卻沒裝 Word / Office?直接打開看內容、作者、建立 / 修改日期、頁數字數等文件資訊。</li>
        <li>一鍵把內文轉成<strong>乾淨純文字</strong>或 <strong>Markdown</strong>(保留標題、清單、粗體 / 斜體、表格),貼進筆記、部落格、聊天室都方便。</li>
        <li><strong>全程在你瀏覽器解析,文件不上傳</strong>、不連網 —— 線上 Word 轉檔網站多半要你上傳含個資的私密文件,這支不會。</li>
        <li>為保護隱私,僅擷取文字內容,<strong>不載入文件內嵌的遠端圖片 / 追蹤連結</strong>。與 EPUB 檢視器、.eml 郵件檢視器同屬「打開檔案看內容」家族。</li>
      </ul>
    </LegalNote>
  </div>
</template>
