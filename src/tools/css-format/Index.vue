<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import { formatCss, minifyCss } from '@/features/cssFormat'

/*
  CSS 格式化 / 壓縮 —— 把擠成一行或排版凌亂的 CSS 整理成可讀格式,或反向壓成單行。
  全程在你的瀏覽器執行、不連網、不上傳。
*/

const input = ref(
  'body{margin:0;font-family:system-ui}.btn,.btn-primary{padding:8px 16px;border-radius:8px;background:url(data:image/svg+xml;utf8,<svg/>)}@media (max-width:600px){.btn{width:100%}}',
)
const indent = ref(2)
const mode = ref<'pretty' | 'minify'>('pretty')

const result = computed(() =>
  mode.value === 'minify' ? minifyCss(input.value) : formatCss(input.value, { indent: indent.value }),
)

const copied = ref(false)
function copy() {
  if (!result.value.output) return
  navigator.clipboard?.writeText(result.value.output)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">貼上 CSS</label>
        <textarea
          v-model="input"
          rows="8"
          class="field-input font-mono text-xs leading-relaxed"
          spellcheck="false"
          placeholder=".btn { color: red; }"
        />
        <p class="field-hint">字串、註解與 url() 內容(含 data URI)原樣保留。全程在你的瀏覽器處理,不上傳。</p>
      </div>

      <div class="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
        <div class="flex items-center gap-2">
          <span class="text-ink-600">模式</span>
          <div class="inline-flex overflow-hidden rounded-lg border border-ink-200">
            <button
              class="px-3 py-1"
              :class="mode === 'pretty' ? 'bg-brand-600 text-white' : 'bg-white text-ink-600'"
              @click="mode = 'pretty'"
            >
              美化
            </button>
            <button
              class="px-3 py-1"
              :class="mode === 'minify' ? 'bg-brand-600 text-white' : 'bg-white text-ink-600'"
              @click="mode = 'minify'"
            >
              壓成單行
            </button>
          </div>
        </div>

        <label v-if="mode === 'pretty'" class="flex items-center gap-2">
          <span class="text-ink-600">縮排</span>
          <select v-model.number="indent" class="field-input !w-auto !py-1">
            <option :value="2">2 空格</option>
            <option :value="4">4 空格</option>
          </select>
        </label>
      </div>
    </div>

    <div v-if="result.output" class="card p-4 space-y-2">
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-emerald-700">✓ {{ mode === 'minify' ? '已壓成單行' : '已格式化' }}</span>
        <button class="ml-auto text-sm text-brand-700 underline hover:text-brand-800" @click="copy">
          {{ copied ? '已複製 ✓' : '複製' }}
        </button>
      </div>
      <pre class="overflow-x-auto rounded-lg bg-ink-900 p-4 text-xs leading-relaxed text-ink-50"><code>{{ result.output }}</code></pre>
    </div>

    <div class="text-sm text-ink-500">
      也可調
      <RouterLink to="/tools/gradient-maker" class="font-semibold text-brand-700 underline hover:text-brand-800">CSS 漸層</RouterLink>、
      <RouterLink to="/tools/box-shadow" class="font-semibold text-brand-700 underline hover:text-brand-800">陰影</RouterLink>,
      或格式化
      <RouterLink to="/tools/sql-format" class="font-semibold text-brand-700 underline hover:text-brand-800">SQL</RouterLink>
      /
      <RouterLink to="/tools/xml-format" class="font-semibold text-brand-700 underline hover:text-brand-800">XML</RouterLink>。
    </div>

    <LegalNote title="這個工具能、不能做什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>能</strong>:把單行/凌亂的 CSS 排成每條宣告獨立一行、選擇器逗號各自成行、巢狀 <code>@media</code> 縮排的可讀格式,或反向<strong>壓成單行</strong>。</li>
        <li><strong>能</strong>:正確處理容易出錯的地方 —— <code>url(data:...;base64,...)</code> 內的 <code>;</code> 與 <code>,</code> 不被誤切、<code>a:hover</code> 的偽類冒號不被當成宣告冒號、字串與註解原樣保留。</li>
        <li><strong>不能</strong>:它是排版器、不驗證 CSS 是否正確,也不自動加廠商前綴;會收斂多餘空白,壓縮模式會移除註解。</li>
        <li>全程<strong>在你的瀏覽器</strong>處理,內容<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
