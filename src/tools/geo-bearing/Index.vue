<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parsePair, validate, computeBearing, compassPoint } from '@/features/bearing'

/*
  方位角 / 羅盤方位 —— 給兩個座標,算出「從 A 該往哪個方向走才會到 B」:
  起始方位角、到達方位角、反方位角、羅盤方位名與大圓距離。
  也能單獨把一個方位角換成羅盤方位名。登山定向、天線/小耳朵對星、航海、無人機航線用得到。
  全程在你的瀏覽器計算,不連網、不上傳。與 GPS 座標轉換 / 距離互補。
*/

const inputA = ref('25.0339, 121.5645')
const inputB = ref('35.6586, 139.7454')

const examples: { a: string; b: string; label: string }[] = [
  { a: '25.0339, 121.5645', b: '35.6586, 139.7454', label: '台北101 → 東京鐵塔' },
  { a: '25.0339, 121.5645', b: '22.6273, 120.3014', label: '台北 → 高雄' },
  { a: '25.0339, 121.5645', b: '37.4220, -122.0841', label: '台北 → 矽谷' },
]

function parseOne(s: string) {
  const t = s.trim()
  if (!t) return null
  try {
    const { lat, lon } = parsePair(t)
    const err = validate(lat, lon)
    if (err) return { ok: false as const, error: err }
    return { ok: true as const, lat, lon }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : '無法解析' }
  }
}

const a = computed(() => parseOne(inputA.value))
const b = computed(() => parseOne(inputB.value))

const result = computed(() => {
  if (a.value?.ok && b.value?.ok) {
    return computeBearing(a.value.lat, a.value.lon, b.value.lat, b.value.lon)
  }
  return null
})

