<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  encodeMorse,
  decodeMorse,
  looksLikeMorse,
  morseToTones,
  type Tone,
} from '@/features/morse'

/*
  摩斯密碼轉換 —— 文字 ↔ 摩斯,依 ITU 國際標準。可調速播放嗶聲。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

type Mode = 'encode' | 'decode'
const mode = ref<Mode>('encode')
const input = ref('SOS')

// 自動偵測:貼進摩斯碼時提示可切換到解碼
const autoHint = computed(
  () => mode.value === 'encode' && looksLikeMorse(input.value) && input.value.trim().length > 2,
)

const result = computed(() => {
  if (mode.value === 'encode') {
    const r = encodeMorse(input.value)
    return { output: r.morse, unsupported: r.unsupported }
  }
  const r = decodeMorse(input.value)
  return { output: r.text, unsupported: r.unsupported }
})

const morseForPlay = computed(() =>
  mode.value === 'encode' ? result.value.output : input.value,
)

function swap() {
  // 把輸出搬到輸入並切換模式,方便來回驗證
  input.value = result.value.output
  mode.value = mode.value === 'encode' ? 'decode' : 'encode'
}

const copied = ref(false)
async function copyOut() {
  try {
    await navigator.clipboard.writeText(result.value.output)
    copied.value = true
    setTimeout(() => (copied.value = false), 1200)
  } catch {
    /* 忽略 */
  }
}

// ── 嗶聲播放(Web Audio,純前端)──
const wpm = ref(15) // 字/分鐘,決定速度
const playing = ref(false)
let audioCtx: AudioContext | null = null
let stopFlag = false

// 標準:1 單位(秒)= 1.2 / WPM(PARIS 標準)
const unitSec = computed(() => 1.2 / wpm.value)

async function play() {
  if (playing.value) {
    stopFlag = true
    return
  }
  const tones: Tone[] = morseToTones(morseForPlay.value)
  if (tones.length === 0) return
  stopFlag = false
  playing.value = true
  try {
    type Ctor = typeof AudioContext
    const Ctx: Ctor =
      window.AudioContext || (window as unknown as { webkitAudioContext: Ctor }).webkitAudioContext
    audioCtx = audioCtx || new Ctx()
    const ctx = audioCtx
    if (ctx.state === 'suspended') await ctx.resume()
    let t = ctx.currentTime + 0.05
    const u = unitSec.value
    const gain = ctx.createGain()
    gain.gain.value = 0
    gain.connect(ctx.destination)
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 600
    osc.connect(gain)
    osc.start(t)
    let end = t
    for (const tone of tones) {
      const dur = tone.units * u
      if (tone.on) {
        gain.gain.setValueAtTime(0.0001, t)
        gain.gain.exponentialRampToValueAtTime(0.3, t + 0.005)
        gain.gain.setValueAtTime(0.3, t + dur - 0.005)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      }
      t += dur
      end = t
    }
    osc.stop(end + 0.05)
    // 等到結束或被中止
    await new Promise<void>((resolve) => {
      const check = () => {
        if (stopFlag || ctx.currentTime >= end) {
          try {
            osc.stop()
          } catch {
            /* 已停止 */
          }
          resolve()
        } else {
          requestAnimationFrame(check)
        }
      }
      requestAnimationFrame(check)
    })
  } catch {
    /* 忽略音訊錯誤 */
  } finally {
    playing.value = false
  }
}

onUnmounted(() => {
  stopFlag = true
  if (audioCtx) audioCtx.close()
})

const EXAMPLES_ENCODE = ['SOS', 'HELLO WORLD', 'I LOVE YOU', '73 88']
const EXAMPLES_DECODE = ['... --- ...', '.... . .-.. .-.. --- / .-- --- .-. .-.. -..']
</script>

