<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  decodeBig5,
  decodeUtf8,
  encodeBig5,
  encodeUtf8,
  looksLikeUtf8,
} from '@/features/big5'

/*
  Big5 ↔ UTF-8 文字檔轉換 —— 早年 Windows 記事本存的 Big5/ANSI .txt 在 Mac/手機/網頁變亂碼,
  或反過來要轉成老程式吃的 Big5。全程在瀏覽器轉換、檔案不上傳。核心在 src/features/big5.ts(可測)。
*/
type Enc = 'big5' | 'utf8'

const fileName = ref('')
const rawBytes = ref<Uint8Array | null>(null)
const sourceEnc = ref<Enc>('big5')
const targetEnc = ref<Enc>('utf8')
const error = ref('')
const autoGuess = ref('')

const encLabel: Record<Enc, string> = { big5: 'Big5(繁體/ANSI)', utf8: 'UTF-8' }

const decoded = computed(() => {
  if (!rawBytes.value) return ''
  return sourceEnc.value === 'big5' ? decodeBig5(rawBytes.value) : decodeUtf8(rawBytes.value)
})

const hasGarble = computed(() => decoded.value.includes('�'))

const encodeResult = computed(() => {
  const text = decoded.value
  if (!text) return { bytes: new Uint8Array(), unmapped: [] as string[] }
  return targetEnc.value === 'big5'
    ? encodeBig5(text)
    : { bytes: encodeUtf8(text), unmapped: [] as string[] }
})

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f) return
  error.value = ''
  try {
    const bytes = new Uint8Array(await f.arrayBuffer())
    rawBytes.value = bytes
    fileName.value = f.name.replace(/\.[^.]+$/, '')
    // 自動猜來源編碼:合法 UTF-8 → 多半是 UTF-8;否則當 Big5
    const isUtf8 = looksLikeUtf8(bytes)
    sourceEnc.value = isUtf8 ? 'utf8' : 'big5'
    targetEnc.value = isUtf8 ? 'big5' : 'utf8'
    autoGuess.value = isUtf8
      ? '自動判斷:這個檔看起來是 UTF-8'
      : '自動判斷:這個檔不是合法 UTF-8,推測為 Big5'
  } catch (err) {
    error.value = '讀取失敗:' + (err as Error).message
  }
}

function swap() {
  const s = sourceEnc.value
  sourceEnc.value = targetEnc.value
  targetEnc.value = s
}

function download() {
  if (!rawBytes.value) return
  const { bytes } = encodeResult.value
  const blob = new Blob([bytes as BlobPart], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${fileName.value || 'text'}_${targetEnc.value}.txt`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function clearAll() {
  rawBytes.value = null
  fileName.value = ''
  error.value = ''
  autoGuess.value = ''
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 sm:p-6 space-y-5">
      <div>
        <label class="field-label">選擇文字檔(.txt / .csv / .srt 等純文字)</label>
        <input type="file" accept=".txt,.csv,.srt,.log,.md,text/*" class="field-input" @change="onFile" />
        <p class="field-hint">檔案只在你的瀏覽器轉換、不會上傳。會自動判斷來源編碼,可手動修正。</p>
      </div>

      <template v-if="rawBytes">
        <p v-if="autoGuess" class="text-xs text-ink-500">{{ autoGuess }}</p>

        <div class="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <label class="block text-sm">
            <span class="field-label">來源編碼(原檔)</span>
            <select v-model="sourceEnc" class="field-input">
              <option value="big5">{{ encLabel.big5 }}</option>
              <option value="utf8">{{ encLabel.utf8 }}</option>
            </select>
          </label>
          <button
            type="button"
            class="mb-1 rounded-lg border border-line px-3 py-2 text-sm hover:border-brand-400"
            title="對調"
            @click="swap"
          >
            ⇄
          </button>
          <label class="block text-sm">
            <span class="field-label">轉成(輸出)</span>
            <select v-model="targetEnc" class="field-input">
              <option value="utf8">{{ encLabel.utf8 }}</option>
              <option value="big5">{{ encLabel.big5 }}</option>
            </select>
          </label>
        </div>

        <div
          v-if="hasGarble"
          class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          預覽仍有亂碼(�)—— 來源編碼可能選錯,試試切換成另一種。
        </div>

        <div>
          <span class="field-label">預覽(以「{{ encLabel[sourceEnc] }}」解讀)</span>
          <pre class="max-h-72 overflow-auto rounded-xl border border-line bg-ink-50 p-3 text-sm whitespace-pre-wrap break-words text-ink-800">{{ decoded || '(空白)' }}</pre>
        </div>

        <div
          v-if="targetEnc === 'big5' && encodeResult.unmapped.length"
          class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          有 {{ encodeResult.unmapped.length }} 個字 Big5 無法表示,已用「?」代替:
          <span class="font-medium break-all">{{ encodeResult.unmapped.slice(0, 30).join(' ') }}</span>
          <span v-if="encodeResult.unmapped.length > 30">…</span>
        </div>

        <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

        <div class="flex flex-wrap items-center gap-3">
          <button class="btn-primary !py-2 text-sm" @click="download">
            下載 {{ encLabel[targetEnc] }} 檔
          </button>
          <button class="text-ink-400 underline text-sm hover:text-red-500" @click="clearAll">
            清空重來
          </button>
        </div>
      </template>

      <p v-else-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>
    </div>

    <LegalNote title="什麼情況需要這個?">
      <ul class="list-disc pl-5 space-y-1">
        <li>
          早年 Windows「記事本」用<strong>預設(ANSI=Big5)</strong>存的 .txt,拿到 Mac、手機、上傳網站或新程式打開,中文常變整片亂碼 ——
          把來源設 Big5、轉成 UTF-8 即可救回。
        </li>
        <li>反過來:有些老舊程式只吃 Big5,可把 UTF-8 檔轉成 Big5 給它。</li>
        <li>
          和「亂碼修復」不同:那支救的是「UTF-8 被當西歐編碼」變成 <code>ä¸­æ–‡</code> 的那類文字;
          這支處理「整個檔案就是某種編碼」的轉換。
        </li>
        <li>
          若轉成 Big5 時出現「某些字無法表示」,是因為這些字(emoji、簡體專用字、罕見字)不在 Big5 字集裡,屬正常限制。
        </li>
        <li>全程在你的瀏覽器轉換,檔案不上傳。</li>
      </ul>
    </LegalNote>
  </div>
</template>
