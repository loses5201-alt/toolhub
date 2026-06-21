<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { htmlToMarkdown } from '@/features/htmlToMarkdown'

/*
  HTML 轉 Markdown —— 把網頁、HTML 電子報、Notion/Google Docs 複製來的內容
  轉成保留結構的 Markdown(標題、清單、連結、粗體、表格、引言、程式碼)。
  全程在你瀏覽器處理,不連網、不上傳。
*/

const input = ref('')

const output = computed(() => htmlToMarkdown(input.value))
const lineCount = computed(() => (output.value ? output.value.split('\n').length : 0))
const charCount = computed(() => output.value.length)

const copied = ref(false)
async function copy() {
  try {
    await navigator.clipboard.writeText(output.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    /* 忽略 */
  }
}

function download() {
  const blob = new Blob([output.value], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'content.md'
  a.click()
  URL.revokeObjectURL(url)
}

const sample =
  '<h2>會議紀錄</h2>\n<p>本週重點 &amp; 待辦:</p>\n<ul>\n  <li>完成 <b>季報</b>初稿</li>\n  <li>聯絡 <a href="https://example.com">供應商</a></li>\n</ul>\n<blockquote>下週一前回覆</blockquote>\n<pre><code class="language-bash">npm run build</code></pre>'
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <div class="mb-1 flex items-center justify-between">
          <label class="field-label !mb-0">貼上 HTML 或網頁原始碼</label>
          <button
            type="button"
            class="rounded-lg border border-ink-200 px-2.5 py-1 text-xs text-ink-600 transition hover:bg-ink-50"
            @click="input = sample"
          >
            放入範例
          </button>
        </div>
        <textarea
          v-model="input"
          rows="8"
          class="field-input font-mono text-sm"
          placeholder="<h2>標題</h2><p>貼上含標籤的內容…</p>"
          spellcheck="false"
        ></textarea>
        <p class="field-hint">
          會把標題、清單、連結、粗體、表格、引言、程式碼轉成對應的 Markdown,並移除
          <code>&lt;script&gt;</code>/<code>&lt;style&gt;</code> 與註解。<strong>不連網、不上傳</strong>。
        </p>
      </div>

      <div v-if="input !== ''">
        <div class="mb-1 flex items-center justify-between">
          <label class="field-label !mb-0">Markdown 結果（{{ lineCount }} 行 / {{ charCount }} 字）</label>
          <div class="flex gap-2">
            <button
              type="button"
              class="rounded-lg border border-ink-200 px-2.5 py-1 text-xs text-ink-600 transition hover:bg-ink-50"
              @click="copy"
            >
              {{ copied ? '已複製 ✓' : '複製' }}
            </button>
            <button
              type="button"
              class="rounded-lg border border-ink-200 px-2.5 py-1 text-xs text-ink-600 transition hover:bg-ink-50"
              @click="download"
            >
              下載 .md
            </button>
          </div>
        </div>
        <pre
          class="max-h-96 overflow-auto rounded-lg bg-ink-50 px-3 py-2 font-mono text-sm text-ink-800 whitespace-pre-wrap break-words"
          >{{ output || '（沒有可轉換的內容)' }}</pre
        >
      </div>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>把網頁、HTML 電子報、Notion / Google Docs 複製來的內容,轉成<strong>保留結構的 Markdown</strong>,直接貼進 README / Issue / 筆記。</li>
        <li>支援<strong>標題、清單(含巢狀)、連結、圖片、粗體 / 斜體 / 刪除線、行內與區塊程式碼、引言、表格、分隔線</strong>。</li>
        <li>自動<strong>解開 HTML 實體</strong>(<code>&amp;amp;</code>→<code>&amp;</code>、<code>&amp;nbsp;</code>→空白),並移除 <code>&lt;script&gt;</code>、<code>&lt;style&gt;</code> 與註解。</li>
        <li>與 <strong>HTML 轉純文字</strong>(只留文字)、<strong>Markdown 預覽 / 轉 HTML</strong>(反向)互補。</li>
        <li>盡力而為:非常複雜的版面不保證完美,但一般內文夠用。<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
