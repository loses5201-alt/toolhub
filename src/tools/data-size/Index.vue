<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  toBytes,
  breakdown,
  humanize,
  transferSeconds,
  humanDuration,
  round,
} from '@/features/dataSize'

/*
  資料大小與傳輸時間換算 —— KB/MB/GB(1000)對照 KiB/MiB/GiB(1024)、bit/byte、估下載時間。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

const INPUT_UNITS = ['B', 'kB', 'MB', 'GB', 'TB', 'KiB', 'MiB', 'GiB', 'TiB', 'bit']
const value = ref<number | null>(1)
const unit = ref('GB')

const bytes = computed(() => {
  const v = Number(value.value)
  if (!isFinite(v) || v < 0) return NaN
  return toBytes(v, unit.value)
})
const valid = computed(() => isFinite(bytes.value) && !isNaN(bytes.value))
const bd = computed(() => (valid.value ? breakdown(bytes.value) : null))

const fmt = (n: number) => {
  if (n === 0) return '0'
  if (n >= 0.001 && n < 1e15) return String(round(n, n < 1 ? 4 : 3))
  return n.toExponential(3)
}

// 傳輸時間
const SPEED_UNITS = ['Mbps', 'Gbps', 'Kbps', 'MBps', 'GBps'] as const
const speed = ref<number | null>(100)
const speedUnit = ref<(typeof SPEED_UNITS)[number]>('Mbps')
const transfer = computed(() => {
  if (!valid.value) return null
  const s = transferSeconds(bytes.value, Number(speed.value), speedUnit.value)
  if (isNaN(s)) return null
  return humanDuration(s)
})

const SPEED_PRESETS = [
  { label: '光世代 100M', v: 100, u: 'Mbps' as const },
  { label: '光世代 300M', v: 300, u: 'Mbps' as const },
  { label: '1G 上網', v: 1, u: 'Gbps' as const },
  { label: '4G LTE 約 50M', v: 50, u: 'Mbps' as const },
]
</script>

<template>
  <div class="space-y-6">
    <div class="card p-5 space-y-3">
      <label class="block text-sm">
        <span class="text-ink-500">輸入大小</span>
        <div class="mt-1 flex gap-2">
          <input v-model.number="value" type="number" min="0" step="any" class="ds-input flex-1" />
          <select v-model="unit" class="ds-input w-28">
            <option v-for="u in INPUT_UNITS" :key="u" :value="u">{{ u }}</option>
          </select>
        </div>
      </label>
      <p v-if="!valid" class="text-sm text-rose-600">請輸入有效的非負數值</p>
    </div>

    <template v-if="bd">
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="card p-5 space-y-2">
          <h2 class="text-sm font-semibold text-ink-700">十進位(1000)— 硬碟/網路標示</h2>
          <table class="w-full text-sm">
            <tbody>
              <tr v-for="u in bd.si" :key="u.unit" class="border-b border-ink-100 last:border-0">
                <td class="py-1 text-ink-500 w-12">{{ u.unit }}</td>
                <td class="py-1 font-mono text-right text-ink-800">{{ fmt(u.value) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="card p-5 space-y-2">
          <h2 class="text-sm font-semibold text-ink-700">二進位(1024)— 作業系統實際顯示</h2>
          <table class="w-full text-sm">
            <tbody>
              <tr v-for="u in bd.iec" :key="u.unit" class="border-b border-ink-100 last:border-0">
                <td class="py-1 text-ink-500 w-12">{{ u.unit }}</td>
                <td class="py-1 font-mono text-right text-ink-800">{{ fmt(u.value) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card p-5 space-y-1">
        <h2 class="text-sm font-semibold text-ink-700">換算摘要</h2>
        <div class="text-sm text-ink-600">
          自動單位:<strong class="text-brand-600">{{ humanize(bd.bytes, 'si') }}</strong>(十進位)
          / <strong class="text-brand-600">{{ humanize(bd.bytes, 'iec') }}</strong>(二進位)
        </div>
        <div class="text-sm text-ink-600 font-mono">位元組:{{ fmt(bd.bytes) }} B · 位元:{{ fmt(bd.bits) }} bit</div>
      </div>

      <div class="card p-5 space-y-3">
        <h2 class="text-sm font-semibold text-ink-700">估算傳輸時間</h2>
        <div class="flex flex-wrap items-end gap-2">
          <label class="text-sm">
            <span class="text-ink-500">頻寬</span>
            <input v-model.number="speed" type="number" min="0" step="any" class="ds-input w-28" />
          </label>
          <select v-model="speedUnit" class="ds-input w-24">
            <option v-for="u in SPEED_UNITS" :key="u" :value="u">{{ u }}</option>
          </select>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="p in SPEED_PRESETS"
            :key="p.label"
            type="button"
            class="rounded-lg border border-ink-200 px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
            @click="speed = p.v; speedUnit = p.u"
          >
            {{ p.label }}
          </button>
        </div>
        <div v-if="transfer" class="rounded-xl bg-ink-50 p-4 text-lg text-ink-800">
          約需 <strong class="text-brand-600">{{ transfer }}</strong>
          <span class="text-xs text-ink-400">(理論值,未計協定額外負擔與波動)</span>
        </div>
      </div>
    </template>

    <LegalNote>
      <strong>kB / MB / GB</strong> 是十進位(1 kB = 1000 B),硬碟與網路頻寬都用這套;
      <strong>KiB / MiB / GiB</strong> 是二進位(1 KiB = 1024 B),Windows/檔案總管實際用這套顯示——
      所以「1 TB 硬碟」在系統裡只剩約 <strong>931 GiB</strong>。
      網路頻寬以<strong>位元(bit)</strong>計:100 Mbps ÷ 8 ≈ 每秒 12.5 MB,所以傳輸時間 = 檔案大小 × 8 ÷ 頻寬(bps)。
      估算為理論值,實際會因協定額外負擔、線路波動而變慢。純數學計算,<strong>不上傳任何資料</strong>。
    </LegalNote>
  </div>
</template>

<style scoped>
.ds-input {
  border: 1px solid var(--color-ink-200, #e2e8f0);
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
  font-size: 0.95rem;
}
</style>
