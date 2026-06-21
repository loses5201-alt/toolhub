<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { analyzeGeoJson, formatLength, formatArea, type GeoJsonSummary } from '@/features/geojson'

/*
  GeoJSON 檢視 / 分析 —— 開啟 QGIS / Leaflet / 政府開放資料的 .geojson,一眼看到幾何型別分布、
  feature 數、座標點數、邊界框、線總長與面積,並逐 feature 列出型別 / 點數 / 長度 / 面積 / 屬性。
  全程在你瀏覽器解析,不上傳、不連網。
*/
const text = ref('')
const fileName = ref('')
const sort = ref<'index' | 'positions' | 'length' | 'area'>('index')

function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  fileName.value = f.name
  const reader = new FileReader()
  reader.onload = () => { text.value = String(reader.result || '') }
  reader.readAsText(f)
}

const result = computed<GeoJsonSummary | null>(() => (text.value.trim() ? analyzeGeoJson(text.value) : null))

const geomBars = computed(() => {
  const r = result.value
  if (!r) return []
  const entries = Object.entries(r.geometryCounts).sort((a, b) => b[1] - a[1])
  const max = Math.max(1, ...entries.map((e) => e[1]))
  return entries.map(([type, count]) => ({ type, count, pct: (count / max) * 100 }))
})

const sortedFeatures = computed(() => {
  const r = result.value
  if (!r) return []
  const list = r.features.slice()
  if (sort.value === 'positions') list.sort((a, b) => b.positions - a.positions)
  else if (sort.value === 'length') list.sort((a, b) => b.lengthM - a.lengthM)
  else if (sort.value === 'area') list.sort((a, b) => b.areaM2 - a.areaM2)
  return list
})

