<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import { formatXml, minifyXml } from '@/features/xmlFormat'

/*
  XML 格式化 / 壓縮 —— 把擠成一行的 XML / SVG / RSS / pom.xml / 設定檔重新縮排成可讀格式,
  或反向壓成單行。XML 設定常含連線字串、密鑰,不該貼到陌生線上工具;
  這支全程在你的瀏覽器執行、不連網、不上傳。
*/

const input = ref(
  '<?xml version="1.0" encoding="UTF-8"?><note priority="high"><to>家人</to><from>我</from><body>記得帶傘 <![CDATA[ <晴/雨> ]]></body><!-- 提醒 --></note>',
)
const indent = ref(2)
const mode = ref<'pretty' | 'minify'>('pretty')

const result = computed(() =>
  mode.value === 'minify' ? minifyXml(input.value) : formatXml(input.value, { indent: indent.value }),
)

const copied = ref(false)
function copy() {
  if (!result.value.ok || !result.value.output) return
  navigator.clipboard?.writeText(result.value.output)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">貼上 XML</label>
        <textarea
          v-model="input"
          rows="8"
          class="field-input font-mono text-xs leading-relaxed"
          spellcheck="false"
          placeholder='<root><item id="1">x</item></root>'
        />
        <p class="field-hint">支援 SVG、RSS、pom.xml 等;註解、CDATA、宣告與屬性值原樣保留。全程在你的瀏覽器處理,不上傳。</p>
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

    <div v-if="!result.ok" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
      ⚠️ XML 格式有誤:{{ result.error }}
    </div>

    <div v-else-if="result.output" class="card p-4 space-y-2">
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-emerald-700">✓ {{ mode === 'minify' ? '已壓成單行' : '已格式化' }}</span>
        <button class="ml-auto text-sm text-brand-700 underline hover:text-brand-800" @click="copy">
          {{ copied ? '已複製 ✓' : '複製' }}
        </button>
      </div>
      <pre class="overflow-x-auto rounded-lg bg-ink-900 p-4 text-xs leading-relaxed text-ink-50"><code>{{ result.output }}</code></pre>
    </div>

    <div class="text-sm text-ink-500">
      要轉
      <RouterLink to="/tools/json-yaml" class="font-semibold text-brand-700 underline hover:text-brand-800">JSON ↔ YAML</RouterLink>、
      整理
      <RouterLink to="/tools/json-repair" class="font-semibold text-brand-700 underline hover:text-brand-800">JSON</RouterLink>,
      或把
      <RouterLink to="/tools/svg-to-png" class="font-semibold text-brand-700 underline hover:text-brand-800">SVG 轉成 PNG</RouterLink>?
    </div>

    <LegalNote title="這個工具能、不能做什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>能</strong>:把單行/凌亂的 XML 重新縮排成可讀格式,或反向<strong>壓成單行</strong>。適用 SVG、RSS/Atom、<code>pom.xml</code>、Android 版面、各式設定檔。</li>
        <li><strong>能</strong>:正確保留<strong>註解、CDATA、<code>&lt;?xml?&gt;</code> 宣告、DOCTYPE</strong> 與屬性值;標籤內多餘空白會收斂成單一空格。</li>
        <li><strong>不改動內容</strong>:文字與 <code>&amp;lt;</code> 等實體原樣保留。標籤不相符、未關閉時會誠實報錯。</li>
        <li><strong>不能</strong>:它是排版器、不做 schema(DTD/XSD)驗證;「文字與子標籤混雜」的內容重排時各節點會各自成行、空白被正規化。</li>
        <li>全程<strong>在你的瀏覽器</strong>處理,含連線字串/密鑰的設定<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
