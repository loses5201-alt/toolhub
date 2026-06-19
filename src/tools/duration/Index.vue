<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  parseDuration,
  breakdown,
  formatHuman,
  formatClock,
  formatIso,
} from '@/features/duration'

/*
  時間長度轉換 —— 在人話、時鐘(HH:MM:SS)、ISO 8601(PT1H30M)、總秒/分/時之間互轉。
  全程在你瀏覽器計算,不連網、不上傳。
*/

const input = ref('1h30m')

const parsed = computed(() => parseDuration(input.value))

const out = computed(() => {
  if (!parsed.value.ok) return null
  const total = parsed.value.seconds!
  const b = breakdown(total)
  return {
    human: formatHuman(total),
    clock: formatClock(total),
    iso: formatIso(total),
    totalSeconds: round(total),
    totalMinutes: round(total / 60),
    totalHours: round(total / 3600),
    breakdown: b,
  }
})

function round(n: number): number {
  return Math.round(n * 1000) / 1000
}

const rows = computed(() => {
  if (!out.value) return []
  return [
    { k: '人話', v: out.value.human },
    { k: '時鐘 HH:MM:SS', v: out.value.clock },
    { k: 'ISO 8601 期間', v: out.value.iso },
    { k: '總秒數', v: String(out.value.totalSeconds) },
    { k: '總分鐘', v: String(out.value.totalMinutes) },
    { k: '總小時', v: String(out.value.totalHours) },
  ]
})

const examples = ['1h30m', '90:00', 'PT2H15M', '1天12小時', '3600', '00:45:30']

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* 忽略 */
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">輸入時間長度</label>
        <input
          v-model="input"
          class="field-input font-mono text-lg"
          placeholder="例如 1h30m、01:30:00、PT1H30M、90分鐘"
          spellcheck="false"
          autocomplete="off"
        />
        <p class="field-hint">
          支援多種寫法:<strong>純數字(秒)</strong>、<strong>1h30m / 1天2小時</strong>、
          <strong>時鐘 mm:ss 或 hh:mm:ss</strong>、<strong>ISO 8601(PT1H30M)</strong>。
        </p>
        <div class="mt-2 flex flex-wrap gap-2">
          <button
            v-for="ex in examples"
            :key="ex"
            type="button"
            class="rounded-lg border border-ink-200 px-2.5 py-1 font-mono text-xs text-ink-600 transition hover:bg-ink-50"
            @click="input = ex"
          >
            {{ ex }}
          </button>
        </div>
      </div>

      <div
        v-if="input.trim() !== '' && !parsed.ok"
        class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800"
      >
        ⚠️ {{ parsed.error }}
      </div>

      <template v-else-if="out">
        <div class="grid gap-2 sm:grid-cols-2">
          <button
            v-for="row in rows"
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
        <li>把影片時長、通話時間、工時、料理計時等<strong>各種時間長度寫法互相轉換</strong>。</li>
        <li>看懂程式/設定檔裡的 <code>ISO 8601</code> 期間(<code>PT1H30M</code>)到底多久。</li>
        <li>把 <code>90:00</code> 這種時鐘格式換算成<strong>總分鐘、總秒數</strong>方便填表。</li>
        <li>中英文單位、混寫(<code>1天2小時30分</code>、<code>1d2h</code>)都看得懂。</li>
        <li>本工具<strong>不連網、不上傳</strong>,全部在你的裝置上計算。</li>
      </ul>
    </LegalNote>
  </div>
</template>
