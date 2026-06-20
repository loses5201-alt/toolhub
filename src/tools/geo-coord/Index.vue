<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parsePair, toDMS, formatDMS, formatDM, validate, haversine } from '@/features/geoCoord'

/*
  GPS 座標轉換 —— 十進位度(Google 地圖)↔ 度分秒(DMS)↔ 度分(DM)互轉,並算兩點間距離。
  全程在你的瀏覽器計算,不連網、不上傳。
*/
const inputA = ref('25.0337, 121.5645')
const inputB = ref('')

const examples: { v: string; label: string }[] = [
  { v: '25.0337, 121.5645', label: '台北 101' },
  { v: '25°02\'01.3"N 121°33\'52.2"E', label: '度分秒寫法' },
  { v: '24.9576, 121.2251', label: '石門水庫' },
  { v: '23.46, 120.96', label: '玉山' },
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

const distance = computed(() => {
  if (a.value?.ok && b.value?.ok) {
    return haversine(a.value.lat, a.value.lon, b.value.lat, b.value.lon)
  }
  return null
})

function fmtDist(m: number): string {
  if (m < 1000) return `${m.toFixed(1)} 公尺`
  if (m < 100000) return `${(m / 1000).toFixed(2)} 公里`
  return `${(m / 1000).toFixed(1)} 公里`
}

interface Card { lat: number; lon: number }
function rows(c: Card) {
  return [
    { k: '十進位度(DD)', v: `${c.lat.toFixed(6)}, ${c.lon.toFixed(6)}` },
    { k: '度分秒(DMS)', v: `${formatDMS(toDMS(c.lat, true))} ${formatDMS(toDMS(c.lon, false))}` },
    { k: '度分(DM)', v: `${formatDM(c.lat, true)} ${formatDM(c.lon, false)}` },
    { k: 'Google 地圖', v: `${c.lat.toFixed(6)},${c.lon.toFixed(6)}` },
  ]
}
function mapUrl(c: Card): string {
  return `https://www.google.com/maps?q=${c.lat.toFixed(6)},${c.lon.toFixed(6)}`
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">座標 A(緯度, 經度)</label>
        <input v-model="inputA" class="field-input font-mono" placeholder="25.0337, 121.5645" spellcheck="false" />
        <p class="field-hint">
          支援十進位(<code>25.0337, 121.5645</code>)、度分秒(<code>25°02'01.3"N 121°33'52.2"E</code>)、半球字母或負號。全程在瀏覽器計算,不上傳。
        </p>
      </div>
      <div>
        <div class="mb-1.5 text-xs font-semibold text-ink-400">常用範例</div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="ex in examples"
            :key="ex.v"
            type="button"
            class="rounded-lg border border-ink-200 px-3 py-1.5 text-sm text-ink-600 transition hover:bg-ink-50"
            @click="inputA = ex.v"
          >
            {{ ex.label }}
          </button>
        </div>
      </div>

      <div v-if="inputA.trim() && a && !a.ok" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
        ⚠️ {{ a.error }}
      </div>

      <div v-if="a && a.ok" class="rounded-xl border border-brand-200 bg-brand-50/60 p-4">
        <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <template v-for="r in rows(a)" :key="r.k">
            <dt class="font-semibold text-brand-700">{{ r.k }}</dt>
            <dd class="font-mono text-ink-800 break-all">{{ r.v }}</dd>
          </template>
        </dl>
        <a :href="mapUrl(a)" target="_blank" rel="noopener noreferrer" class="mt-3 inline-block text-sm text-brand-700 hover:underline">
          在 Google 地圖開啟 ↗
        </a>
      </div>
    </div>

    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">座標 B(選填,用來算與 A 的距離)</label>
        <input v-model="inputB" class="field-input font-mono" placeholder="35.6895, 139.6917(東京)" spellcheck="false" />
      </div>
      <div v-if="inputB.trim() && b && !b.ok" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
        ⚠️ {{ b.error }}
      </div>
      <div v-if="b && b.ok" class="rounded-xl border border-ink-200 bg-ink-50 p-4">
        <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <template v-for="r in rows(b)" :key="r.k">
            <dt class="font-semibold text-ink-500">{{ r.k }}</dt>
            <dd class="font-mono text-ink-800 break-all">{{ r.v }}</dd>
          </template>
        </dl>
      </div>
      <div v-if="distance !== null" class="rounded-xl border border-brand-200 bg-brand-50/60 p-4 text-center">
        <div class="text-xs font-semibold text-brand-700">A → B 直線(大圓)距離</div>
        <div class="mt-1 text-2xl font-bold text-ink-800">{{ fmtDist(distance) }}</div>
        <div class="mt-0.5 text-xs text-ink-400">以 haversine 公式、地球平均半徑 6371 km 計算</div>
      </div>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>從 Google 地圖複製的 <strong>十進位度</strong>,與導航機、登山地圖、相片 GPS 常見的 <strong>度分秒(DMS)</strong> 之間互轉,免再上網站慢慢查。</li>
        <li>貼上兩個座標,馬上算出兩點間的<strong>直線(大圓)距離</strong> —— 估算路程、判斷範圍時好用。</li>
        <li>緯度範圍 −90~90、經度 −180~180;南緯與西經以負號或 S/W 表示。距離為地表大圓距離,非實際道路里程。</li>
        <li>本工具<strong>不連網、不上傳</strong>;只有你主動點「在 Google 地圖開啟」時才會把座標帶到地圖網站。</li>
      </ul>
    </LegalNote>
  </div>
</template>
