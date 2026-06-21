<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parseTrackFile, analyzeAll, type ParsedTracks, type TrackStats } from '@/features/gpxAnalyze'

/*
  GPX / KML 軌跡分析 —— 開啟 Garmin / Strava / 手機 App 匯出的 .gpx 或 Google Earth 的 .kml,
  算出總距離、爬升 / 下降、海拔範圍、總時間、均速 / 最高速度,並畫出路線與海拔剖面預覽。
  軌跡(含你的所在位置)全程在你瀏覽器計算,不上傳、不連網。
*/
const raw = ref('')
const fileName = ref('')
const smoothing = ref(2) // 海拔雜訊閾值(公尺)

function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  fileName.value = f.name
  const reader = new FileReader()
  reader.onload = () => { raw.value = String(reader.result || '') }
  reader.readAsText(f)
}

const SAMPLE = `<?xml version="1.0"?>
<gpx version="1.1" creator="ToolHub">
  <trk><name>象山步道</name><trkseg>
    <trkpt lat="25.0270" lon="121.5710"><ele>20</ele><time>2026-06-21T07:00:00Z</time></trkpt>
    <trkpt lat="25.0265" lon="121.5725"><ele>60</ele><time>2026-06-21T07:08:00Z</time></trkpt>
    <trkpt lat="25.0260" lon="121.5740"><ele>140</ele><time>2026-06-21T07:20:00Z</time></trkpt>
    <trkpt lat="25.0255" lon="121.5750"><ele>183</ele><time>2026-06-21T07:30:00Z</time></trkpt>
    <trkpt lat="25.0262" lon="121.5738"><ele>120</ele><time>2026-06-21T07:45:00Z</time></trkpt>
    <trkpt lat="25.0270" lon="121.5710"><ele>20</ele><time>2026-06-21T08:00:00Z</time></trkpt>
  </trkseg></trk>
</gpx>`

const parsed = computed<ParsedTracks>(() => {
  if (!raw.value.trim()) return { format: '', tracks: [], waypoints: [] }
  return parseTrackFile(raw.value)
})
const stats = computed<TrackStats>(() => analyzeAll(parsed.value.tracks, smoothing.value))
const hasTracks = computed(() => parsed.value.tracks.some((t) => t.points.length > 1))

// 路線預覽(經緯度等距投影到 SVG;緯度方向依中央緯度做 cos 修正)
const W = 480, H = 280, PAD = 12
const routePaths = computed<string[]>(() => {
  const b = stats.value.bounds
  if (!b) return []
  const latMid = (b.minLat + b.maxLat) / 2
  const kx = Math.cos((latMid * Math.PI) / 180)
  const spanX = Math.max(1e-9, (b.maxLon - b.minLon) * kx)
  const spanY = Math.max(1e-9, b.maxLat - b.minLat)
  const scale = Math.min((W - 2 * PAD) / spanX, (H - 2 * PAD) / spanY)
  const offX = (W - spanX * scale) / 2
  const offY = (H - spanY * scale) / 2
  const px = (lon: number) => offX + (lon - b.minLon) * kx * scale
  const py = (lat: number) => H - (offY + (lat - b.minLat) * scale) // 緯度越大越上方
  return parsed.value.tracks
    .filter((t) => t.points.length > 1)
    .map((t) => t.points.map((p, i) => `${i ? 'L' : 'M'}${px(p.lon).toFixed(1)} ${py(p.lat).toFixed(1)}`).join(' '))
})

