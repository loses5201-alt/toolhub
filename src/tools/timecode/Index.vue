<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  FPS_OPTIONS,
  fpsById,
  framesToTimecode,
  parseTimecode,
  timecodeToFrames,
  framesToSeconds,
  formatSeconds,
} from '@/features/timecode'

/*
  SMPTE 影格 / 時間碼換算 —— 影格數 ↔ 時間碼,支援 drop-frame,並算實際長度。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

const fpsId = ref('29.97')
const dropFrame = ref(true)
const fps = computed(() => fpsById(fpsId.value)!)

// 切換到不支援 DF 的幀率時自動關閉
watch(fps, (f) => {
  if (!f.dropAllowed) dropFrame.value = false
})

type Mode = 'frames' | 'timecode'
const mode = ref<Mode>('frames')
const framesInput = ref<number | null>(1800)
const tcInput = ref('00:01:00;02')

// 由輸入算出標準化的影格數
const frameNumber = computed<number | null>(() => {
  if (mode.value === 'frames') {
    const n = framesInput.value
    return n === null || !Number.isFinite(n) ? null : Math.trunc(n)
  }
  const p = parseTimecode(tcInput.value)
  if (!p) return null
  return timecodeToFrames(p, fps.value.nominal, dropFrame.value)
})

const timecode = computed(() =>
  frameNumber.value === null
    ? ''
    : framesToTimecode(frameNumber.value, fps.value.nominal, dropFrame.value),
)
const seconds = computed(() =>
  frameNumber.value === null ? null : framesToSeconds(frameNumber.value, fps.value.actual),
)
const tcParseError = computed(
  () => mode.value === 'timecode' && tcInput.value.trim() !== '' && frameNumber.value === null,
)

const copied = ref('')
async function copy(text: string, key: string) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = key
    setTimeout(() => (copied.value = ''), 1200)
  } catch {
    /* 忽略 */
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-5 space-y-4">
      <div class="grid sm:grid-cols-2 gap-3">
        <label class="block text-sm">
          <span class="text-ink-500">幀率(fps)</span>
          <select v-model="fpsId" class="tc-input">
            <option v-for="f in FPS_OPTIONS" :key="f.id" :value="f.id">{{ f.label }}</option>
          </select>
        </label>
        <label
          class="flex items-end gap-2 text-sm pb-1"
          :class="{ 'opacity-40': !fps.dropAllowed }"
        >
          <input
            v-model="dropFrame"
            type="checkbox"
            class="w-4 h-4"
            :disabled="!fps.dropAllowed"
          />
          <span>Drop-frame(掉幀,分號 <code>;</code>)</span>
        </label>
      </div>

      <div class="flex gap-2">
        <button
          type="button"
          class="flex-1 rounded-lg border px-3 py-2 text-sm font-medium"
          :class="
            mode === 'frames'
              ? 'border-brand-400 bg-brand-50 text-brand-700'
              : 'border-ink-200 text-ink-600 hover:bg-ink-50'
          "
          @click="mode = 'frames'"
        >
          影格數 → 時間碼
        </button>
        <button
          type="button"
          class="flex-1 rounded-lg border px-3 py-2 text-sm font-medium"
          :class="
            mode === 'timecode'
              ? 'border-brand-400 bg-brand-50 text-brand-700'
              : 'border-ink-200 text-ink-600 hover:bg-ink-50'
          "
          @click="mode = 'timecode'"
        >
          時間碼 → 影格數
        </button>
      </div>

      <label v-if="mode === 'frames'" class="block text-sm">
        <span class="text-ink-500">影格數(frame count)</span>
        <input v-model.number="framesInput" type="number" class="tc-input font-mono" placeholder="1800" />
      </label>
      <label v-else class="block text-sm">
        <span class="text-ink-500">時間碼(HH:MM:SS:FF,drop-frame 用 ; 或 .)</span>
        <input v-model="tcInput" type="text" class="tc-input font-mono" placeholder="00:01:00;02" />
        <span v-if="tcParseError" class="text-rose-600 text-xs">時間碼格式無法解析</span>
      </label>
    </div>

    <div v-if="frameNumber !== null" class="card p-5 space-y-4">
      <div class="flex items-center justify-between">
        <span class="text-sm text-ink-500">時間碼</span>
        <button
          type="button"
          class="rounded-lg border border-ink-200 px-2.5 py-1 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          @click="copy(timecode, 'tc')"
        >
          {{ copied === 'tc' ? '已複製' : '複製' }}
        </button>
      </div>
      <div class="font-mono text-4xl font-semibold text-ink-800">{{ timecode }}</div>

      <div class="grid grid-cols-2 gap-3 pt-2 border-t border-ink-100 text-sm">
        <div>
          <div class="text-ink-400">影格總數</div>
          <div class="font-mono text-lg text-ink-800">{{ frameNumber }}</div>
        </div>
        <div>
          <div class="text-ink-400">實際長度(真實時間)</div>
          <div class="font-mono text-lg text-ink-800">{{ seconds !== null ? formatSeconds(seconds) : '' }}</div>
          <div class="text-xs text-ink-400">{{ seconds !== null ? seconds.toFixed(3) + ' 秒' : '' }}</div>
        </div>
      </div>
    </div>

    <LegalNote>
      <p>
        <strong>時間碼(Timecode)</strong>以 <code>HH:MM:SS:FF</code>(時:分:秒:影格)標記影片每一格的位置,
        是剪輯、對白本、字幕、套對(conform)的共同語言。本工具在<strong>影格數</strong>與<strong>時間碼</strong>
        之間互轉,並用實際幀率算出真實時間長度。
      </p>
      <p>
        <strong>Drop-frame(掉幀)</strong>只用於 29.97 / 59.94 fps:時間碼每分鐘開頭「跳過」2(或 4)個影格編號、
        但每第 10 分鐘不跳,讓時間碼長時間後仍貼近真實時鐘(並非真的丟掉畫面)。以分號 <code>;</code> 表示。
        非掉幀(NDF)以冒號 <code>:</code> 表示。採經典 SMPTE 演算法。
      </p>
      <p>全程在你的瀏覽器計算,<strong>不連網、不上傳</strong>。與時間長度、時間戳換算等工具互補。</p>
    </LegalNote>
  </div>
</template>

<style scoped>
.tc-input {
  width: 100%;
  margin-top: 0.25rem;
  border: 1px solid var(--color-ink-200, #e2e8f0);
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
  font-size: 0.95rem;
  background: #fff;
}
</style>
