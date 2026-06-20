<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import {
  kanaToRomaji,
  romajiToKana,
  hiraganaToKatakana,
  katakanaToHiragana,
} from '@/features/kana'

/*
  日文假名 ↔ 羅馬字轉換 —— 假名轉赫本式羅馬字、羅馬字轉假名(平/片可選),
  另附平假名 ⇄ 片假名互換。學日文、查發音、輸入日文名都好用。全程在你的瀏覽器執行、不連網。
*/

type Mode = 'kana2romaji' | 'romaji2kana' | 'hira2kata' | 'kata2hira'
const mode = ref<Mode>('kana2romaji')
const input = ref('こんにちは　せかい')
const kanaKind = ref<'hiragana' | 'katakana'>('hiragana') // romaji→kana 時輸出種類

const modes: { id: Mode; label: string; ph: string }[] = [
  { id: 'kana2romaji', label: '假名 → 羅馬字', ph: 'ありがとう / コーヒー' },
  { id: 'romaji2kana', label: '羅馬字 → 假名', ph: 'arigatou / konnichiwa' },
  { id: 'hira2kata', label: '平假名 → 片假名', ph: 'にほんご' },
  { id: 'kata2hira', label: '片假名 → 平假名', ph: 'ニホンゴ' },
]

const result = computed(() => {
  const t = input.value
  switch (mode.value) {
    case 'kana2romaji':
      return kanaToRomaji(t)
    case 'romaji2kana':
      return romajiToKana(t, kanaKind.value === 'katakana')
    case 'hira2kata':
      return hiraganaToKatakana(t)
    case 'kata2hira':
      return katakanaToHiragana(t)
  }
  return ''
})

function setMode(m: Mode) {
  mode.value = m
  const def = modes.find((x) => x.id === m)
  if (def) input.value = def.ph.split(' / ')[0]
}

const copied = ref(false)
function copy() {
  if (!result.value) return
  navigator.clipboard?.writeText(result.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1200)
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="m in modes"
          :key="m.id"
          class="rounded-full border px-3 py-1 text-sm"
          :class="
            mode === m.id
              ? 'border-brand-500 bg-brand-50 text-brand-700'
              : 'border-ink-200 text-ink-600 hover:border-brand-400'
          "
          @click="setMode(m.id)"
        >
          {{ m.label }}
        </button>
      </div>

      <div v-if="mode === 'romaji2kana'" class="flex gap-4 text-sm">
        <label class="flex items-center gap-2">
          <input v-model="kanaKind" type="radio" value="hiragana" />平假名
        </label>
        <label class="flex items-center gap-2">
          <input v-model="kanaKind" type="radio" value="katakana" />片假名
        </label>
      </div>

      <div>
        <label class="field-label">輸入</label>
        <textarea
          v-model="input"
          rows="3"
          class="field-input font-mono text-lg"
          spellcheck="false"
          :placeholder="modes.find((m) => m.id === mode)?.ph"
        />
      </div>
    </div>

    <div class="card p-6 space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold text-ink-700">結果</h2>
        <button class="btn-secondary" @click="copy">{{ copied ? '✓ 已複製' : '複製' }}</button>
      </div>
      <div class="min-h-[3rem] rounded-lg bg-ink-50 p-4 font-mono text-xl break-words text-ink-900">
        {{ result || '—' }}
      </div>
    </div>

    <div class="text-sm text-ink-500">
      想看<RouterLink to="/tools/unicode-normalize" class="font-semibold text-brand-700 underline hover:text-brand-800">Unicode 正規化</RouterLink>、
      <RouterLink to="/tools/char-inspect" class="font-semibold text-brand-700 underline hover:text-brand-800">字元檢視</RouterLink>,或
      <RouterLink to="/tools/morse-code" class="font-semibold text-brand-700 underline hover:text-brand-800">摩斯密碼</RouterLink>?
    </div>

    <LegalNote title="說明">
      <ul class="list-disc pl-5 space-y-1">
        <li>羅馬字採<strong>修正赫本式(Hepburn)</strong>:し=shi、ち=chi、つ=tsu、じ=ji、ふ=fu。</li>
        <li>拗音(きゃ=kya)、促音(っ → 重複下個子音,っち → tcha)、長音記號 ー(重複前一母音)、撥音 ん(母音/y 前作 <code>n'</code>)皆已處理。</li>
        <li>助詞 は/へ/を 以<strong>字面讀音</strong> ha/he/wo 轉寫;實際發音(wa/e/o)需依語境判斷。</li>
        <li>羅馬字轉假名相容部分訓令式拼法(si=し、tu=つ、hu=ふ、zi=じ)。</li>
        <li>全程<strong>在你的瀏覽器</strong>計算,不連網、不上傳。</li>
      </ul>
    </LegalNote>
  </div>
</template>
