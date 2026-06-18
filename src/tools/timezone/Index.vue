<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'

/*
  時區換算 / 世界時鐘 —— 用瀏覽器內建 Intl 時區資料,純前端。
  跟國外的人約時間、看現在各地幾點最方便。
*/
const ZONES = [
  { tz: 'Asia/Taipei', label: '台北' },
  { tz: 'Asia/Tokyo', label: '東京 / 首爾' },
  { tz: 'Asia/Shanghai', label: '北京 / 香港' },
  { tz: 'Asia/Singapore', label: '新加坡' },
  { tz: 'Asia/Bangkok', label: '曼谷 / 越南' },
  { tz: 'Europe/London', label: '倫敦' },
  { tz: 'Europe/Paris', label: '巴黎 / 柏林' },
  { tz: 'America/New_York', label: '紐約' },
  { tz: 'America/Los_Angeles', label: '洛杉磯 / 西雅圖' },
  { tz: 'Australia/Sydney', label: '雪梨' },
]

// 預設用「現在」;也可輸入特定時間,從某個時區換算到各地
const useNow = ref(true)
const baseTz = ref('Asia/Taipei')
const dt = ref(new Date().toISOString().slice(0, 16))
const tick = ref(0)
setInterval(() => (tick.value++), 1000)

// 取得「在某時區、某個牆上時間」對應的 UTC 時間
function zonedToUtc(localStr: string, tz: string): Date {
  // localStr 視為 tz 當地時間;用 Intl 反推 offset
  const asUtc = new Date(localStr + ':00Z')
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const parts = fmt.formatToParts(asUtc)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const asTz = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  const offset = asTz - asUtc.getTime()
  return new Date(asUtc.getTime() - offset)
}

const refUtc = computed(() => {
  void tick.value
  if (useNow.value) return new Date()
  return zonedToUtc(dt.value, baseTz.value)
})

function fmtIn(tz: string) {
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: tz, weekday: 'short', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(refUtc.value)
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <label class="flex items-center gap-2 text-ink-700">
        <input v-model="useNow" type="checkbox" class="h-5 w-5 accent-brand-600" />
        顯示「現在」各地時間(即時)
      </label>
      <div v-if="!useNow" class="grid gap-3 sm:grid-cols-2">
        <div>
          <label class="field-label">指定時間</label>
          <input v-model="dt" type="datetime-local" class="field-input" />
        </div>
        <div>
          <label class="field-label">這個時間位於</label>
          <select v-model="baseTz" class="field-input">
            <option v-for="z in ZONES" :key="z.tz" :value="z.tz">{{ z.label }}</option>
          </select>
        </div>
      </div>
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <div v-for="z in ZONES" :key="z.tz" class="card flex items-center justify-between p-4">
        <span class="font-medium text-ink-700">{{ z.label }}</span>
        <span class="font-mono text-lg text-ink-900">{{ fmtIn(z.tz) }}</span>
      </div>
    </div>

    <LegalNote title="說明">
      <ul class="list-disc pl-5 space-y-1">
        <li>用瀏覽器內建時區資料,<strong>自動處理日光節約時間</strong>,跟國外的人約時間不會算錯。</li>
        <li>取消勾選即可輸入特定時間,從某地換算到各地。</li>
      </ul>
    </LegalNote>
  </div>
</template>
