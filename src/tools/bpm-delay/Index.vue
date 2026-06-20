<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { buildTable, bpmFromTaps } from '@/features/bpm'

/*
  BPM 節拍 / 延遲時間計算 —— 由速度(BPM)算各音符的時長(ms)與頻率(Hz),
  設定 delay / reverb / LFO 同步用;附 tap tempo 打點測速。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

const bpm = ref(120)
const table = computed(() => {
  if (!(bpm.value > 0)) return []
  return buildTable(bpm.value)
})

// Tap tempo
const taps = ref<number[]>([])
const tappedBpm = ref<number | null>(null)
function tap() {
  const now = performance.now()
  // 超過 2 秒沒打就重新開始
  if (taps.value.length && now - taps.value[taps.value.length - 1] > 2000) taps.value = []
  taps.value.push(now)
  if (taps.value.length > 8) taps.value = taps.value.slice(-8)
  const b = bpmFromTaps(taps.value)
  if (b) tappedBpm.value = Math.round(b * 10) / 10
}
function applyTap() {
  if (tappedBpm.value) bpm.value = Math.round(tappedBpm.value)
}
function resetTap() {
  taps.value = []
  tappedBpm.value = null
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label" for="bpm">速度 BPM(每分鐘幾拍)</label>
        <div class="flex items-center gap-3">
          <input id="bpm" v-model.number="bpm" type="number" min="1" max="999" step="1" class="field-input w-32 font-mono text-lg" />
          <input v-model.number="bpm" type="range" min="40" max="240" step="1" class="flex-1" aria-label="BPM 滑桿" />
        </div>
      </div>

      <!-- Tap tempo -->
      <div class="flex flex-wrap items-center gap-3">
        <button
          type="button"
          class="btn-primary select-none"
          @click="tap"
        >
          👆 打點測速(Tap)
        </button>
        <span v-if="tappedBpm" class="text-lg font-bold text-ink-900">{{ tappedBpm }} BPM</span>
        <button
          v-if="tappedBpm"
          type="button"
          class="rounded-xl border border-line px-3 py-1.5 text-sm text-ink-700 transition hover:border-brand-300"
          @click="applyTap"
        >
          套用
        </button>
        <button
          v-if="taps.length"
          type="button"
          class="rounded-xl border border-line px-3 py-1.5 text-sm text-ink-500 transition hover:border-brand-300"
          @click="resetTap"
        >
          重設
        </button>
      </div>
    </div>

    <!-- 對照表 -->
    <div class="card overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-brand-50">
          <tr>
            <th class="px-4 py-3 text-left font-medium text-ink-700">音符</th>
            <th class="px-4 py-3 text-right font-medium text-ink-700">直音 (ms)</th>
            <th class="px-4 py-3 text-right font-medium text-ink-700">附點 (ms)</th>
            <th class="px-4 py-3 text-right font-medium text-ink-700">三連音 (ms)</th>
            <th class="px-4 py-3 text-right font-medium text-ink-700">頻率 (Hz)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in table" :key="row.key" class="border-t border-line">
            <td class="px-4 py-2.5 font-medium text-ink-900">{{ row.name }}</td>
            <td class="px-4 py-2.5 text-right font-mono text-ink-800">{{ row.straightMs }}</td>
            <td class="px-4 py-2.5 text-right font-mono text-ink-600">{{ row.dottedMs }}</td>
            <td class="px-4 py-2.5 text-right font-mono text-ink-600">{{ row.tripletMs }}</td>
            <td class="px-4 py-2.5 text-right font-mono text-ink-600">{{ row.straightHz }}</td>
          </tr>
          <tr v-if="!table.length">
            <td colspan="5" class="px-4 py-6 text-center text-sm text-red-600">請輸入大於 0 的 BPM。</td>
          </tr>
        </tbody>
      </table>
    </div>

    <LegalNote title="BPM 與延遲時間怎麼算?">
      <ul class="list-disc pl-5 space-y-1">
        <li>一拍(四分音符)的時長 = <strong>60000 ÷ BPM</strong> 毫秒。例如 120 BPM → 一拍 500ms,八分音符 250ms。</li>
        <li><strong>附點音符</strong>是原音符的 1.5 倍長;<strong>三連音</strong>是 2/3 倍長。設 delay 時用「附點八分」常能做出流行的回聲律動。</li>
        <li><strong>頻率(Hz)</strong>= 1000 ÷ 毫秒,用來設定與節奏同步的 LFO 速率。</li>
        <li><strong>Tap</strong>:跟著音樂規律點按鈕,工具會用相鄰間隔的平均推算 BPM(點越多越穩,停超過 2 秒會重新開始)。</li>
        <li>用途:delay 延遲、reverb 殘響預延遲、tremolo/auto-pan 等 LFO 與節奏對齊。全程在你的瀏覽器計算,<strong>不連網、不上傳</strong>。需要音名/頻率換算可搭配「音名 / 頻率 / MIDI 換算」。</li>
      </ul>
    </LegalNote>
  </div>
</template>
