<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { htmlToMarkdown } from '@/features/htmlToMarkdown'

/*
  HTML 轉 Markdown —— 把網頁 / Notion / Google 文件 / HTML Email 複製來的內容
  轉成乾淨 Markdown。全程在你的瀏覽器計算,不連網、不上傳。
*/
const SAMPLE = `<h2>會議記錄</h2>
<p>專案<strong>進度</strong>如下,詳見 <a href="https://example.com">連結</a>:</p>
<ul>
  <li>後端 API 完成 80%</li>
  <li>前端 <em>進行中</em></li>
</ul>
<blockquote>下週一前交付第一版</blockquote>
<pre><code>npm run build</code></pre>`

const input = ref(SAMPLE)
const markdown = computed(() => htmlToMarkdown(input.value))

const copied = ref(false)
async function copy() {
  try {
    await navigator.clipboard.writeText(markdown.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1200)
  } catch {
    /* 忽略 */
  }
}

function loadSample() {
  input.value = SAMPLE
}
function clearAll() {
  input.value = ''
}
async function paste() {
  try {
    input.value = await navigator.clipboard.readText()
  } catch {
    /* 忽略 */
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-5 space-y-3">
      <div class="flex items-center justify-between gap-2">
        <span class="text-sm font-semibold text-ink-700">貼上 HTML</span>
        <div class="flex gap-2">
          <button
            type="button"
            class="rounded-lg border border-ink-200 px-3 py-1 text-xs text-ink-600 hover:bg-ink-50"
            @click="paste"
          >
            貼上
          </button>
          <button
            type="button"
            class="rounded-lg border border-ink-200 px-3 py-1 text-xs text-ink-600 hover:bg-ink-50"
            @click="loadSample"
          >
            載入範例
          </button>
          <button
            type="button"
            class="rounded-lg border border-ink-200 px-3 py-1 text-xs text-ink-600 hover:bg-ink-50"
            :disabled="!input"
            @click="clearAll"
          >
            清空
          </button>
        </div>
      </div>
      <textarea
        v-model="input"
        rows="10"
        spellcheck="false"
        class="h2m-input font-mono"
        placeholder="把網頁原始碼或從 Notion / Google 文件複製的 HTML 貼進來……"
      ></textarea>
    </div>

    <div class="card p-5 space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-sm font-semibold text-ink-700">Markdown 結果</span>
        <button
          type="button"
          class="rounded-lg border border-ink-200 px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          :disabled="!markdown"
          @click="copy"
        >
          {{ copied ? '已複製' : '複製 Markdown' }}
        </button>
      </div>
      <pre class="h2m-output">{{ markdown || '—' }}</pre>
    </div>

    <LegalNote title="這支工具能轉什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>支援標題、<strong>粗體</strong>/<em>斜體</em>/刪除線、連結、圖片、有序/無序(含巢狀)清單、引言、行內與區塊程式碼、表格、分隔線、換行,並自動解開 <code class="font-mono">&amp;amp;</code> 等 HTML 實體。</li>
        <li><code class="font-mono">&lt;script&gt;</code>、<code class="font-mono">&lt;style&gt;</code>、註解與 DOCTYPE 會被略過,只保留可讀內容。</li>
        <li>內建輕量解析器、容忍未閉合標籤;若來源 HTML 很複雜(深層巢狀、特殊樣式),結果可能需要手動微調。</li>
        <li>適合把<strong>網頁、Notion、Google 文件、HTML Email</strong>的內容搬進 Markdown 筆記 / README / 部落格。反向(Markdown 轉 HTML 預覽)請用「Markdown 預覽」。</li>
        <li>全程在你的瀏覽器即時轉換,<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>

<style scoped>
.h2m-input {
  width: 100%;
  border: 1px solid var(--color-ink-200, #e2e8f0);
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
  font-size: 0.85rem;
  line-height: 1.5;
  resize: vertical;
}
.h2m-output {
  margin: 0;
  min-height: 6rem;
  border-radius: 0.5rem;
  padding: 0.75rem;
  background: var(--color-ink-50, #f8fafc);
  color: var(--color-ink-800, #1e293b);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.875rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
