<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { wktToGeoJson, geoJsonTextToWkt } from '@/features/wkt'

/*
  WKT ⇆ GeoJSON 轉換 —— 把空間資料庫(PostGIS / MySQL…)的 WKT 幾何轉成地圖能吃的 GeoJSON,
  或反過來。支援各種幾何型別、EMPTY、Z/M 維度。全程在你瀏覽器處理,不上傳。
*/
const dir = ref<'wkt2geo' | 'geo2wkt'>('wkt2geo')
const input = ref('')
const copied = ref(false)

const placeholder = computed(() =>
  dir.value === 'wkt2geo'
    ? 'POINT (121.5 25.0)\n或 POLYGON ((...))、MULTIPOLYGON (...) …'
    : '{"type":"Point","coordinates":[121.5,25]}\n或貼上 Feature / FeatureCollection',
)

const result = computed(() => {
  const s = input.value.trim()
  if (!s) return { ok: true, text: '' }
  try {
    if (dir.value === 'wkt2geo') {
      // 容許多行,每行一筆 WKT;單筆直接輸出物件,多筆輸出 FeatureCollection
      const lines = s.split('\n').map((l) => l.trim()).filter(Boolean)
      if (lines.length === 1) {
        return { ok: true, text: JSON.stringify(wktToGeoJson(lines[0]), null, 2) }
      }
      const features = lines.map((l) => ({ type: 'Feature', properties: {}, geometry: wktToGeoJson(l) }))
      return { ok: true, text: JSON.stringify({ type: 'FeatureCollection', features }, null, 2) }
    }
    return { ok: true, text: geoJsonTextToWkt(s) }
  } catch (e) {
    return { ok: false, text: (e as Error).message }
  }
})

async function copy() {
  if (!result.value.ok || !result.value.text) return
  try { await navigator.clipboard.writeText(result.value.text); copied.value = true; setTimeout(() => (copied.value = false), 1500) } catch { /* ignore */ }
}
function swap() {
  dir.value = dir.value === 'wkt2geo' ? 'geo2wkt' : 'wkt2geo'
  // 把上次的輸出帶到輸入,方便來回驗證
  if (result.value.ok && result.value.text) input.value = result.value.text
}
const examples = {
  wkt2geo: 'POLYGON ((121.5 25.0, 121.6 25.0, 121.6 25.1, 121.5 25.1, 121.5 25.0))',
  geo2wkt: '{"type":"LineString","coordinates":[[121.5,25.0],[121.6,25.1]]}',
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-5 space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <div class="flex rounded-lg bg-ink-100 p-1 text-sm">
          <button type="button" class="rounded-md px-3 py-1" :class="dir === 'wkt2geo' ? 'bg-white shadow-sm font-semibold text-ink-900' : 'text-ink-500'" @click="dir = 'wkt2geo'">WKT → GeoJSON</button>
          <button type="button" class="rounded-md px-3 py-1" :class="dir === 'geo2wkt' ? 'bg-white shadow-sm font-semibold text-ink-900' : 'text-ink-500'" @click="dir = 'geo2wkt'">GeoJSON → WKT</button>
        </div>
        <button type="button" class="rounded-lg bg-ink-100 px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-200" @click="swap">⇅ 對調並帶入結果</button>
        <button type="button" class="rounded-lg bg-ink-100 px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-200" @click="input = examples[dir]">載入範例</button>
      </div>
      <p class="field-hint">
        {{ dir === 'wkt2geo' ? 'WKT 可一行一筆,多筆會輸出成 FeatureCollection。' : 'GeoJSON 可貼幾何、Feature 或 FeatureCollection;多個幾何輸出多行 WKT。' }}
        全程在你瀏覽器處理,<strong>不上傳</strong>、不連網。
      </p>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <div class="card p-5 space-y-2">
        <label class="field-label">{{ dir === 'wkt2geo' ? '輸入 WKT' : '輸入 GeoJSON' }}</label>
        <textarea v-model="input" rows="14" class="field-input font-mono text-xs" :placeholder="placeholder"></textarea>
      </div>
      <div class="card p-5 space-y-2">
        <div class="flex items-center justify-between">
          <label class="field-label mb-0">{{ dir === 'wkt2geo' ? '輸出 GeoJSON' : '輸出 WKT' }}</label>
          <button type="button" class="rounded-lg bg-ink-100 px-3 py-1 text-sm text-ink-700 hover:bg-ink-200 disabled:opacity-40" :disabled="!result.ok || !result.text" @click="copy">{{ copied ? '已複製!' : '複製' }}</button>
        </div>
        <p v-if="!result.ok" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">⚠️ {{ result.text }}</p>
        <textarea v-else :value="result.text" readonly rows="14" class="field-input font-mono text-xs" placeholder="結果會顯示在這裡…"></textarea>
      </div>
    </div>

    <LegalNote>
      本工具僅在你的瀏覽器內轉換,不會上傳資料、不連網。支援 POINT / LINESTRING / POLYGON / MULTI* /
      GEOMETRYCOLLECTION 與 EMPTY、Z/M 維度(高程保留為第三軸);容忍 EWKT 的 <code>SRID=…;</code> 前綴。
      座標順序依 GeoJSON 規範為「經度, 緯度」,與多數資料庫 WKT 的 X Y 一致。
    </LegalNote>
  </div>
</template>
