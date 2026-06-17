<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import LegalNote from '@/components/LegalNote.vue'

/*
  文字朗讀 —— 用瀏覽器內建的語音合成(Web Speech API)把貼上的文字唸出來,
  給視力不便、眼睛累、或想用聽的長輩/家人。全程在你的裝置上發聲,文字不上傳、不需網路帳號。
  注意:可用的語音由你的作業系統/瀏覽器提供,品質與中文支援因裝置而異。
*/
const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

const text = ref('在這裡貼上想聽的文字,按「開始朗讀」即可。')
const voices = ref<SpeechSynthesisVoice[]>([])
const selectedVoice = ref<string>('') // voiceURI
const rate = ref(1)
const pitch = ref(1)
const speaking = ref(false)
const paused = ref(false)

let utterance: SpeechSynthesisUtterance | null = null

function loadVoices() {
  if (!supported) return
  const all = window.speechSynthesis.getVoices()
  // 中文語音優先排在前面,方便長輩直接用
  voices.value = all.slice().sort((a, b) => {
    const za = a.lang.toLowerCase().startsWith('zh') ? 0 : 1
    const zb = b.lang.toLowerCase().startsWith('zh') ? 0 : 1
    return za - zb
  })
  if (!selectedVoice.value && voices.value.length) {
    const zh = voices.value.find((v) => v.lang.toLowerCase().startsWith('zh'))
    selectedVoice.value = (zh ?? voices.value[0]).voiceURI
  }
}

function speak() {
  if (!supported || !text.value.trim()) return
  window.speechSynthesis.cancel()
  utterance = new SpeechSynthesisUtterance(text.value)
  const v = voices.value.find((x) => x.voiceURI === selectedVoice.value)
  if (v) {
    utterance.voice = v
    utterance.lang = v.lang
  }
  utterance.rate = rate.value
  utterance.pitch = pitch.value
  utterance.onstart = () => {
    speaking.value = true
    paused.value = false
  }
  utterance.onend = () => {
    speaking.value = false
    paused.value = false
  }
  utterance.onerror = () => {
    speaking.value = false
    paused.value = false
  }
  window.speechSynthesis.speak(utterance)
}

function pauseResume() {
  if (!supported) return
  if (paused.value) {
    window.speechSynthesis.resume()
    paused.value = false
  } else {
    window.speechSynthesis.pause()
    paused.value = true
  }
}

function stop() {
  if (!supported) return
  window.speechSynthesis.cancel()
  speaking.value = false
  paused.value = false
}

const charCount = computed(() => text.value.length)

onMounted(() => {
  if (!supported) return
  loadVoices()
  window.speechSynthesis.onvoiceschanged = loadVoices
})
onBeforeUnmount(() => {
  if (supported) window.speechSynthesis.cancel()
})
</script>

<template>
  <div class="space-y-6">
    <div v-if="!supported" class="card p-6">
      <p class="text-ink-700">😕 您目前的瀏覽器不支援語音朗讀功能。建議用較新版的 Chrome、Edge 或 Safari 再試一次。</p>
    </div>

    <template v-else>
      <div class="card p-6 space-y-4">
        <div>
          <label class="field-label">要朗讀的文字</label>
          <textarea v-model="text" rows="6" class="field-input text-base" placeholder="貼上文章、訊息、說明…" />
          <p class="field-hint">{{ charCount }} 字。全程在你的裝置上發聲,文字不會上傳。</p>
        </div>

        <div class="grid gap-4 sm:grid-cols-3">
          <div>
            <label class="field-label">語音</label>
            <select v-model="selectedVoice" class="field-input">
              <option v-for="v in voices" :key="v.voiceURI" :value="v.voiceURI">
                {{ v.name }}（{{ v.lang }}）
              </option>
            </select>
          </div>
          <div>
            <label class="field-label">速度:{{ rate.toFixed(1) }}×</label>
            <input v-model.number="rate" type="range" min="0.5" max="2" step="0.1" class="w-full accent-brand-600" />
          </div>
          <div>
            <label class="field-label">音調:{{ pitch.toFixed(1) }}</label>
            <input v-model.number="pitch" type="range" min="0" max="2" step="0.1" class="w-full accent-brand-600" />
          </div>
        </div>

        <div class="flex flex-wrap gap-3">
          <button
            class="rounded-xl bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-40"
            :disabled="!text.trim()"
            @click="speak"
          >
            ▶ 開始朗讀
          </button>
          <button
            class="rounded-xl border border-line px-6 py-3 text-base font-semibold text-ink-700 transition hover:bg-stone-50 disabled:opacity-40"
            :disabled="!speaking"
            @click="pauseResume"
          >
            {{ paused ? '▶ 繼續' : '⏸ 暫停' }}
          </button>
          <button
            class="rounded-xl border border-line px-6 py-3 text-base font-semibold text-ink-700 transition hover:bg-stone-50 disabled:opacity-40"
            :disabled="!speaking"
            @click="stop"
          >
            ⏹ 停止
          </button>
        </div>
      </div>

      <LegalNote title="使用說明">
        <ul class="list-disc pl-5 space-y-1">
          <li>適合視力不便、眼睛疲勞,或想「用聽的」看文章、訊息的長輩與家人。</li>
          <li>可選擇的語音由你的<strong>作業系統 / 瀏覽器</strong>提供;若清單裡沒有中文語音,可到系統設定加裝語音套件。</li>
          <li>朗讀<strong>全程在你的裝置上完成</strong>,文字不會上傳到任何伺服器,也不需要帳號。</li>
          <li>速度、音調可調整;按「暫停」可隨時停下再繼續。</li>
        </ul>
      </LegalNote>
    </template>
  </div>
</template>
