<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { renderMarkdown } from '@/features/markdownRender'

/*
  Markdown 預覽 / 轉 HTML —— 即時把 Markdown 渲染成畫面與乾淨 HTML,
  可複製 HTML 原始碼、複製成可貼進 Word/Email 的格式化內容、下載 .html / .md。
  全程在你瀏覽器渲染,不連網、不上傳。
*/
type View = 'preview' | 'html'
const view = ref<View>('preview')
const input = ref('')
const copiedHtml = ref(false)
const copiedRich = ref(false)

const html = computed(() => renderMarkdown(input.value))

const counts = computed(() => {
  const text = input.value
  const chars = [...text].length
  const lines = text === '' ? 0 : text.split('\n').length
  return { chars, lines }
})

async function copyHtml() {
  if (!html.value) return
  try {
    await navigator.clipboard.writeText(html.value)
    copiedHtml.value = true
    setTimeout(() => (copiedHtml.value = false), 1500)
  } catch {
    /* 使用者可手動複製 */
  }
}

/** 複製成「格式化內容」(text/html),貼進 Word / Gmail / Outlook 會保留粗體、清單、表格。 */
async function copyRich() {
  if (!html.value) return
  try {
    const item = new ClipboardItem({
      'text/html': new Blob([html.value], { type: 'text/html' }),
      'text/plain': new Blob([input.value], { type: 'text/plain' }),
    })
    await navigator.clipboard.write([item])
    copiedRich.value = true
    setTimeout(() => (copiedRich.value = false), 1500)
  } catch {
    // 不支援 ClipboardItem 時退回複製 HTML 原始碼
    await copyHtml()
  }
}

function standaloneHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>文件</title>
<style>
  body{max-width:760px;margin:2rem auto;padding:0 1rem;font-family:system-ui,-apple-system,"Noto Sans TC",sans-serif;line-height:1.7;color:#1c1917}
  h1,h2,h3,h4,h5,h6{line-height:1.3;margin:1.4em 0 .6em}
  pre{background:#f5f5f4;padding:1em;border-radius:8px;overflow:auto}
  code{background:#f5f5f4;padding:.15em .35em;border-radius:4px;font-size:.9em}
  pre code{background:none;padding:0}
  blockquote{margin:1em 0;padding:.2em 1em;border-left:4px solid #d6d3d1;color:#57534e}
  table{border-collapse:collapse;margin:1em 0}
  th,td{border:1px solid #d6d3d1;padding:.4em .8em}
  th{background:#f5f5f4}
  img{max-width:100%}
</style>
</head>
<body>
${html.value}
</body>
</html>`
}

function downloadFile(content: string, name: string, type: string) {
  const blob = new Blob([content], { type: type + ';charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const downloadHtml = () => downloadFile(standaloneHtml(), '文件.html', 'text/html')
const downloadMd = () => downloadFile(input.value, '文件.md', 'text/markdown')

async function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (f) input.value = await f.text()
}

const sample = `# Markdown 預覽

把 **Markdown** 即時渲染成畫面與乾淨的 *HTML*。

## 重點
- 不必把內容貼到線上編輯器,~~外洩風險~~ 沒有
- 支援清單、表格、程式碼
  - 還能 **巢狀** 喔

> 引言:全程在你瀏覽器處理,不上傳。

| 功能 | 支援 |
| --- | :---: |
| 表格 | ✅ |
| 程式碼 | ✅ |

\`\`\`js
const hi = '你好'
console.log(hi)
\`\`\`

詳見 [說明文件](https://example.com)。`

function loadSample() {
  input.value = sample
}
function clearAll() {
  input.value = ''
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 sm:p-6 space-y-5">
      <div>
        <div class="mb-1.5 flex items-center justify-between">
          <label class="field-label !mb-0">貼上或撰寫 Markdown</label>
          <div class="flex gap-3 text-sm">
            <button class="text-brand-700 underline" @click="loadSample">載入範例</button>
            <label class="cursor-pointer text-brand-700 underline">
              開啟檔案
              <input type="file" accept=".md,.markdown,.txt" class="hidden" @change="onFile" />
            </label>
            <button class="text-ink-400 underline hover:text-red-500" @click="clearAll">清空</button>
          </div>
        </div>
        <textarea
          v-model="input"
          rows="10"
          spellcheck="false"
          placeholder="# 標題&#10;&#10;**粗體**、*斜體*、`程式碼`、[連結](https://…)…"
          class="field-input font-mono !text-sm leading-relaxed"
        ></textarea>
        <p class="field-hint">
          {{ counts.chars }} 個字元、{{ counts.lines }} 行 · 內容只在你的瀏覽器渲染,<strong>不連網、不上傳</strong>。
        </p>
      </div>

      <div v-if="input.trim()">
        <div class="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <div class="inline-flex rounded-lg border border-line p-0.5 text-sm">
            <button
              class="rounded-md px-3 py-1.5 font-medium transition"
              :class="view === 'preview' ? 'bg-brand-50 text-brand-800 ring-1 ring-brand-300' : 'text-ink-500 hover:text-ink-800'"
              @click="view = 'preview'"
            >預覽</button>
            <button
              class="rounded-md px-3 py-1.5 font-medium transition"
              :class="view === 'html' ? 'bg-brand-50 text-brand-800 ring-1 ring-brand-300' : 'text-ink-500 hover:text-ink-800'"
              @click="view = 'html'"
            >HTML 原始碼</button>
          </div>
          <div class="flex flex-wrap gap-3 text-sm">
            <button class="text-brand-700 underline" @click="copyRich">{{ copiedRich ? '已複製 ✓' : '複製格式化內容' }}</button>
            <button class="text-brand-700 underline" @click="copyHtml">{{ copiedHtml ? '已複製 ✓' : '複製 HTML' }}</button>
            <button class="text-brand-700 underline" @click="downloadHtml">下載 .html</button>
            <button class="text-brand-700 underline" @click="downloadMd">下載 .md</button>
          </div>
        </div>

        <!-- renderMarkdown 已做 HTML 逸出與網址過濾,輸出可安全放進 v-html -->
        <div
          v-show="view === 'preview'"
          class="md-preview max-h-[32rem] overflow-auto rounded-lg border border-line bg-white px-4 py-3 sm:px-6 sm:py-5"
          v-html="html"
        ></div>
        <textarea
          v-show="view === 'html'"
          :value="html"
          rows="12"
          readonly
          spellcheck="false"
          class="field-input font-mono !text-sm leading-relaxed bg-stone-50"
        ></textarea>
      </div>
    </div>

    <LegalNote title="什麼時候用得到?">
      <ul class="list-disc pl-5 space-y-1">
        <li>寫 <strong>README、技術文件、Notion/HackMD 筆記、部落格</strong>時,即時看排版結果,免來回切換。</li>
        <li><strong>複製格式化內容</strong>:直接貼進 Word / Gmail / Outlook,保留粗體、清單、表格的樣式。</li>
        <li><strong>下載 .html</strong> 後用瀏覽器開啟,即可「列印 → 另存 PDF」做出排版乾淨的 PDF。</li>
        <li>支援標題、粗體/斜體/刪除線、程式碼、連結、圖片、引言、巢狀清單、表格。</li>
        <li>安全:所有文字都會 HTML 逸出、危險網址(<code>javascript:</code> 等)會被擋下;<strong>全程在你瀏覽器,不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>

<style scoped>
/* Tailwind v4 的 reset 會清掉預設樣式,這裡替預覽區補回基本排版 */
.md-preview :deep(h1) { font-size: 1.6em; font-weight: 700; line-height: 1.3; margin: 0.2em 0 0.5em; }
.md-preview :deep(h2) { font-size: 1.35em; font-weight: 700; line-height: 1.3; margin: 1.2em 0 0.5em; border-bottom: 1px solid #e7e5e4; padding-bottom: 0.2em; }
.md-preview :deep(h3) { font-size: 1.15em; font-weight: 700; margin: 1em 0 0.4em; }
.md-preview :deep(h4),
.md-preview :deep(h5),
.md-preview :deep(h6) { font-weight: 700; margin: 1em 0 0.4em; }
.md-preview :deep(p) { margin: 0.7em 0; line-height: 1.75; }
.md-preview :deep(ul) { list-style: disc; padding-left: 1.5em; margin: 0.7em 0; }
.md-preview :deep(ol) { list-style: decimal; padding-left: 1.5em; margin: 0.7em 0; }
.md-preview :deep(li) { margin: 0.25em 0; line-height: 1.7; }
.md-preview :deep(li > ul),
.md-preview :deep(li > ol) { margin: 0.25em 0; }
.md-preview :deep(a) { color: #b45309; text-decoration: underline; }
.md-preview :deep(strong) { font-weight: 700; }
.md-preview :deep(em) { font-style: italic; }
.md-preview :deep(del) { text-decoration: line-through; color: #78716c; }
.md-preview :deep(code) { background: #f5f5f4; padding: 0.1em 0.35em; border-radius: 4px; font-size: 0.9em; }
.md-preview :deep(pre) { background: #f5f5f4; padding: 0.9em 1em; border-radius: 8px; overflow-x: auto; margin: 0.8em 0; }
.md-preview :deep(pre code) { background: none; padding: 0; font-size: 0.85em; }
.md-preview :deep(blockquote) { border-left: 4px solid #d6d3d1; padding: 0.1em 1em; margin: 0.8em 0; color: #57534e; }
.md-preview :deep(hr) { border: 0; border-top: 1px solid #e7e5e4; margin: 1.2em 0; }
.md-preview :deep(table) { border-collapse: collapse; margin: 0.8em 0; display: block; overflow-x: auto; }
.md-preview :deep(th),
.md-preview :deep(td) { border: 1px solid #d6d3d1; padding: 0.4em 0.8em; }
.md-preview :deep(th) { background: #f5f5f4; font-weight: 700; }
.md-preview :deep(img) { max-width: 100%; height: auto; }
</style>