function fmtDist(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(m >= 100000 ? 0 : 2)} 公里` : `${m.toFixed(0)} 公尺`
}
const fmtDeg = (d: number) => d.toFixed(1)

function applyExample(ex: { a: string; b: string }) {
  inputA.value = ex.a
  inputB.value = ex.b
}

// 單獨:方位角 → 羅盤方位
const onlyBearing = ref(45)
const onlyCompass = computed(() => ({
  p4: compassPoint(onlyBearing.value, 1),
  p8: compassPoint(onlyBearing.value, 2),
  p16: compassPoint(onlyBearing.value, 3),
}))
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label" for="a">起點 A(緯度, 經度)</label>
          <input id="a" v-model="inputA" type="text" class="field-input font-mono" placeholder="25.0339, 121.5645" />
          <p v-if="a && !a.ok" class="mt-1 text-sm text-red-600">{{ a.error }}</p>
        </div>
        <div>
          <label class="field-label" for="b">終點 B(緯度, 經度)</label>
          <input id="b" v-model="inputB" type="text" class="field-input font-mono" placeholder="35.6586, 139.7454" />
          <p v-if="b && !b.ok" class="mt-1 text-sm text-red-600">{{ b.error }}</p>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="ex in examples"
          :key="ex.label"
          type="button"
          class="rounded-xl border border-line px-3 py-1.5 text-sm text-ink-700 transition hover:border-brand-300"
          @click="applyExample(ex)"
        >
          {{ ex.label }}
        </button>
      </div>
    </div>

    <div v-if="result" class="card p-6 space-y-5">
      <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span class="text-4xl font-black text-ink-900">{{ fmtDeg(result.initial) }}°</span>
        <span class="text-xl font-semibold text-brand-700">{{ result.compass.zh }}（{{ result.compass.abbr }}）</span>
      </div>
      <p class="text-ink-600">從 A 出發時要朝這個方向(羅盤角度,正北為 0°、順時針)。</p>

      <!-- 羅盤示意 -->
      <div class="mx-auto" style="width: 160px; height: 160px">
        <svg viewBox="0 0 200 200" class="h-full w-full">
          <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" class="text-line" stroke-width="2" />
          <text x="100" y="22" text-anchor="middle" class="fill-ink-500" font-size="14">N</text>
          <text x="184" y="105" text-anchor="middle" class="fill-ink-500" font-size="14">E</text>
          <text x="100" y="190" text-anchor="middle" class="fill-ink-500" font-size="14">S</text>
          <text x="16" y="105" text-anchor="middle" class="fill-ink-500" font-size="14">W</text>
          <g :transform="`rotate(${result.initial} 100 100)`">
            <line x1="100" y1="100" x2="100" y2="22" stroke="#2563eb" stroke-width="4" stroke-linecap="round" />
            <polygon points="100,12 94,28 106,28" fill="#2563eb" />
          </g>
          <circle cx="100" cy="100" r="5" fill="#2563eb" />
        </svg>
      </div>

      <div class="grid gap-3 sm:grid-cols-4">
        <div class="rounded-xl border border-line p-4">
          <div class="text-xs text-ink-500">起始方位角</div>
          <div class="mt-1 text-2xl font-bold text-ink-900">{{ fmtDeg(result.initial) }}°</div>
        </div>
        <div class="rounded-xl border border-line p-4">
          <div class="text-xs text-ink-500">到達方位角</div>
          <div class="mt-1 text-2xl font-bold text-ink-700">{{ fmtDeg(result.final) }}°</div>
        </div>
        <div class="rounded-xl border border-line p-4">
          <div class="text-xs text-ink-500">反方位角</div>
          <div class="mt-1 text-2xl font-bold text-ink-700">{{ fmtDeg(result.back) }}°</div>
        </div>
        <div class="rounded-xl border border-line p-4">
          <div class="text-xs text-ink-500">直線距離</div>
          <div class="mt-1 text-2xl font-bold text-ink-700">{{ fmtDist(result.distanceM) }}</div>
        </div>
      </div>
    </div>

    <!-- 方位角 → 羅盤方位 -->
    <div class="card p-6 space-y-4">
      <h2 class="text-lg font-semibold text-ink-900">方位角 → 羅盤方位名</h2>
      <div class="flex items-center gap-3">
        <input
          v-model.number="onlyBearing"
          type="number"
          min="0"
          max="360"
          step="1"
          class="field-input w-32 font-mono"
        />
        <span class="text-sm text-ink-500">度(0–360)</span>
      </div>
      <input v-model.number="onlyBearing" type="range" min="0" max="360" step="1" class="w-full" aria-label="方位角滑桿" />
      <div class="grid gap-3 sm:grid-cols-3">
        <div class="rounded-xl border border-line p-4">
          <div class="text-xs text-ink-500">4 方位</div>
          <div class="mt-1 text-xl font-bold text-ink-900">{{ onlyCompass.p4.zh }}（{{ onlyCompass.p4.abbr }}）</div>
        </div>
        <div class="rounded-xl border border-line p-4">
          <div class="text-xs text-ink-500">8 方位</div>
          <div class="mt-1 text-xl font-bold text-ink-900">{{ onlyCompass.p8.zh }}（{{ onlyCompass.p8.abbr }}）</div>
        </div>
        <div class="rounded-xl border border-line p-4">
          <div class="text-xs text-ink-500">16 方位</div>
          <div class="mt-1 text-xl font-bold text-ink-900">{{ onlyCompass.p16.zh }}（{{ onlyCompass.p16.abbr }}）</div>
        </div>
      </div>
    </div>

    <LegalNote title="方位角是什麼?怎麼用?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>方位角(bearing / azimuth)</strong>是「正北為 0°、順時針量到目標方向」的角度:90° 為正東、180° 正南、270° 正西。</li>
        <li><strong>起始方位角</strong>是沿最短路線(大圓)出發瞬間的方向;由於地球是球面,沿大圓前進方向會慢慢改變,所以<strong>到達方位角</strong>通常與起始不同(只有沿同一條經線南北走、或赤道上才相同)。</li>
        <li><strong>反方位角</strong>是正對面方向(+180°),也就是「從 B 回望 A 的大致方向」。</li>
        <li>距離為兩點沿地球表面的大圓距離(haversine,把地球當正球體,誤差約 0.5%)。</li>
        <li>用途:登山地圖定向、天線/衛星小耳朵對準、航海與飛行航向、無人機航點規劃。實際使用時請留意磁偏角(本工具給的是<strong>真北</strong>方位,羅盤讀的是磁北)。</li>
        <li>座標可填十進位度(25.0339, 121.5645)或度分秒;全程在你的瀏覽器計算,<strong>不連網、不上傳</strong>。需要座標格式互轉,可搭配 GPS 座標轉換工具。</li>
      </ul>
    </LegalNote>
  </div>
</template>