// 海拔剖面(沿累計距離 x,海拔 y)
const elePath = computed<string>(() => {
  const pts = parsed.value.tracks.flatMap((t) => t.points).filter((p) => p.ele != null)
  if (pts.length < 2 || stats.value.minEle == null || stats.value.maxEle == null) return ''
  const all = parsed.value.tracks.flatMap((t) => t.points)
  const eMin = stats.value.minEle, eMax = stats.value.maxEle
  const eSpan = Math.max(1, eMax - eMin)
  const n = all.length
  return all
    .map((p, i) => {
      const x = PAD + (i / (n - 1)) * (W - 2 * PAD)
      const e = p.ele ?? eMin
      const y = (H - 16) - ((e - eMin) / eSpan) * (H - 32)
      return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
})

function fmtDist(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} 公里` : `${m.toFixed(0)} 公尺`
}
function fmtDuration(ms?: number): string {
  if (ms == null) return '—'
  const s = Math.round(ms / 1000)
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return (h ? `${h} 時 ` : '') + `${m} 分 ${sec} 秒`
}
function fmtPace(stats: TrackStats): string {
  if (!stats.duration || stats.distance < 1) return '—'
  const secPerKm = stats.duration / 1000 / (stats.distance / 1000)
  const m = Math.floor(secPerKm / 60), s = Math.round(secPerKm % 60)
  return `${m}'${String(s).padStart(2, '0')}" / 公里`
}
function fmtSpeed(mps?: number): string {
  if (mps == null) return '—'
  return `${(mps * 3.6).toFixed(1)} km/h`
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-3">
      <label class="field-label">開啟 .gpx / .kml 軌跡檔</label>
      <input type="file" accept=".gpx,.kml,application/gpx+xml,application/vnd.google-earth.kml+xml,text/xml" class="block w-full text-sm" @change="onFile" />
      <p class="field-hint">支援 GPX 與 KML(含 gx:Track)。軌跡含你的所在位置,<strong>全程在你瀏覽器計算,不上傳、不連網</strong>。</p>
      <button type="button" class="text-sm text-brand-700 hover:underline" @click="raw = SAMPLE; fileName = 'sample.gpx'">載入範例軌跡(象山步道)</button>
    </div>

    <div v-if="parsed.error" class="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-sm text-rose-700">⚠️ {{ parsed.error }}</div>

    <div v-if="hasTracks" class="card p-5 space-y-4">
      <div class="flex flex-wrap items-center gap-2">
        <span class="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-700">{{ parsed.format.toUpperCase() }}</span>
        <span v-if="parsed.tracks[0]?.name" class="font-semibold text-ink-900">{{ parsed.tracks[0].name }}</span>
        <span class="text-xs text-ink-400">{{ parsed.tracks.length }} 條軌跡 · {{ stats.pointCount }} 個點</span>
      </div>

      <dl class="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 text-sm">
        <div><dt class="text-ink-500">總距離</dt><dd class="text-lg font-semibold text-ink-900">{{ fmtDist(stats.distance) }}</dd></div>
        <div><dt class="text-ink-500">總時間</dt><dd class="text-lg font-semibold text-ink-900">{{ fmtDuration(stats.duration) }}</dd></div>
        <div><dt class="text-ink-500">配速</dt><dd class="text-lg font-semibold text-ink-900">{{ fmtPace(stats) }}</dd></div>
        <div><dt class="text-ink-500">累計爬升</dt><dd class="font-semibold text-emerald-700">↑ {{ stats.elevationGain.toFixed(0) }} m</dd></div>
        <div><dt class="text-ink-500">累計下降</dt><dd class="font-semibold text-sky-700">↓ {{ stats.elevationLoss.toFixed(0) }} m</dd></div>
        <div v-if="stats.minEle != null"><dt class="text-ink-500">海拔範圍</dt><dd class="font-semibold text-ink-900">{{ stats.minEle.toFixed(0) }}~{{ stats.maxEle!.toFixed(0) }} m</dd></div>
        <div v-if="stats.avgSpeed != null"><dt class="text-ink-500">平均速度</dt><dd class="font-semibold text-ink-900">{{ fmtSpeed(stats.avgSpeed) }}</dd></div>
        <div v-if="stats.maxSpeed != null"><dt class="text-ink-500">最高速度</dt><dd class="font-semibold text-ink-900">{{ fmtSpeed(stats.maxSpeed) }}</dd></div>
        <div v-if="stats.startTime"><dt class="text-ink-500">開始時間</dt><dd class="font-medium text-ink-700 text-xs">{{ new Date(stats.startTime).toLocaleString() }}</dd></div>
      </dl>

      <div class="flex items-center gap-2 text-sm">
        <label class="text-ink-500">海拔雜訊過濾</label>
        <input v-model.number="smoothing" type="range" min="0" max="10" step="1" class="flex-1 max-w-xs" />
        <span class="font-mono text-xs text-ink-600">{{ smoothing }} m</span>
        <span class="text-xs text-ink-400">(忽略小於此值的海拔抖動,讓爬升估算更準)</span>
      </div>

      <!-- 路線預覽 -->
      <div v-if="routePaths.length">
        <p class="mb-1 text-sm font-medium text-ink-700">路線預覽</p>
        <svg :viewBox="`0 0 ${W} ${H}`" class="w-full rounded-lg border border-ink-100 bg-ink-50/40" role="img" aria-label="路線預覽">
          <path v-for="(d, i) in routePaths" :key="i" :d="d" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
        </svg>
        <p class="mt-1 text-[11px] text-ink-400">等距投影示意圖(非比例尺地圖),僅供辨識路線形狀。</p>
      </div>

      <!-- 海拔剖面 -->
      <div v-if="elePath">
        <p class="mb-1 text-sm font-medium text-ink-700">海拔剖面</p>
        <svg :viewBox="`0 0 ${W} ${H}`" class="w-full rounded-lg border border-ink-100 bg-ink-50/40" preserveAspectRatio="none" style="height:140px" role="img" aria-label="海拔剖面">
          <path :d="elePath" fill="none" stroke="#059669" stroke-width="2" />
        </svg>
      </div>
    </div>

    <div v-else-if="raw.trim() && !parsed.error" class="card p-5 text-sm text-ink-500">
      檔案已讀取,但找不到可分析的軌跡點(至少需要 2 個座標點)。
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>開啟 <strong>.gpx / .kml 軌跡檔</strong>(Garmin、Strava、Komoot、手機運動 App、Google Earth 匯出的都行),一眼看到<strong>總距離、爬升 / 下降、海拔範圍、總時間、配速、均速 / 最高速度</strong>。</li>
        <li>畫出<strong>路線形狀</strong>與<strong>海拔剖面</strong>預覽,幫你回顧這趟跑步 / 騎車 / 登山走了哪、爬了多少。</li>
        <li>可調「海拔雜訊過濾」,排除 GPS 海拔抖動,讓累計爬升的估算更貼近實際。</li>
        <li>軌跡是<strong>你的位置紀錄(高度敏感)</strong>;本工具<strong>全程在你瀏覽器計算,完全不上傳、不連網</strong>,線上軌跡分析網站多半要你上傳整份紀錄。</li>
        <li>需要單點座標換算或兩點距離 / 方位,請用「座標換算」「方位角計算」。</li>
      </ul>
    </LegalNote>
  </div>
</template>
