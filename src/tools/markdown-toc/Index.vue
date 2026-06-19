<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import { parseHeadings, buildToc } from '@/features/markdownToc'

/*
  Markdown 目錄(TOC)產生器 —— 從 Markdown 標題自動產生帶錨點連結的目錄,
  錨點採 GitHub 風格 slug,貼回 README / Issue / Notion / HackMD 即可點擊跳轉。
  全程在你的瀏覽器處理,內容不上傳。
*/

const input = ref(
  '# 專案名稱\n\n簡介文字。\n\n## 安裝\n\n### 需求\n\n### 步驟\n\n## 使用方式\n\n## API 參考\n\n## 授權',
)
const ordered = ref(false)
const minLevel = ref(1)
const maxLevel = ref(6)

const headings = computed(() => parseHeadings(input.value))
const toc = computed(() =>
  buildToc(headings.value, {
    ordered: ordered.value,
    minLevel: minLevel.value,
    maxLevel: maxLevel.value,
  }),
)

const levels = [1, 2, 3, 4, 5, 6]

const copied = ref(false)
function copy() {
  if (!toc.value) return
  navigator.clipboard?.writeText(toc.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">Markdown 內容</label>
        <textarea
          v-model="input"
          rows="12"
          class="field-input font-mono text-xs leading-relaxed"
          spellcheck="false"
        />
        <p class="field-hint">貼上 Markdown,會抓出 <code># ~ ######</code> 標題產生目錄。全程在你的瀏覽器處理,不上傳。</p>
      </div>
      <div class="flex flex-wrap items-center gap-4 text-sm text-ink-600">
        <label class="flex items-center gap-1.5">
          <input v-model="ordered" type="checkbox" class="rounded" />
          有序清單(1. 2.)
        </label>
        <label class="flex items-center gap-1.5">
          收錄層級
          <select v-model.number="minLevel" class="rounded-lg border border-ink-200 px-2 py-1">
            <option v-for="l in levels" :key="l" :value="l">H{{ l }}</option>
          </select>
          至
          <select v-model.number="maxLevel" class="rounded-lg border border-ink-200 px-2 py-1">
            <option v-for="l in levels" :key="l" :value="l">H{{ l }}</option>
          </select>
        </label>
        <span class="text-ink-400">共 {{ headings.length }} 個標題</span>
      </div>
    </div>

    <div v-if="toc" class="card p-4 space-y-2">
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-ink-700">目錄(Markdown)</span>
        <button class="ml-auto text-sm text-brand-700 underline hover:text-brand-800" @click="copy">
          {{ copied ? '已複製 ✓' : '複製' }}
        </button>
      </div>
      <pre class="overflow-x-auto rounded-lg bg-ink-900 p-4 text-xs leading-relaxed text-ink-50"><code>{{ toc }}</code></pre>
    </div>
    <div v-else class="rounded-xl border border-ink-100 bg-stone-50 p-4 text-sm text-ink-500">
      還沒抓到標題 —— 確認內容含 <code># 標題</code>(<code>#</code> 後要有空白),或調整收錄層級。
    </div>

    <div class="text-sm text-ink-500">
      想直接<strong>預覽 Markdown</strong> 或轉成 HTML?用
      <RouterLink to="/tools/markdown-preview" class="font-semibold text-brand-700 underline hover:text-brand-800">
        Markdown 預覽
      </RouterLink>
      。
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>寫 <strong>README / 文件 / Issue / Notion / HackMD</strong> 時,自動生出可點擊跳轉的目錄,免手刻錨點。</li>
        <li>錨點採 <strong>GitHub 風格 slug</strong>(保留中文與底線、去標點、空白轉連字號、重複標題自動加 <code>-1</code>),貼到 GitHub 就能正確跳轉。</li>
        <li>會<strong>略過程式碼區塊</strong>內的 <code>#</code>,不會誤判成標題;標題裡的粗體/連結/行內碼也會處理乾淨。</li>
        <li>可選有序/無序清單、限定收錄的標題層級(例如只收 H2–H3)。</li>
        <li>全程<strong>在你的瀏覽器</strong>處理,內容<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
