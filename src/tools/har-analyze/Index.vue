<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  parseHar,
  summarize,
  formatBytes,
  formatMs,
  type HarParseResult,
} from '@/features/har'

/*
  HAR 分析器 —— 把瀏覽器 DevTools Network 匯出的 .har 檔彙整成可讀統計:
  總請求/總大小/總時間、依狀態碼、依類型、依網域、最慢/最大、錯誤清單。
  ⚠️ HAR 含 cookie / Authorization 等敏感資料,故全程在你的瀏覽器解析,不上傳。
*/

const result = ref<HarParseResult | null>(null)
const fileName = ref('')
const error = ref('')
const dragging = ref(false)

const summary = computed(() => {
  if (!result.value?.ok) return null
  return summarize(result.value.entries, 10)
})

const typeLabels: Record<string, string> = {
  document: '文件',
  stylesheet: '樣式',
  script: '腳本',
  image: '圖片',
  font: '字型',
  media: '影音',
  xhr: 'XHR/API',
  other: '其他',
}

function tLabel(t: string) {
  return typeLabels[t] || t
}

function loadText(text: string, name: string) {
  error.value = ''
  fileName.value = name
  const r = parseHar(text)
  if (!r.ok) {
    error.value = r.error || '解析失敗'
    result.value = null
    return
  }
  result.value = r
}

function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) readFile(f)
}

function readFile(f: File) {
  const reader = new FileReader()
  reader.onload = () => loadText(String(reader.result || ''), f.name)
  reader.onerror = () => {
    error.value = '讀取檔案失敗。'
  }
  reader.readAsText(f)
}

function onDrop(e: DragEvent) {
  dragging.value = false
  const f = e.dataTransfer?.files?.[0]
  if (f) readFile(f)
}

function pctOf(part: number, whole: number) {
  if (!whole) return 0
  return Math.round((part / whole) * 100)
}

function reset() {
  result.value = null
  fileName.value = ''
  error.value = ''
}
</script>

