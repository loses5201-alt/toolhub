<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  caesar,
  rot13,
  rot47,
  atbash,
  vigenere,
  a1z26Encode,
  a1z26Decode,
  caesarBruteForce,
} from '@/features/cipher'

/*
  古典密碼 —— 凱撒 / ROT13 / ROT47 / Atbash / Vigenère / A1Z26 編解碼。
  全程在你的瀏覽器計算,不連網、不上傳。僅供學習與娛樂,非安全加密。
*/

type Algo = 'caesar' | 'rot13' | 'rot47' | 'atbash' | 'vigenere' | 'a1z26'
const algo = ref<Algo>('caesar')
const decode = ref(false)
const input = ref('HELLO WORLD')
const shift = ref(3)
const key = ref('KEY')

const ALGOS: { id: Algo; name: string; selfInverse: boolean }[] = [
  { id: 'caesar', name: '凱撒位移', selfInverse: false },
  { id: 'rot13', name: 'ROT13', selfInverse: true },
  { id: 'rot47', name: 'ROT47', selfInverse: true },
  { id: 'atbash', name: 'Atbash', selfInverse: true },
  { id: 'vigenere', name: 'Vigenère', selfInverse: false },
  { id: 'a1z26', name: 'A1Z26', selfInverse: false },
]

const output = computed(() => {
  const t = input.value
  switch (algo.value) {
    case 'caesar':
      return caesar(t, shift.value, decode.value)
    case 'rot13':
      return rot13(t)
    case 'rot47':
      return rot47(t)
    case 'atbash':
      return atbash(t)
    case 'vigenere':
      return vigenere(t, key.value, decode.value)
    case 'a1z26':
      return decode.value ? a1z26Decode(t) : a1z26Encode(t)
  }
  return ''
})

const brute = computed(() => (algo.value === 'caesar' ? caesarBruteForce(input.value) : []))

const copied = ref('')
async function copy(text: string, k: string) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = k
    setTimeout(() => (copied.value = ''), 1200)
  } catch {
    /* 忽略 */
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-5 space-y-4">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="al in ALGOS"
          :key="al.id"
          type="button"
          class="rounded-lg border px-3 py-1.5 text-sm font-medium"
          :class="
            algo === al.id
              ? 'border-brand-400 bg-brand-50 text-brand-700'
              : 'border-ink-200 text-ink-600 hover:bg-ink-50'
          "
          @click="algo = al.id"
        >
          {{ al.name }}
        </button>
      </div>

      <div class="flex flex-wrap items-center gap-4">
        <label
          v-if="!ALGOS.find((a) => a.id === algo)?.selfInverse"
          class="flex items-center gap-2 text-sm"
        >
          <input v-model="decode" type="checkbox" class="w-4 h-4" />
          <span>解碼 / 解密</span>
        </label>
        <span
          v-else
          class="text-xs text-ink-400"
          >此演算法為自反(加解密相同)</span
        >

        <label v-if="algo === 'caesar'" class="flex items-center gap-2 text-sm">
          位移量
          <input
            v-model.number="shift"
            type="number"
            min="0"
            max="25"
            class="w-20 rounded-lg border border-ink-200 px-2 py-1 font-mono"
          />
        </label>

        <label v-if="algo === 'vigenere'" class="flex items-center gap-2 text-sm flex-1 min-w-[12rem]">
          金鑰
          <input
            v-model="key"
            type="text"
            class="flex-1 rounded-lg border border-ink-200 px-2 py-1 font-mono"
            placeholder="KEY"
          />
        </label>
      </div>

      <label class="block text-sm">
        <span class="text-ink-500">輸入文字</span>
        <textarea v-model="input" rows="3" class="cc-input font-mono"></textarea>
      </label>
    </div>

    <div class="card p-5 space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-sm font-semibold text-ink-700">結果</span>
        <button
          type="button"
          class="rounded-lg border border-ink-200 px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          :disabled="!output"
          @click="copy(output, 'out')"
        >
          {{ copied === 'out' ? '已複製' : '複製' }}
        </button>
      </div>
      <div class="min-h-[3rem] rounded-lg bg-ink-50 p-3 font-mono break-all text-ink-800">
        {{ output || '—' }}
      </div>
    </div>

    <!-- 凱撒暴力破解 -->
    <div v-if="algo === 'caesar' && input.trim()" class="card p-5 space-y-2">
      <span class="text-sm font-semibold text-ink-700">凱撒暴力破解(全部 25 種位移)</span>
      <p class="text-xs text-ink-400">不知道位移量時,從下面找出讀得通的那一行。</p>
      <div class="grid sm:grid-cols-2 gap-1 text-sm">
        <button
          v-for="row in brute"
          :key="row.shift"
          type="button"
          class="text-left rounded px-2 py-1 hover:bg-brand-50 font-mono"
          @click="copy(row.text, 'b' + row.shift)"
          :title="'點擊複製'"
        >
          <span class="text-ink-400 mr-2">−{{ row.shift }}</span>{{ row.text }}
        </button>
      </div>
    </div>

    <LegalNote>
      <p>
        <strong>凱撒位移</strong>把每個字母往後位移固定數;<strong>ROT13</strong> 是位移 13(自反);
        <strong>ROT47</strong> 對可見 ASCII 位移 47(連標點數字也換,自反);<strong>Atbash</strong> 把字母表頭尾對調
        (A↔Z,自反);<strong>Vigenère</strong> 用金鑰逐字母位移;<strong>A1Z26</strong> 把 A–Z 轉成 1–26。
      </p>
      <p>常見於教學、解謎、密室逃脫、CTF。不知道凱撒位移量時,可用下方「暴力破解」一次看完 25 種結果。</p>
      <p>
        ⚠️ 這些都是<strong>古典密碼,極易破解,絕非安全加密</strong>,請勿用於保護真正的機密。
        全程在你的瀏覽器計算,<strong>不連網、不上傳</strong>。需要真正加密請用密碼保險箱(AES)。
      </p>
    </LegalNote>
  </div>
</template>

<style scoped>
.cc-input {
  width: 100%;
  margin-top: 0.25rem;
  border: 1px solid var(--color-ink-200, #e2e8f0);
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
  font-size: 0.95rem;
  resize: vertical;
}
</style>