function fmtCoord(b: [number, number, number, number]): string {
  const f = (n: number) => n.toFixed(5).replace(/\.?0+$/, '')
  return `經度 ${f(b[0])} ~ ${f(b[2])}, 緯度 ${f(b[1])} ~ ${f(b[3])}`
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-3">
      <label class="field-label">開啟 GeoJSON 檔(.geojson / .json)</label>
      <input type="file" accept=".geojson,.json,application/geo+json,application/json" class="block w-full text-sm" @change="onFile" />
      <p class="field-hint">
        QGIS / Leaflet / Mapbox / OpenStreetMap 匯出、政府開放資料圖層多為 GeoJSON。
        全程在你瀏覽器解析,座標<strong>不上傳</strong>、不連網。
      </p>
      <details class="text-xs text-ink-500">
        <summary class="cursor-pointer select-none">或直接貼上 GeoJSON 內容</summary>
        <textarea v-model="text" rows="5" class="field-input mt-2 font-mono text-xs" placeholder='{"type":"FeatureCollection","features":[…]}'></textarea>
      </details>
    </div>

    <div v-if="result" class="space-y-4">
      <div v-if="result.errors.length" class="card border-amber-200 bg-amber-50 p-4">
        <p class="text-sm font-semibold text-amber-800">無法完整解析:</p>
        <ul class="mt-1 list-disc pl-5 text-sm text-amber-700">
          <li v-for="(e, i) in result.errors" :key="i">{{ e }}</li>
        </ul>
      </div>

      <template v-if="result.featureCount">
        <!-- 總覽 -->
        <div class="card p-5">
          <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p class="text-xs text-ink-400">類型</p>
              <p class="text-base font-semibold text-ink-900 break-all">{{ result.rootType }}</p>
            </div>
            <div>
              <p class="text-xs text-ink-400">Feature 數</p>
              <p class="text-base font-semibold text-ink-900">{{ result.featureCount.toLocaleString() }}</p>
            </div>
            <div>
              <p class="text-xs text-ink-400">座標點數</p>
              <p class="text-base font-semibold text-ink-900">{{ result.totalPositions.toLocaleString() }}</p>
            </div>
            <div>
              <p class="text-xs text-ink-400">屬性欄位</p>
              <p class="text-base font-semibold text-ink-900">{{ result.propertyKeys.length }}</p>
            </div>
            <div>
              <p class="text-xs text-ink-400">線段總長</p>
              <p class="text-base font-semibold text-ink-900">{{ formatLength(result.totalLengthM) }}</p>
            </div>
            <div>
              <p class="text-xs text-ink-400">面積合計</p>
              <p class="text-base font-semibold text-ink-900">{{ formatArea(result.totalAreaM2) }}</p>
            </div>
            <div class="col-span-2 sm:col-span-4">
              <p class="text-xs text-ink-400">邊界框(bbox)</p>
              <p class="font-mono text-sm text-ink-700 break-all">{{ result.bbox ? fmtCoord(result.bbox) : '—' }}</p>
            </div>
          </div>
        </div>

        <!-- 幾何型別分布 -->
        <div class="card p-5 space-y-2">
          <p class="field-label">幾何型別分布</p>
          <div v-for="b in geomBars" :key="b.type" class="space-y-0.5">
            <div class="flex justify-between text-sm">
              <span class="text-ink-700">{{ b.type }}</span>
              <span class="font-semibold text-ink-900">{{ b.count.toLocaleString() }}</span>
            </div>
            <div class="h-2 rounded bg-ink-100">
              <div class="h-2 rounded bg-brand-500" :style="{ width: b.pct + '%' }"></div>
            </div>
          </div>
        </div>

        <!-- 屬性欄位 -->
        <div v-if="result.propertyKeys.length" class="card p-5 space-y-2">
          <p class="field-label">屬性欄位({{ result.propertyKeys.length }})</p>
          <div class="flex flex-wrap gap-1.5">
            <span v-for="k in result.propertyKeys" :key="k" class="rounded bg-ink-100 px-2 py-0.5 font-mono text-xs text-ink-600">{{ k }}</span>
          </div>
        </div>

        <!-- 逐 feature -->
        <div class="card p-5 space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="field-label mb-0">各 Feature</p>
            <select v-model="sort" class="field-input w-auto text-sm">
              <option value="index">依原始順序</option>
              <option value="positions">依點數多→少</option>
              <option value="length">依長度長→短</option>
              <option value="area">依面積大→小</option>
            </select>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead>
                <tr class="border-b border-ink-100 text-xs text-ink-400">
                  <th class="py-1.5 pr-3">#</th>
                  <th class="py-1.5 pr-3">幾何型別</th>
                  <th class="py-1.5 pr-3 text-right">點數</th>
                  <th class="py-1.5 pr-3 text-right">長度</th>
                  <th class="py-1.5 pr-3 text-right">面積</th>
                  <th class="py-1.5">屬性</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="f in sortedFeatures.slice(0, 500)" :key="f.index" class="border-b border-ink-50">
                  <td class="py-1.5 pr-3 text-ink-400">{{ f.id ?? f.index }}</td>
                  <td class="py-1.5 pr-3 text-ink-800">{{ f.geometryType ?? '(null)' }}</td>
                  <td class="py-1.5 pr-3 text-right tabular-nums">{{ f.positions.toLocaleString() }}</td>
                  <td class="py-1.5 pr-3 text-right tabular-nums text-ink-600">{{ f.lengthM ? formatLength(f.lengthM) : '—' }}</td>
                  <td class="py-1.5 pr-3 text-right tabular-nums text-ink-600">{{ f.areaM2 ? formatArea(f.areaM2) : '—' }}</td>
                  <td class="py-1.5 text-xs text-ink-400 break-all">{{ f.propertyKeys.join(', ') || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="sortedFeatures.length > 500" class="text-xs text-ink-400">僅顯示前 500 個 feature(共 {{ sortedFeatures.length.toLocaleString() }} 個)。</p>
        </div>
      </template>
    </div>

    <LegalNote>
      本工具僅在你的瀏覽器內解析 GeoJSON,不會上傳檔案、不連網。長度與面積採球面近似(WGS84 平均半徑),
      適合概覽參考,非測量等級精度;面積會自動扣除多邊形的洞。座標順序依 RFC 7946 為「經度, 緯度」。
    </LegalNote>
  </div>
</template>
