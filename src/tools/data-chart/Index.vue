<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parseTable } from '@/features/tableClean'
import { buildChartData, renderChart, parseNumber, type ChartType } from '@/features/chartSvg'

/*
  資料圖表產生器 —— 貼上 CSV/TSV(或從 Excel/試算表複製),選欄位畫成長條圖/折線圖/圓餅圖,
  下載 SVG 或 PNG。全程在你瀏覽器繪製,資料不上傳。與「表格統計/樞紐」互補(那支算數字、這支畫圖)。
*/
const input = ref('')
const delimiter = ref<',' | '\t' | ';'>(',')
const hasHeader = ref(true)
const chartType = ref<ChartType>('bar')
const title = ref('')
const labelCol = ref(0)
const valueCols = ref<number[]>([1])
const showValues = ref(true)
const showLegend = ref(true)
const copied = ref(false)

const source = computed(() =>
  input.value.trim() ? parseTable(input.value, { delimiter: delimiter.value, hasHeader: hasHeader.value }) : { headers: [], rows: [] },
)
const ready = computed(() => source.value.headers.length > 0 && source.value.rows.length > 0)

// 哪些欄看起來是數字(過半的非空格可解析為數字)
const numericCols = computed(() => {
  const t = source.value
  return t.headers.map((_, ci) => {
    const vals = t.rows.map((r) => r[ci] ?? '').filter((v) => v.trim() !== '')
    if (!vals.length) return false
    const ok = vals.filter((v) => Number.isFinite(parseNumber(v))).length
    return ok / vals.length >= 0.6
  })
})

watch(source, () => {
  const t = source.value
  if (labelCol.value >= t.headers.length) labelCol.value = 0
  // 預設值欄位:第一個數字欄(非標籤欄)
  const firstNum = numericCols.value.findIndex((n, i) => n && i !== labelCol.value)
  const valid = valueCols.value.filter((c) => c < t.headers.length && c !== labelCol.value)
  valueCols.value = valid.length ? valid : firstNum >= 0 ? [firstNum] : t.headers.length > 1 ? [1] : []
})

const effectiveCols = computed(() => {
  // 圓餅圖只用一個數列
  const cols = valueCols.value.filter((c) => c !== labelCol.value)
  return chartType.value === 'pie' ? cols.slice(0, 1) : cols
})

function toggleCol(i: number) {
  if (i === labelCol.value) return
  const s = new Set(valueCols.value)
  s.has(i) ? s.delete(i) : s.add(i)
  valueCols.value = [...s].sort((a, b) => a - b)
}

const svg = computed(() => {
  if (!ready.value || effectiveCols.value.length === 0) return ''
  const data = buildChartData(source.value, labelCol.value, effectiveCols.value)
  return renderChart(chartType.value, data, {
    title: title.value.trim() || undefined,
    showValues: showValues.value,
    showLegend: showLegend.value,
  })
})

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function fileName(ext: string) {
  return `${title.value.trim() || '圖表'}.${ext}`
}
function downloadSVG() {
  if (svg.value) triggerDownload(new Blob([svg.value], { type: 'image/svg+xml;charset=utf-8' }), fileName('svg'))
}
function downloadPNG() {
  if (!svg.value) return
  const scale = 2
  const blob = new Blob([svg.value], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = img.width * scale
    canvas.height = img.height * scale
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    URL.revokeObjectURL(url)
    canvas.toBlob((b) => b && triggerDownload(b, fileName('png')), 'image/png')
  }
  img.onerror = () => URL.revokeObjectURL(url)
  img.src = url
}
async function copySVG() {
  if (!svg.value) return
  try {
    await navigator.clipboard.writeText(svg.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    /* 使用者可改用下載 */
  }
}
async function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!f) return
  if (f.name.toLowerCase().endsWith('.tsv')) delimiter.value = '\t'
  input.value = await f.text()
}

