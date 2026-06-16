<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  parseSubtitles,
  shiftCues,
  scaleCues,
  toSrt,
  toVtt,
  formatTime,
  type Cue,
} from '@/features/subtitle'

/*
  字幕工坊 —— SRT ↔ VTT 互轉、整體時間平移(字幕快/慢半秒)、速率縮放、重新編號。
  全程在瀏覽器以純函式處理,字幕內容不上傳。
*/
const input = ref('')
const inName = ref('')
const outFormat = ref<'srt' | 'vtt'>('srt')
const offsetSec = ref(0) // 平移秒數(可負、可小數)
const speed = ref(100) // 速率百分比(100 = 不變)
const error = ref('')
const copied = ref(false)

function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!f) return
  inName.value = f.name
  if (outFormat.value === 'srt' && /\.srt$/i.test(f.name)) outFormat.value = 'vtt'
  else if (/\.vtt$/i.test(f.name)) outFormat.value = 'srt'
  const reader = new FileReader()
  reader.onload = () => {
    input.value = String(reader.result || '')
  }
  reader.readAsText(f)
}

const cues = computed<Cue[]>(() => {
  error.value = ''
  if (!input.value.trim()) return []
  try {
    let c = parseSubtitles(input.value)
    if (speed.value !== 100 && speed.value > 0) c = scaleCues(c, speed.value / 100)
    if (offsetSec.value) c = shiftCues(c, Math.round(offsetSec.value * 1000))
    return c
  } catch (e) {
    error.value = '解析失敗:' + (e as Error).message
    return []
  }
})

const output = computed(() => {
  if (!cues.value.length) return ''
  return outFormat.value === 'srt' ? toSrt(cues.value) : toVtt(cues.value)
})

const stats = computed(() => {
  const c = cues.value
  if (!c.length) return null
  return {
    count: c.length,
    first: formatTime(c[0].start, ','),
    last: formatTime(c[c.length - 1].end, ','),
  }
})

async function copy() {
  if (!output.value) return
  try {
    await navigator.clipboard.writeText(output.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    error.value = '無法複製,請手動選取。'
  }
}

function download() {
  if (!output.value) return
  const base = (inName.value.replace(/\.[^.]+$/, '') || '字幕') + '_已調整'
  const ext = outFormat.value
  const mime = ext === 'srt' ? 'application/x-subrip' : 'text/vtt'
  const blob = new Blob([output.value], { type: mime + ';charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${base}.${ext}`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function loadSample() {
  inName.value = '範例.srt'
  outFormat.value = 'vtt'
  input.value = `1
00:00:01,000 --> 00:00:03,500
歡迎使用字幕工坊

2
00:00:04,000 --> 00:00:06,200
字幕內容全程在你的瀏覽器處理

3
00:00:06,800 --> 00:00:09,000
不會上傳到任何伺服器`
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 sm:p-6 space-y-5">
      <div>
        <label class="field-label">貼上字幕內容,或選擇 .srt / .vtt 檔</label>
        <textarea
          v-model="input"
          rows="8"
          class="field-input font-mono text-sm"
          placeholder="把字幕內容貼這裡,支援 SRT(00:00:01,000)與 WebVTT(00:00:01.000)…"
        ></textarea>
        <div class="mt-2 flex flex-wrap items-center gap-3">
          <input type="file" accept=".srt,.vtt,text/plain" class="field-input !w-auto" @change="onFile" />
          <button class="text-sm text-brand-700 underline" @click="loadSample">載入範例</button>
        </div>
        <p class="field-hint">字幕只在你的瀏覽器處理,不會上傳。可同時換格式、整體對時、重新編號。</p>
      </div>

      <template v-if="input.trim()">
        <div class="grid gap-4 sm:grid-cols-3">
          <label class="block">
            <span class="field-label">輸出格式</span>
            <select v-model="outFormat" class="field-input">
              <option value="srt">SRT(.srt)</option>
              <option value="vtt">WebVTT(.vtt)</option>
            </select>
          </label>
          <label class="block">
            <span class="field-label">整體平移(秒)</span>
            <input
              v-model.number="offsetSec"
              type="number"
              step="0.1"
              class="field-input"
              placeholder="例:0.5 慢半秒、-1.2 提早"
            />
          </label>
          <label class="block">
            <span class="field-label">速率(%)</span>
            <input v-model.number="speed" type="number" step="1" min="1" class="field-input" />
          </label>
        </div>
        <p class="text-xs text-ink-500">
          字幕慢了就填正秒數讓它延後、快了填負秒數讓它提早。速率用於整片漸進偏移(如影格率不同),一般維持 100。
        </p>

        <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

        <div v-if="stats" class="rounded-xl border border-line bg-brand-50/40 p-3 text-sm text-ink-700">
          共 <strong class="text-brand-700">{{ stats.count }}</strong> 句字幕,
          時間範圍 {{ stats.first }} ～ {{ stats.last }}(已套用調整,並重新編號)。
        </div>
        <p v-else-if="!error" class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          沒有解析到任何字幕,請確認內容是 SRT 或 VTT 格式。
        </p>

        <div v-if="output">
          <label class="field-label">轉換結果</label>
          <textarea :value="output" rows="10" readonly class="field-input font-mono text-sm"></textarea>
          <div class="mt-3 flex flex-wrap items-center gap-3">
            <button class="btn-primary" @click="download">下載 .{{ outFormat }}</button>
            <button
              class="rounded-lg border border-line bg-white px-4 py-2 text-sm hover:border-brand-400"
              @click="copy"
            >
              {{ copied ? '已複製 ✓' : '複製結果' }}
            </button>
          </div>
        </div>
      </template>
    </div>

    <LegalNote title="使用說明與為什麼用這個">
      <ul class="list-disc space-y-1 pl-5">
        <li><strong>不上傳</strong>:字幕可能含劇本、課程或機密內容,本工具全程在你瀏覽器處理,不送任何伺服器。</li>
        <li><strong>SRT ↔ VTT 互轉</strong>:網頁播放器(HTML5 &lt;track&gt;)用 VTT,多數播放軟體用 SRT,一鍵互換。</li>
        <li><strong>整體對時</strong>:字幕和影片差了幾秒?填平移秒數(正=延後、負=提早)讓它對上。</li>
        <li><strong>速率縮放</strong>:整片愈到後面愈不同步(影格率不同造成)時,微調速率%。</li>
        <li>轉出時會自動重新編號;VTT 的 cue 設定、NOTE/STYLE 區塊會在解析時略過,只保留時間與文字。</li>
      </ul>
    </LegalNote>
  </div>
</template>

