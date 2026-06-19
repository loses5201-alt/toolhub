<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { htmlToText } from '@/features/htmlToText'

/*
  HTML 轉純文字 —— 把從網頁/HTML 信件複製來的內容去掉標籤、解開實體,保留段落換行。
  全程在你瀏覽器處理,不連網、不上傳。
*/

const input = ref('')

const output = computed(() => htmlToText(input.value))
const charCount = computed(() => output.value.length)

async function copy() {
  try {
    await navigator.clipboard.writeText(output.value)
  } catch {
    /* 忽略 */
  }
}

const sample = '<h2>公告</h2>\n<p>親愛的會員 &amp; 朋友:</p>\n<ul>\n  <li>活動時間:6/20 &nbsp;14:00</li>\n  <li>地點:<b>台北</b></li>\n</ul>\n<p>詳情請見 <a href="https://example.com">官網</a>。</p>'
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
          placeholder="<p>貼上含標籤的內容…</p>"
          spellcheck="false"
        ></textarea>
        <p class="field-hint">
          會去掉所有標籤、移除 script/style、解開 <code>&amp;amp;</code> 等實體,並保留段落換行。<strong>不連網、不上傳</strong>。
        </p>
      </div>

      <div v-if="input !== ''">
        <div class="mb-1 flex items-center justify-between">
          <label class="field-label !mb-0">純文字結果（{{ charCount }} 字）</label>
          <button
            type="button"
            class="rounded-lg border border-ink-200 px-2.5 py-1 text-xs text-ink-600 transition hover:bg-ink-50"
            @click="copy"
          >
            複製
          </button>
        </div>
        <pre class="max-h-96 overflow-auto rounded-lg bg-ink-50 px-3 py-2 font-mono text-sm text-ink-800 whitespace-pre-wrap break-words">{{ output }}</pre>
      </div>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>把網頁、HTML 電子報、後台複製來的內容<strong>洗成乾淨純文字</strong>,免被一堆標籤干擾。</li>
        <li>自動<strong>解開 HTML 實體</strong>(<code>&amp;amp;</code>→<code>&amp;</code>、<code>&amp;nbsp;</code>→空白、<code>&amp;#39;</code>→<code>'</code>)。</li>
        <li>保留段落、清單、表格的<strong>換行與分隔</strong>,讀起來不黏在一起。</li>
        <li>會移除 <code>&lt;script&gt;</code>、<code>&lt;style&gt;</code> 與註解,只留你要的文字。</li>
        <li>盡力而為:非常複雜的版面不保證完美,但一般內文夠用。<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