const types: { v: ChartType; label: string; icon: string }[] = [
  { v: 'bar', label: '長條圖', icon: '📊' },
  { v: 'line', label: '折線圖', icon: '📈' },
  { v: 'pie', label: '圓餅圖', icon: '🥧' },
]
const delimLabel: Record<string, string> = { ',': '逗號 ,', '\t': 'Tab 定位', ';': '分號 ;' }
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 sm:p-6 space-y-5">
      <div>
        <div class="mb-1.5 flex items-center justify-between">
          <label class="field-label !mb-0">貼上 CSV / TSV(或從 Excel、Google 試算表複製整塊貼上)</label>
          <label class="cursor-pointer text-sm text-brand-700 underline">
            或選擇檔案
            <input type="file" accept=".csv,.tsv,.txt" class="hidden" @change="onFile" />
          </label>
        </div>
        <textarea
          v-model="input"
          rows="6"
          spellcheck="false"
          placeholder="月份,收入,支出&#10;一月,1200,800&#10;二月,1500,900&#10;三月,900,1100"
          class="field-input font-mono !text-sm leading-relaxed"
        ></textarea>
        <div class="mt-2 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <label class="flex items-center gap-2">
            <span class="text-ink-600">分隔符</span>
            <select v-model="delimiter" class="rounded-lg border border-line bg-white px-2 py-1.5">
              <option v-for="(lab, val) in delimLabel" :key="val" :value="val">{{ lab }}</option>
            </select>
          </label>
          <label class="flex items-center gap-2">
            <input v-model="hasHeader" type="checkbox" class="accent-brand-600 h-4 w-4" />
            <span class="text-ink-700">第一列是欄位名稱</span>
          </label>
          <span v-if="ready" class="text-ink-400">{{ source.rows.length }} 列 × {{ source.headers.length }} 欄</span>
        </div>
        <p class="field-hint">資料只在你的瀏覽器處理、用來繪圖,不會上傳到任何伺服器。</p>
      </div>

      <!-- 設定 -->
      <div v-if="ready" class="space-y-4 rounded-xl border border-line bg-stone-50/60 p-4">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-sm text-ink-700">圖表類型</span>
          <div class="flex gap-1.5">
            <button
              v-for="t in types"
              :key="t.v"
              class="rounded-lg border px-3 py-1.5 text-sm transition"
              :class="chartType === t.v ? 'border-brand-500 bg-brand-50 text-brand-800 font-medium' : 'border-line bg-white text-ink-600 hover:border-brand-300'"
              @click="chartType = t.v"
            >
              {{ t.icon }} {{ t.label }}
            </button>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-3 text-sm">
          <label class="flex items-center gap-2">
            <span class="text-ink-700">類別(X 軸)</span>
            <select v-model.number="labelCol" class="rounded-lg border border-line bg-white px-2 py-1.5">
              <option v-for="(h, i) in source.headers" :key="i" :value="i">{{ h }}</option>
            </select>
          </label>
          <label class="flex items-center gap-2">
            <span class="text-ink-700">標題</span>
            <input v-model="title" type="text" placeholder="(選填)" class="rounded-lg border border-line bg-white px-2 py-1.5 w-44" />
          </label>
        </div>

        <div class="text-sm">
          <span class="text-ink-700">{{ chartType === 'pie' ? '數值欄(圓餅圖取第一個)' : '數值欄(可多選比較)' }}</span>
          <div class="mt-1.5 flex flex-wrap gap-1.5">
            <button
              v-for="(h, i) in source.headers"
              :key="i"
              v-show="i !== labelCol"
              class="rounded-lg border px-3 py-1.5 transition"
              :class="valueCols.includes(i) ? 'border-brand-500 bg-brand-50 text-brand-800 font-medium' : 'border-line bg-white text-ink-600 hover:border-brand-300'"
              @click="toggleCol(i)"
            >
              {{ h }}<span v-if="!numericCols[i]" class="ml-1 text-xs text-amber-600" title="這欄似乎不是數字">⚠</span>
            </button>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <label v-if="chartType === 'bar' && effectiveCols.length === 1" class="flex items-center gap-2">
            <input v-model="showValues" type="checkbox" class="accent-brand-600 h-4 w-4" />
            <span class="text-ink-700">在長條上顯示數值</span>
          </label>
          <label v-if="chartType !== 'pie' && effectiveCols.length > 1" class="flex items-center gap-2">
            <input v-model="showLegend" type="checkbox" class="accent-brand-600 h-4 w-4" />
            <span class="text-ink-700">顯示圖例</span>
          </label>
        </div>
      </div>

      <!-- 結果 -->
      <div v-if="svg">
        <div class="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <label class="field-label !mb-0">預覽</label>
          <div class="flex gap-3 text-sm">
            <button class="text-brand-700 underline" @click="copySVG">{{ copied ? '已複製 ✓' : '複製 SVG' }}</button>
            <button class="text-brand-700 underline" @click="downloadSVG">下載 SVG</button>
            <button class="text-brand-700 underline" @click="downloadPNG">下載 PNG</button>
          </div>
        </div>
        <div class="overflow-x-auto rounded-xl border border-line bg-white p-2" v-html="svg"></div>
        <p class="field-hint">SVG 是向量圖(放大不模糊、可在 Illustrator/Figma 再編輯);PNG 是一般圖片,方便貼進簡報、文件、社群。</p>
      </div>
      <div v-else-if="ready" class="rounded-xl border border-dashed border-line bg-stone-50/40 p-6 text-center text-sm text-ink-500">
        請至少選一個數值欄來繪圖。
      </div>
    </div>

    <LegalNote title="把資料變成圖,不必上傳到陌生網站">
      <ul class="list-disc pl-5 space-y-1">
        <li>貼上表格 → 選類別欄與數值欄 → 立刻得到<strong>長條圖、折線圖或圓餅圖</strong>,可下載 SVG / PNG。</li>
        <li><strong>不上傳</strong>:含營業數字、成績、明細的資料全程留在你電腦,線上繪圖網站常要你註冊或上傳。</li>
        <li>數值會自動忽略<strong>千分位逗號、貨幣與百分比符號、前後空白</strong>;某格不是數字時當作 0。</li>
        <li>長條圖、折線圖可<strong>選多個數值欄一起比較</strong>(自動配色加圖例);圓餅圖取第一個數值欄、自動算百分比。</li>
        <li>需要先依分類加總/平均再畫圖,先用「表格統計 / 樞紐」整理,再把結果貼進來。</li>
      </ul>
    </LegalNote>
  </div>
</template>
