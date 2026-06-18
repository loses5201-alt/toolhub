<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  parseEpoch,
  parseDateString,
  epochInUnit,
  unitLabel,
  formatInOffset,
  toISO,
  relativeFromNow,
  type EpochUnit,
} from '@/features/timestampConvert'

/*
  Unix 時間戳記轉換器 —— 數字 epoch ↔ 人看得懂的日期,自動判斷秒/毫秒/微秒,
  同時顯示台灣時間、UTC 與相對時間。全程在你的瀏覽器計算,不連網、不上傳。
*/

// 即時時鐘
const now = ref(Date.now())
let timer: number | undefined
onMounted(() => {
  timer = window.setInterval(() => (now.value = Date.now()), 1000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})

// 使用者裝置本機時區偏移(分鐘,相對 UTC;台灣回傳 480)
const localOffset = -new Date().getTimezoneOffset()
const localTzName = Intl.DateTimeFormat().resolvedOptions().timeZone || '本機'

// 模式:由時間戳記 → 日期,或由日期 → 時間戳記
const mode = ref<'epoch' | 'date'>('epoch')
const epochInput = ref('')
const dateInput = ref('')

interface View {
  ok: boolean
  error?: string
  ms?: number
  unit?: EpochUnit
}

const view = computed<View>(() => {
  if (mode.value === 'epoch') {
    const r = parseEpoch(epochInput.value)
    return r.ok ? { ok: true, ms: r.ms, unit: r.unit } : { ok: false, error: r.error }
  }
  const r = parseDateString(dateInput.value)
  return r.ok ? { ok: true, ms: r.ms } : { ok: false, error: r.error }
})

function fmtOffset(min: number): string {
  const sign = min >= 0 ? '+' : '-'
  const a = Math.abs(min)
  const h = Math.floor(a / 60)
  const m = a % 60
  return `UTC${sign}${h}${m ? ':' + String(m).padStart(2, '0') : ''}`
}

const out = computed(() => {
  if (!view.value.ok || view.value.ms === undefined) return null
  const ms = view.value.ms
  return {
    local: formatInOffset(ms, localOffset),
    taiwan: formatInOffset(ms, 480),
    utc: formatInOffset(ms, 0),
    iso: toISO(ms),
    seconds: epochInUnit(ms, 'seconds'),
    millis: epochInUnit(ms, 'milliseconds'),
    relative: relativeFromNow(ms, now.value),
  }
})

function useNow() {
  mode.value = 'epoch'
  epochInput.value = String(Math.floor(Date.now() / 1000))
}

async function copy(text: string | number) {
  try {
    await navigator.clipboard.writeText(String(text))
  } catch {
    /* 忽略:某些瀏覽器需 HTTPS 或權限 */
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- 即時現在時間 -->
    <div class="card flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <div class="text-xs font-semibold text-ink-400">現在的 Unix 時間戳記(秒)</div>
        <div class="font-mono text-2xl text-ink-800">{{ Math.floor(now / 1000) }}</div>
      </div>
      <button
        type="button"
        class="rounded-lg border border-brand-300 bg-brand-50 px-3 py-1.5 text-sm text-brand-700 transition hover:bg-brand-100"
        @click="useNow"
      >
        帶入現在時間
      </button>
    </div>

    <div class="card p-6 space-y-4">
      <!-- 模式切換 -->
      <div class="inline-flex rounded-lg border border-ink-200 p-0.5 text-sm">
        <button
          type="button"
          class="rounded-md px-3 py-1.5 transition"
          :class="mode === 'epoch' ? 'bg-brand-600 text-white' : 'text-ink-600 hover:bg-ink-50'"
          @click="mode = 'epoch'"
        >
          時間戳記 → 日期
        </button>
        <button
          type="button"
          class="rounded-md px-3 py-1.5 transition"
          :class="mode === 'date' ? 'bg-brand-600 text-white' : 'text-ink-600 hover:bg-ink-50'"
          @click="mode = 'date'"
        >
          日期 → 時間戳記
        </button>
      </div>

      <div v-if="mode === 'epoch'">
        <label class="field-label">Unix 時間戳記</label>
        <input
          v-model="epochInput"
          class="field-input font-mono text-lg"
          placeholder="例如 1781584200"
          spellcheck="false"
          inputmode="numeric"
        />
        <p class="field-hint">
          直接貼上數字即可,系統自動判斷是<strong>秒(10 位)、毫秒(13 位)或微秒(16 位)</strong>。全程在你瀏覽器計算,不上傳。
        </p>
      </div>
      <div v-else>
        <label class="field-label">日期時間</label>
        <input
          v-model="dateInput"
          class="field-input text-lg"
          placeholder="例如 2026-06-18 12:30:00 或 2026-06-18T04:30:00Z"
          spellcheck="false"
        />
        <p class="field-hint">
          沒寫時區就當作你的本機時區(<strong>{{ localTzName }}</strong>);要指定 UTC 可在結尾加 <code>Z</code>。
        </p>
      </div>

      <div
        v-if="!view.ok"
        class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800"
      >
        ⚠️ {{ view.error }}
      </div>

      <template v-else-if="out">
        <div
          v-if="mode === 'epoch' && view.unit"
          class="rounded-xl border border-brand-200 bg-brand-50/60 p-3 text-sm text-brand-800"
        >
          判斷單位為 <strong>{{ unitLabel(view.unit) }}</strong> · {{ out.relative }}
        </div>

        <div class="grid gap-2 sm:grid-cols-2">
          <button
            v-for="row in [
              { k: '你的時區 (' + localTzName + ', ' + fmtOffset(localOffset) + ')', v: out.local },
              { k: '台灣時間 (UTC+8)', v: out.taiwan },
              { k: '世界協調時間 (UTC)', v: out.utc },
              { k: 'ISO 8601', v: out.iso },
            ]"
            :key="row.k"
            type="button"
            class="group rounded-lg bg-ink-50 px-3 py-2 text-left transition hover:bg-ink-100"
            :title="'點一下複製'"
            @click="copy(row.v)"
          >
            <div class="text-xs font-semibold text-ink-400">{{ row.k }}</div>
            <div class="break-all font-mono text-ink-800">{{ row.v }}</div>
          </button>
        </div>

        <div v-if="mode === 'date'" class="grid gap-2 sm:grid-cols-2">
          <button
            v-for="row in [
              { k: '時間戳記(秒)', v: out.seconds },
              { k: '時間戳記(毫秒)', v: out.millis },
            ]"
            :key="row.k"
            type="button"
            class="rounded-lg bg-ink-50 px-3 py-2 text-left transition hover:bg-ink-100"
            title="點一下複製"
            @click="copy(row.v)"
          >
            <div class="text-xs font-semibold text-ink-400">{{ row.k }}</div>
            <div class="break-all font-mono text-ink-800">{{ row.v }}</div>
          </button>
        </div>
        <p class="text-xs text-ink-400">點任一格可複製內容。</p>
      </template>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>看 log、資料庫、API 回傳裡那串 <code>1781584200</code> 到底是<strong>哪一天幾點</strong>。</li>
        <li>自動分辨<strong>秒 / 毫秒 / 微秒</strong>,免自己數位數、再乘除 1000。</li>
        <li>同時給出<strong>你的時區、台灣時間、UTC 與 ISO 8601</strong>,跨時區對時不算錯。</li>
        <li>Unix 時間戳記是「自 1970-01-01 00:00:00 UTC 起經過的時間」,與時區無關;顯示成日期才需要套時區。</li>
        <li>本工具<strong>不連網、不上傳</strong>,全部在你的裝置上計算。</li>
      </ul>
    </LegalNote>
  </div>
</template>