<template>
  <div class="space-y-6">
    <!-- 上傳區 -->
    <div
      class="card p-6 border-2 border-dashed text-center transition-colors"
      :class="dragging ? 'border-brand-400 bg-brand-50' : 'border-ink-200'"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
      <p class="text-ink-600 mb-3">把 <code>.har</code> 檔拖進來,或</p>
      <label class="inline-block cursor-pointer rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
        選擇 HAR 檔
        <input type="file" accept=".har,application/json,.json" class="hidden" @change="onFile" />
      </label>
      <p class="mt-3 text-xs text-ink-400">
        DevTools → Network → 右鍵「Save all as HAR」匯出。檔案不上傳,只在你瀏覽器解析。
      </p>
    </div>

    <p v-if="error" class="card p-4 text-sm text-rose-700 bg-rose-50 border border-rose-200">⚠️ {{ error }}</p>

    <template v-if="summary && result">
      <!-- 標頭資訊 -->
      <div class="card p-5 flex flex-wrap items-center justify-between gap-3">
        <div class="text-sm text-ink-600">
          <span class="font-semibold text-ink-800 break-all">{{ fileName }}</span>
          <span v-if="result.pageTitle"> · {{ result.pageTitle }}</span>
          <span v-if="result.creator" class="text-ink-400"> · 由 {{ result.creator }} 匯出</span>
        </div>
        <button type="button" class="text-sm text-brand-600 hover:underline" @click="reset">清除</button>
      </div>

      <!-- 總覽卡 -->
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div class="card p-4">
          <div class="text-xs text-ink-400">總請求數</div>
          <div class="text-2xl font-bold text-ink-800">{{ summary.count }}</div>
        </div>
        <div class="card p-4">
          <div class="text-xs text-ink-400">總傳輸大小</div>
          <div class="text-2xl font-bold text-ink-800">{{ formatBytes(summary.totalSize) }}</div>
          <div class="text-xs text-ink-400">解壓後 {{ formatBytes(summary.totalContentSize) }}</div>
        </div>
        <div class="card p-4">
          <div class="text-xs text-ink-400">總載入時間</div>
          <div class="text-2xl font-bold text-ink-800">{{ formatMs(summary.totalTime) }}</div>
          <div class="text-xs text-ink-400">牆鐘時間</div>
        </div>
        <div class="card p-4">
          <div class="text-xs text-ink-400">錯誤請求(4xx/5xx)</div>
          <div class="text-2xl font-bold" :class="summary.errors.length ? 'text-rose-600' : 'text-emerald-600'">
            {{ summary.errors.length }}
          </div>
        </div>
      </div>

      <!-- 依狀態碼 -->
      <div class="card p-5 space-y-2">
        <h3 class="text-sm font-semibold text-ink-700">依狀態碼</h3>
        <div class="space-y-1.5">
          <div v-for="row in summary.byStatus" :key="row.group" class="flex items-center gap-3 text-sm">
            <span class="w-32 shrink-0 text-ink-600">{{ row.group }}</span>
            <div class="flex-1 h-4 rounded bg-ink-100 overflow-hidden">
              <div class="h-full bg-brand-400" :style="{ width: pctOf(row.count, summary.count) + '%' }" />
            </div>
            <span class="w-10 text-right tabular-nums text-ink-700">{{ row.count }}</span>
          </div>
        </div>
      </div>

      <!-- 依類型 -->
      <div class="card p-5 space-y-2">
        <h3 class="text-sm font-semibold text-ink-700">依資源類型</h3>
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-ink-400">
              <th class="py-1.5 font-medium">類型</th>
              <th class="py-1.5 font-medium text-right">數量</th>
              <th class="py-1.5 font-medium text-right">大小</th>
              <th class="py-1.5 font-medium text-right">佔比</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in summary.byType" :key="row.type" class="border-b border-ink-100 last:border-0">
              <td class="py-1.5 text-ink-700">{{ tLabel(row.type) }}</td>
              <td class="py-1.5 text-right tabular-nums text-ink-700">{{ row.count }}</td>
              <td class="py-1.5 text-right tabular-nums text-ink-700">{{ formatBytes(row.size) }}</td>
              <td class="py-1.5 text-right tabular-nums text-ink-400">{{ pctOf(row.size, summary.totalSize) }}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 最慢請求 -->
      <div class="card p-5 space-y-2">
        <h3 class="text-sm font-semibold text-ink-700">最慢的請求</h3>
        <ul class="space-y-1.5 text-sm">
          <li v-for="(e, i) in summary.slowest" :key="i" class="flex items-center gap-2">
            <span class="shrink-0 font-mono text-rose-600 tabular-nums w-20 text-right">{{ formatMs(e.time) }}</span>
            <span class="shrink-0 rounded bg-ink-100 px-1.5 text-xs text-ink-500">{{ e.method }}</span>
            <span class="truncate text-ink-700" :title="e.url">{{ e.url }}</span>
          </li>
        </ul>
      </div>

      <!-- 最大請求 -->
      <div class="card p-5 space-y-2">
        <h3 class="text-sm font-semibold text-ink-700">最大的請求</h3>
        <ul class="space-y-1.5 text-sm">
          <li v-for="(e, i) in summary.largest" :key="i" class="flex items-center gap-2">
            <span class="shrink-0 font-mono text-brand-600 tabular-nums w-20 text-right">{{ formatBytes(e.size) }}</span>
            <span class="shrink-0 rounded bg-ink-100 px-1.5 text-xs text-ink-500">{{ tLabel(e.type) }}</span>
            <span class="truncate text-ink-700" :title="e.url">{{ e.url }}</span>
          </li>
        </ul>
      </div>

      <!-- 依網域 -->
      <div class="card p-5 space-y-2">
        <h3 class="text-sm font-semibold text-ink-700">依網域(前 12)</h3>
        <table class="w-full text-sm">
          <tbody>
            <tr v-for="(row, i) in summary.byHost.slice(0, 12)" :key="i" class="border-b border-ink-100 last:border-0">
              <td class="py-1.5 font-mono text-ink-700 break-all">{{ row.host }}</td>
              <td class="py-1.5 text-right tabular-nums text-ink-500 w-16">{{ row.count }} 筆</td>
              <td class="py-1.5 text-right tabular-nums text-ink-500 w-24">{{ formatBytes(row.size) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 錯誤清單 -->
      <div v-if="summary.errors.length" class="card p-5 space-y-2">
        <h3 class="text-sm font-semibold text-rose-700">錯誤請求</h3>
        <ul class="space-y-1.5 text-sm">
          <li v-for="(e, i) in summary.errors" :key="i" class="flex items-center gap-2">
            <span class="shrink-0 font-mono font-semibold text-rose-600 tabular-nums w-12">{{ e.status || '—' }}</span>
            <span class="shrink-0 rounded bg-ink-100 px-1.5 text-xs text-ink-500">{{ e.method }}</span>
            <span class="truncate text-ink-700" :title="e.url">{{ e.url }}</span>
          </li>
        </ul>
      </div>
    </template>

    <LegalNote>
      HAR(HTTP Archive)是瀏覽器開發者工具「Network / 網路」面板可匯出的 JSON 檔,
      記錄一次頁面載入的所有網路請求與時序。本工具把它彙整成統計,方便找出最慢、最大、
      失敗的請求,做效能除錯。
      <strong>注意:HAR 檔常包含 cookie、Authorization 標頭等敏感資料</strong> —— 本工具
      全程在你的瀏覽器解析,不連網、不上傳,但若要分享 HAR 給他人,請先確認內容無敏感資訊。
    </LegalNote>
  </div>
</template>