<template>
  <div class="space-y-6">
    <div class="card p-5 space-y-4">
      <div class="flex gap-2">
        <button
          type="button"
          class="flex-1 rounded-lg border px-3 py-2 text-sm font-medium"
          :class="
            mode === 'encode'
              ? 'border-brand-400 bg-brand-50 text-brand-700'
              : 'border-ink-200 text-ink-600 hover:bg-ink-50'
          "
          @click="mode = 'encode'"
        >
          文字 → 摩斯
        </button>
        <button
          type="button"
          class="flex-1 rounded-lg border px-3 py-2 text-sm font-medium"
          :class="
            mode === 'decode'
              ? 'border-brand-400 bg-brand-50 text-brand-700'
              : 'border-ink-200 text-ink-600 hover:bg-ink-50'
          "
          @click="mode = 'decode'"
        >
          摩斯 → 文字
        </button>
      </div>

      <label class="block text-sm">
        <span class="text-ink-500">{{
          mode === 'encode' ? '輸入文字(A–Z、0–9、常用標點)' : '輸入摩斯碼(. - 點劃、空白分字母、/ 分單字)'
        }}</span>
        <textarea
          v-model="input"
          rows="3"
          class="mc-input"
          :class="{ 'font-mono': mode === 'decode' }"
          :placeholder="mode === 'encode' ? 'SOS' : '... --- ...'"
        ></textarea>
      </label>

      <div class="flex flex-wrap gap-2">
        <button
          v-for="ex in mode === 'encode' ? EXAMPLES_ENCODE : EXAMPLES_DECODE"
          :key="ex"
          type="button"
          class="rounded-lg border border-ink-200 px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          :class="{ 'font-mono': mode === 'decode' }"
          @click="input = ex"
        >
          {{ ex }}
        </button>
      </div>

      <div
        v-if="autoHint"
        class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700"
      >
        這看起來是摩斯碼 —— 要不要切到「摩斯 → 文字」?
        <button class="underline ml-1" type="button" @click="mode = 'decode'">切換</button>
      </div>
    </div>

    <div class="card p-5 space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-sm font-semibold text-ink-700">{{
          mode === 'encode' ? '摩斯碼' : '文字'
        }}</span>
        <div class="flex gap-2">
          <button
            type="button"
            class="rounded-lg border border-ink-200 px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
            @click="swap"
          >
            ⇄ 對調
          </button>
          <button
            type="button"
            class="rounded-lg border border-ink-200 px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
            :disabled="!result.output"
            @click="copyOut"
          >
            {{ copied ? '已複製' : '複製' }}
          </button>
        </div>
      </div>
      <div
        class="min-h-[3rem] rounded-lg bg-ink-50 p-3 break-all text-ink-800"
        :class="mode === 'encode' ? 'font-mono text-lg tracking-wider' : 'text-lg'"
      >
        {{ result.output || '—' }}
      </div>
      <p v-if="result.unsupported.length" class="text-xs text-rose-600">
        無法{{ mode === 'encode' ? '編碼' : '解碼' }}並已略過:{{ result.unsupported.join('、') }}
      </p>

      <!-- 播放 -->
      <div class="flex items-center gap-3 pt-1">
        <button
          type="button"
          class="rounded-lg border px-4 py-2 text-sm font-medium"
          :class="
            playing
              ? 'border-rose-300 bg-rose-50 text-rose-600'
              : 'border-brand-400 bg-brand-50 text-brand-700 hover:bg-brand-100'
          "
          :disabled="!morseForPlay.trim()"
          @click="play"
        >
          {{ playing ? '■ 停止' : '▶ 播放嗶聲' }}
        </button>
        <label class="flex items-center gap-2 text-sm text-ink-500">
          速度
          <input v-model.number="wpm" type="range" min="5" max="30" step="1" />
          <span class="font-mono text-ink-700 w-14">{{ wpm }} WPM</span>
        </label>
      </div>
    </div>

    <LegalNote>
      <p>
        本工具採 <strong>ITU-R M.1677-1 國際摩斯電碼</strong>標準碼表(A–Z、0–9、常用標點與少數重音字母)。
        編碼時字母間以一個空白、單字間以「<strong>/</strong>」分隔;解碼時可接受多個空白或「/」作單字邊界,
        點劃可用 <code>.</code> <code>-</code> 或全形「・」「−」。
      </p>
      <p>
        播放採 <strong>PARIS 標準速度</strong>:一個時間單位 = 1.2 ÷ WPM 秒,點 1 單位、劃 3 單位,
        字母內間隔 1、字母間 3、單字間 7 單位;以 Web Audio 在你裝置上即時合成 600Hz 嗶聲。
      </p>
      <p>全程在你的瀏覽器計算與發聲,<strong>不連網、不上傳</strong>。</p>
    </LegalNote>
  </div>
</template>

<style scoped>
.mc-input {
  width: 100%;
  margin-top: 0.25rem;
  border: 1px solid var(--color-ink-200, #e2e8f0);
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
  font-size: 0.95rem;
  resize: vertical;
}
</style>
