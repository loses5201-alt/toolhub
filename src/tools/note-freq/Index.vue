<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  noteToMidi,
  midiToNote,
  midiToFreq,
  nearestNote,
  noteTable,
  DEFAULT_A4,
} from '@/features/noteFreq'

/*
  音名 / 頻率 / MIDI 換算 —— 十二平均律,標準音 A4 可調(預設 440Hz)。
  音名 → 頻率、頻率 → 最接近的音 + 偏差音分(調音器),並可列出整段音域對照表。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

const a4 = ref(DEFAULT_A4)

// 音名 → 頻率 / MIDI
const noteInput = ref('A4')
const noteResult = computed(() => {
  const midi = noteToMidi(noteInput.value)
  if (midi === null) return null
  return { midi, freq: midiToFreq(midi, a4.value), sharp: midiToNote(midi, false), flat: midiToNote(midi, true) }
})

// 頻率 → 音(調音器)
const freqInput = ref(440)
const tuner = computed(() => nearestNote(freqInput.value, a4.value))

function playFreq(freq: number) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 1.25)
    osc.onended = () => ctx.close()
  } catch {
    /* 忽略不支援 Web Audio 的環境 */
  }
}

// 對照表音域
const useFlats = ref(false)
const rangeFrom = ref('C2')
const rangeTo = ref('C6')
const table = computed(() => {
  const lo = noteToMidi(rangeFrom.value)
  const hi = noteToMidi(rangeTo.value)
  if (lo === null || hi === null) return []
  return noteTable(lo, hi, a4.value, useFlats.value)
})
</script>

