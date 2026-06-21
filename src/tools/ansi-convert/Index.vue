<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { ansiToHtml, stripAnsi } from '@/features/ansiConvert'

/*
  ANSI 終端機色碼轉換 —— 把 CI log / 彩色 console 輸出的跳脫碼,
  即時預覽成顏色、轉成可貼進文件的 HTML,或清成乾淨純文字。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

const ESC = String.fromCharCode(27)

// 範例:含 16 色、粗體、256 色、真彩、清行碼
const SAMPLE =
  `${ESC}[1;32m✔ build succeeded${ESC}[0m  ${ESC}[2m(2.3s)${ESC}[0m\n` +
  `${ESC}[1;31m✖ 2 errors${ESC}[0m, ${ESC}[33m1 warning${ESC}[0m\n` +
  `  ${ESC}[36msrc/app.ts${ESC}[0m:${ESC}[35m42${ESC}[0m  ${ESC}[31mType 'string' is not assignable${ESC}[0m\n` +
  `  ${ESC}[38;5;208m256 色橘${ESC}[0m / ${ESC}[38;2;120;200;255m真彩天藍${ESC}[0m / ${ESC}[4;34m底線連結${ESC}[0m\n` +
  `${ESC}[7m 反白標題 ${ESC}[0m array[0] = "ok"`

const input = ref(SAMPLE)

// 預覽用深色終端機背景,inverse/未指定色時的預設前景/背景
const htmlForDisplay = computed(() =>
  ansiToHtml(input.value, { defaultFg: '#e6e6e6', defaultBg: '#1e1e1e' }),
)
const htmlForCopy = computed(() => ansiToHtml(input.value))
const plain = computed(() => stripAnsi(input.value))

const hasEscape = computed(() => input.value.includes(ESC))

const copied = ref('')
async function copy(text: string, k: string) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = k
    setTimeout(() => (copied.value = ''), 1200)
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
</script>

<template>
  <div class="space-y-6">
    <div class="card p-5 space-y-3">
      <div class="flex items-center justify-between gap-2">
        <span class="text-sm font-semibold text-ink-700">貼上含 ANSI 色碼的文字</span>
        <div class="flex gap-2">
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
        rows="6"
        spellcheck="false"
        class="ac-input font-mono"
        placeholder="把終端機 / CI log 的輸出整段貼進來……"
      ></textarea>
      <p v-if="input && !hasEscape" class="text-xs text-amber-600">
        ⚠️ 這段文字裡沒有 ANSI 跳脫字元(ESC)。複製貼上時跳脫碼常被吃掉 —— 試試把指令輸出存成檔再貼,
        或在原指令加上 <code class="font-mono">--color=always</code> / 用 <code class="font-mono">script</code> 錄製。
      </p>
    </div>

    <!-- 預覽 -->
    <div class="card p-5 space-y-2">
      <span class="text-sm font-semibold text-ink-700">彩色預覽</span>
      <!-- v-html 安全:ansiToHtml 已對文字做 HTML 跳脫,只輸出我們產生的 inline 顏色樣式 -->
      <pre
        class="ac-preview"
        v-html="htmlForDisplay || '—'"
      ></pre>
    </div>

    <!-- HTML 輸出 -->
    <div class="card p-5 space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-sm font-semibold text-ink-700">HTML(內嵌樣式,可貼進部落格 / Email / 文件)</span>
        <button
          type="button"
          class="rounded-lg border border-ink-200 px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          :disabled="!htmlForCopy"
          @click="copy(htmlForCopy, 'html')"
        >
          {{ copied === 'html' ? '已複製' : '複製 HTML' }}
        </button>
      </div>
      <div class="ac-code">{{ htmlForCopy || '—' }}</div>
    </div>

    <!-- 純文字輸出 -->
    <div class="card p-5 space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-sm font-semibold text-ink-700">純文字(拿掉所有色碼)</span>
        <button
          type="button"
          class="rounded-lg border border-ink-200 px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          :disabled="!plain"
          @click="copy(plain, 'plain')"
        >
          {{ copied === 'plain' ? '已複製' : '複製純文字' }}
        </button>
      </div>
      <pre class="ac-plain">{{ plain || '—' }}</pre>
    </div>

    <LegalNote>
      <p>
        終端機用 <strong>ANSI 跳脫碼</strong>(ECMA-48 SGR,例如
        <code class="font-mono">ESC[31m</code>=紅字)來上色。把彩色輸出貼進
        GitHub Issue、文件或 Email 時,這些碼會變成一堆亂碼或被吃掉 —— 這支工具幫你:
      </p>
      <p>
        <strong>彩色預覽</strong>還原成你在終端機看到的樣子;<strong>HTML</strong>
        轉成內嵌樣式、保留顏色貼到任何地方;<strong>純文字</strong>則把色碼整段清掉,
        連游標移動、清行(CSI)、視窗標題(OSC)等控制序列也一併移除。
      </p>
      <p>
        支援 16 色、256 色(<code class="font-mono">38;5;n</code>)、24-bit 真彩
        (<code class="font-mono">38;2;r;g;b</code>)、粗體、淡化、斜體、底線、刪除線與反白。
      </p>
      <p>
        小提醒:複製貼上時 ESC 字元常會遺失,讓工具收到的是「看起來有顏色標記、其實沒控制碼」的文字。
        想保留色碼,可在指令加 <code class="font-mono">--color=always</code>、用
        <code class="font-mono">script -q out.txt 你的指令</code> 錄製,再貼錄下來的檔案內容。
        全程在你的瀏覽器計算,<strong>不連網、不上傳</strong>。
      </p>
    </LegalNote>
  </div>
</template>

<style scoped>
.ac-input {
  width: 100%;
  border: 1px solid var(--color-ink-200, #e2e8f0);
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
  font-size: 0.9rem;
  line-height: 1.5;
  resize: vertical;
  white-space: pre;
  overflow-x: auto;
}
.ac-preview {
  margin: 0;
  border-radius: 0.5rem;
  padding: 0.875rem 1rem;
  background: #1e1e1e;
  color: #e6e6e6;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.9rem;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-x: auto;
  min-height: 3rem;
}
.ac-code {
  border-radius: 0.5rem;
  padding: 0.75rem;
  background: var(--color-ink-50, #f8fafc);
  color: var(--color-ink-800, #1e293b);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.8rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  min-height: 3rem;
}
.ac-plain {
  margin: 0;
  border-radius: 0.5rem;
  padding: 0.75rem;
  background: var(--color-ink-50, #f8fafc);
  color: var(--color-ink-800, #1e293b);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.9rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  min-height: 3rem;
}
</style>
