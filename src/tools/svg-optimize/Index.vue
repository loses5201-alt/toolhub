<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import { optimizeSvg, type SvgOptimizeOptions } from '@/features/svgOptimize'

/*
  SVG 最佳化 / 壓縮 —— 把 Inkscape / Illustrator 匯出時夾帶的註解、metadata、編輯器
  專屬命名空間與屬性、XML 宣告、排版縮排清掉,檔案瞬間瘦一圈。只做「不改變畫面」的
  安全瘦身。全程在你的瀏覽器處理,SVG 不上傳、無廣告。線上 SVG 壓縮站常要上傳檔案又夾廣告。
*/

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Created with Inkscape (http://www.inkscape.org/) -->
<svg
   xmlns="http://www.w3.org/2000/svg"
   xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
   xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.0.dtd"
   width="48" height="48" viewBox="0 0 48 48">
  <metadata>
    <rdf:RDF>產生工具資訊</rdf:RDF>
  </metadata>
  <sodipodi:namedview showgrid="false" inkscape:zoom="9.8" />
  <path
     inkscape:connector-curvature="0"
     d="M24.000000 4.000000 L44.000000 40.000000 L4.000000 40.000000 Z"
     fill="#2563eb" />
</svg>`

const svgText = ref('')
const fileName = ref('')
const fileError = ref('')

const opts = reactive<Required<SvgOptimizeOptions>>({
  removeComments: true,
  removeMetadata: true,
  removeXmlDecl: true,
  removeTitleDesc: false,
  collapseWhitespace: true,
  roundNumbers: false,
  precision: 2,
})

const optionList: { key: keyof SvgOptimizeOptions; label: string; hint: string }[] = [
  { key: 'removeComments', label: '移除註解', hint: '<!-- ... -->' },
  { key: 'removeMetadata', label: '移除 metadata / 編輯器資訊', hint: 'Inkscape、Sodipodi、RDF 命名空間與屬性' },
  { key: 'removeXmlDecl', label: '移除 XML 宣告 / DOCTYPE', hint: '<?xml ?>、<!DOCTYPE>' },
  { key: 'collapseWhitespace', label: '壓除排版縮排', hint: '標籤之間換行縮排的空白' },
  { key: 'removeTitleDesc', label: '移除 title / desc', hint: '預設保留(顧及無障礙)' },
]

const result = computed(() => optimizeSvg(svgText.value, opts))

const hasInput = computed(() => svgText.value.trim().length > 0)

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  return `${(n / 1024).toFixed(1)} KB`
}

// 用 <img> + data URI 預覽(不執行 SVG 內 script,安全),解析失敗則不顯示
function svgDataUri(svg: string): string {
  if (!svg.trim()) return ''
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}
const previewOk = ref(true)
const optimizedUri = computed(() => svgDataUri(result.value.output))

function onFile(e: Event) {
  fileError.value = ''
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  if (!/\.svg$/i.test(f.name) && f.type !== 'image/svg+xml') {
    fileError.value = '請選擇 .svg 檔。'
    return
  }
  fileName.value = f.name
  const reader = new FileReader()
  reader.onload = () => {
    svgText.value = String(reader.result || '')
    previewOk.value = true
  }
  reader.onerror = () => (fileError.value = '讀取檔案失敗。')
  reader.readAsText(f)
}

const copied = ref(false)
function copyOut() {
  if (!result.value.output) return
  navigator.clipboard?.writeText(result.value.output)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

function download() {
  if (!result.value.output) return
  const blob = new Blob([result.value.output], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const base = fileName.value.replace(/\.svg$/i, '') || 'optimized'
  a.download = `${base}.min.svg`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function loadSample() {
  svgText.value = SAMPLE
  fileName.value = 'sample.svg'
  previewOk.value = true
}
function clearAll() {
  svgText.value = ''
  fileName.value = ''
  fileError.value = ''
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div class="flex flex-wrap items-center gap-3">
        <label class="btn-secondary cursor-pointer text-sm">
          <input type="file" accept=".svg,image/svg+xml" class="hidden" @change="onFile" />
          選擇 .svg 檔
        </label>
        <button type="button" class="text-sm text-brand-700 underline hover:text-brand-800" @click="loadSample">
          載入範例
        </button>
        <button
          v-if="hasInput"
          type="button"
          class="text-sm text-ink-500 underline hover:text-ink-700"
          @click="clearAll"
        >
          清空
        </button>
        <span v-if="fileName" class="text-xs text-ink-500">已載入:{{ fileName }}</span>
      </div>

      <div>
        <label class="field-label" for="svg-in">或直接貼上 SVG 原始碼</label>
        <textarea
          id="svg-in"
          v-model="svgText"
          rows="8"
          class="field-input font-mono text-xs"
          spellcheck="false"
          placeholder="<svg xmlns=&quot;http://www.w3.org/2000/svg&quot; ...>"
        />
        <p v-if="fileError" class="mt-1 text-sm text-rose-600">⚠️ {{ fileError }}</p>
      </div>

      <fieldset class="space-y-2">
        <legend class="field-label">瘦身選項</legend>
        <div class="grid gap-2 sm:grid-cols-2">
          <label
            v-for="o in optionList"
            :key="o.key"
            class="flex items-start gap-2 rounded-lg border border-ink-100 p-2 text-sm text-ink-700"
          >
            <input v-model="opts[o.key] as boolean" type="checkbox" class="mt-0.5 rounded" />
            <span>
              {{ o.label }}
              <span class="block text-xs text-ink-400">{{ o.hint }}</span>
            </span>
          </label>
          <label class="flex items-start gap-2 rounded-lg border border-ink-100 p-2 text-sm text-ink-700">
            <input v-model="opts.roundNumbers" type="checkbox" class="mt-0.5 rounded" />
            <span class="flex-1">
              小數四捨五入
              <span class="block text-xs text-ink-400">幾何座標保留位數,壓更小</span>
              <span v-if="opts.roundNumbers" class="mt-1 flex items-center gap-1.5 text-xs">
                位數
                <input
                  v-model.number="opts.precision"
                  type="number"
                  min="0"
                  max="6"
                  class="w-16 rounded border border-ink-200 px-1.5 py-0.5"
                />
              </span>
            </span>
          </label>
        </div>
      </fieldset>
    </div>

    <div v-if="hasInput" class="card p-4 space-y-4">
      <div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span class="text-ink-500">原始 <strong class="text-ink-700">{{ fmtBytes(result.originalBytes) }}</strong></span>
        <span class="text-ink-400">→</span>
        <span class="text-ink-500">最佳化後 <strong class="text-emerald-700">{{ fmtBytes(result.optimizedBytes) }}</strong></span>
        <span
          v-if="result.savedBytes > 0"
          class="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700"
        >
          省下 {{ fmtBytes(result.savedBytes) }}({{ result.savedPercent }}%)
        </span>
        <span v-else class="text-xs text-ink-400">已是精簡狀態</span>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div class="flex flex-col items-center gap-1 rounded-lg border border-ink-100 bg-ink-50/40 p-3">
          <span class="text-xs text-ink-400">最佳化後預覽</span>
          <img
            v-if="optimizedUri && previewOk"
            :src="optimizedUri"
            alt="最佳化後 SVG 預覽"
            class="max-h-32 max-w-full"
            @error="previewOk = false"
          />
          <span v-else class="py-6 text-xs text-ink-400">(無法預覽,但原始碼仍可使用)</span>
        </div>
        <div class="space-y-2">
          <div class="flex items-center gap-3">
            <span class="text-sm font-semibold text-ink-700">最佳化後原始碼</span>
            <button class="ml-auto text-sm text-brand-700 underline hover:text-brand-800" @click="copyOut">
              {{ copied ? '已複製 ✓' : '複製' }}
            </button>
            <button class="btn-primary px-3 py-1 text-sm" @click="download">下載 .min.svg</button>
          </div>
          <textarea
            :value="result.output"
            rows="8"
            readonly
            class="field-input font-mono text-xs"
            spellcheck="false"
          />
        </div>
      </div>
    </div>

    <div class="text-sm text-ink-500">
      需要把 SVG 轉成 PNG / JPG?用
      <RouterLink to="/tools/svg-to-png" class="font-semibold text-brand-700 underline hover:text-brand-800">SVG 轉 PNG</RouterLink>
      。想做網站圖示?試試
      <RouterLink to="/tools/favicon-gen" class="font-semibold text-brand-700 underline hover:text-brand-800">Favicon 產生器</RouterLink>
      。
    </div>

    <LegalNote title="這個工具能、不能做什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>能</strong>:做「不會改變畫面」的安全瘦身 —— 移除註解、<code>&lt;metadata&gt;</code>、Inkscape / Sodipodi / RDF 等編輯器專屬命名空間與屬性、<code>&lt;?xml?&gt;</code> 宣告與 <code>&lt;!DOCTYPE&gt;</code>、標籤之間排版用的縮排換行;可選擇移除 <code>title</code>/<code>desc</code> 或把幾何座標小數四捨五入。</li>
        <li><strong>刻意不做</strong>:合併路徑、刪除「看似多餘」的屬性、改寫顏色等有風險的轉換,以確保輸出與原圖視覺一致。需要極限壓縮可再用 SVGO。</li>
        <li><strong>小數四捨五入</strong>只套用在幾何 / 樣式數值屬性(<code>d</code>、<code>points</code>、<code>transform</code>、座標、寬高、透明度等),指數記號維持原樣。</li>
        <li>全程<strong>在你的瀏覽器</strong>處理,SVG <strong>不上傳、不連網</strong>。預覽以 <code>&lt;img&gt;</code> 載入,不會執行 SVG 內的腳本。</li>
      </ul>
    </LegalNote>
  </div>
</template>