<template>
  <div class="space-y-6">
    <!-- 標準音設定 -->
    <div class="card p-5 flex flex-wrap items-center gap-3">
      <label class="field-label mb-0" for="a4">標準音 A4</label>
      <input id="a4" v-model.number="a4" type="number" min="400" max="480" step="1" class="field-input w-28 font-mono" />
      <span class="text-sm text-ink-500">Hz(常見 440;古樂 415、現代樂團有時 442/443)</span>
    </div>

    <!-- 音名 → 頻率 -->
    <div class="card p-6 space-y-4">
      <h2 class="text-lg font-semibold text-ink-900">音名 → 頻率 / MIDI</h2>
      <div class="flex items-center gap-3">
        <input v-model="noteInput" type="text" class="field-input w-40 font-mono text-lg" placeholder="A4 / C#5 / Bb3" />
        <button
          v-if="noteResult"
          type="button"
          class="rounded-xl border border-line px-4 py-2 text-sm text-ink-700 transition hover:border-brand-300"
          @click="playFreq(noteResult.freq)"
        >
          ▶ 試聽
        </button>
      </div>
      <p v-if="!noteResult" class="text-sm text-red-600">看不懂這個音名,請用「字母+(升降號)+八度」,例如 A4、C#5、Bb3。</p>
      <div v-else class="grid gap-3 sm:grid-cols-3">
        <div class="rounded-xl border border-line p-4">
          <div class="text-xs text-ink-500">頻率</div>
          <div class="mt-1 text-2xl font-bold text-ink-900">{{ noteResult.freq.toFixed(2) }} Hz</div>
        </div>
        <div class="rounded-xl border border-line p-4">
          <div class="text-xs text-ink-500">MIDI 編號</div>
          <div class="mt-1 text-2xl font-bold text-ink-700">{{ noteResult.midi }}</div>
        </div>
        <div class="rounded-xl border border-line p-4">
          <div class="text-xs text-ink-500">音名(升 / 降)</div>
          <div class="mt-1 text-2xl font-bold text-ink-700">{{ noteResult.sharp }} / {{ noteResult.flat }}</div>
        </div>
      </div>
    </div>

    <!-- 頻率 → 音(調音器) -->
    <div class="card p-6 space-y-4">
      <h2 class="text-lg font-semibold text-ink-900">頻率 → 最接近的音(調音參考)</h2>
      <div class="flex items-center gap-3">
        <input v-model.number="freqInput" type="number" min="1" step="0.1" class="field-input w-40 font-mono text-lg" />
        <span class="text-sm text-ink-500">Hz</span>
      </div>
      <div v-if="tuner" class="flex flex-wrap items-center gap-4">
        <span class="text-4xl font-black text-ink-900">{{ tuner.note }}</span>
        <span
          class="text-xl font-semibold"
          :class="Math.abs(tuner.cents) <= 5 ? 'text-green-600' : tuner.cents > 0 ? 'text-amber-600' : 'text-blue-600'"
        >
          {{ tuner.cents > 0 ? '+' : '' }}{{ tuner.cents }} 音分
          <template v-if="Math.abs(tuner.cents) <= 5">(準)</template>
          <template v-else-if="tuner.cents > 0">(偏高)</template>
          <template v-else>(偏低)</template>
        </span>
        <span class="text-sm text-ink-500">標準頻率 {{ tuner.exactFreq.toFixed(2) }} Hz</span>
      </div>
      <!-- 音分偏差視覺化 -->
      <div v-if="tuner" class="relative h-3 w-full rounded-full bg-ink-100">
        <div class="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-ink-400" />
        <div
          class="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full"
          :class="Math.abs(tuner.cents) <= 5 ? 'bg-green-500' : 'bg-amber-500'"
          :style="{ left: `calc(${50 + (Math.max(-50, Math.min(50, tuner.cents)) / 50) * 50}% - 8px)` }"
        />
      </div>
      <p v-else class="text-sm text-red-600">請輸入大於 0 的頻率。</p>
    </div>

    <!-- 對照表 -->
    <div class="card p-6 space-y-4">
      <div class="flex flex-wrap items-end gap-3">
        <div>
          <label class="field-label" for="rf">從</label>
          <input id="rf" v-model="rangeFrom" type="text" class="field-input w-24 font-mono" />
        </div>
        <div>
          <label class="field-label" for="rt">到</label>
          <input id="rt" v-model="rangeTo" type="text" class="field-input w-24 font-mono" />
        </div>
        <label class="flex items-center gap-2 text-sm text-ink-700">
          <input v-model="useFlats" type="checkbox" class="h-4 w-4" />
          用降記號(b)
        </label>
      </div>
      <div v-if="table.length" class="max-h-80 overflow-auto rounded-xl border border-line">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-brand-50">
            <tr>
              <th class="px-4 py-2 text-left font-medium text-ink-700">音名</th>
              <th class="px-4 py-2 text-left font-medium text-ink-700">MIDI</th>
              <th class="px-4 py-2 text-left font-medium text-ink-700">頻率 (Hz)</th>
              <th class="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in table" :key="row.midi" class="border-t border-line">
              <td class="px-4 py-1.5 font-mono font-semibold text-ink-900">{{ row.note }}</td>
              <td class="px-4 py-1.5 font-mono text-ink-600">{{ row.midi }}</td>
              <td class="px-4 py-1.5 font-mono text-ink-700">{{ row.freq.toFixed(2) }}</td>
              <td class="px-4 py-1.5">
                <button type="button" class="text-brand-600 hover:underline" @click="playFreq(row.freq)">▶</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="text-sm text-red-600">音域範圍的音名看不懂,請用 C2、C6 這種寫法。</p>
    </div>

    <LegalNote title="關於音名 / 頻率換算">
      <ul class="list-disc pl-5 space-y-1">
        <li>採<strong>十二平均律</strong>:每個八度均分 12 個半音,相鄰半音頻率比為 2 的 12 次方根;升八度頻率正好加倍。</li>
        <li>標準音 <strong>A4 = 440 Hz</strong> 為國際慣例,本工具可調(巴洛克古樂常用 415Hz,部分樂團用 442/443Hz)。</li>
        <li>八度標記採<strong>科學音高記號(SPN)</strong>:中央 C 記為 <strong>C4</strong>(MIDI 60),A4 為 MIDI 69。</li>
        <li><strong>音分(cents)</strong>:1 個半音 = 100 音分;調音時偏差在 ±5 音分內一般聽不出來。</li>
        <li>試聽以瀏覽器 Web Audio 產生正弦波,僅供對音參考。全程在你的瀏覽器計算,<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
