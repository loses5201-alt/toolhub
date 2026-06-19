<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import {
  hexDump,
  dumpToText,
  textToBytes,
  parseHex,
  type HexDump,
} from '@/features/hexView'

/*
  Hex 檢視器 —— 把檔案或文字以「位移 + 十六進位 + ASCII」三欄排版,像 xxd / hexdump。
  看清檔案開頭的魔術位元組、編碼、夾帶內容,或把十六進位字串還原成文字。
  全程在你的瀏覽器讀取與排版,不連網、不上傳。
*/

type Mode = 'file' | 'text' | 'hex'
const mode = ref<Mode>('file')

const bytes = ref<Uint8Array>(new Uint8Array(0))
const fileName = ref('')
const textInput = ref('')
const hexInput = ref('')
const hexError = ref('')

const bytesPerRow = ref(16)
const uppercase = ref(false)
const dragging = ref(false)

const MAX_BYTES = 256 * 1024 // 排版上限,避免超大檔卡瀏覽器

const rowOptions = [8, 16, 32]

function setBytesFromText() {
  bytes.value = textToBytes(textInput.value)
  fileName.value = ''
}

function setBytesFromHex() {
  const parsed = parseHex(hexInput.value)
  if (parsed === null) {
    hexError.value = '不是有效的十六進位 —— 請確認只含 0-9 / a-f,且位數為偶數。'
    bytes.value = new Uint8Array(0)
  } else {
    hexError.value = ''
    bytes.value = parsed
    fileName.value = ''
  }
}

async function handleFile(file: File) {
  const slice = file.slice(0, MAX_BYTES)
  bytes.value = new Uint8Array(await slice.arrayBuffer())
  fileName.value = file.name
}

function onDrop(e: DragEvent) {
  dragging.value = false
  const f = e.dataTransfer?.files?.[0]
  if (f) handleFile(f)
}
function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.[0]) handleFile(input.files[0])
  input.value = ''
}

function switchMode(m: Mode) {
  mode.value = m
  bytes.value = new Uint8Array(0)
  fileName.value = ''
  hexError.value = ''
}

const dump = computed<HexDump>(() =>
  hexDump(bytes.value, {
    bytesPerRow: bytesPerRow.value,
    uppercase: uppercase.value,
    maxBytes: MAX_BYTES,
  }),
)

const asText = computed(() => dumpToText(dump.value))

// hex 模式下另外顯示「還原成 UTF-8 文字」
const decodedText = computed(() => {
  if (mode.value !== 'hex' || bytes.value.length === 0) return ''
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes.value)
  } catch {
    return ''
  }
})

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* 忽略:某些瀏覽器需 HTTPS 或權限 */
  }
}

function download() {
  const blob = new Blob([asText.value], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = (fileName.value || 'hexdump') + '.txt'
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <!-- 來源切換 -->
      <div class="flex flex-wrap gap-2">
        <button
          v-for="m in (['file', 'text', 'hex'] as Mode[])"
          :key="m"
          type="button"
          class="rounded-lg border px-3 py-1.5 text-sm transition"
          :class="
            mode === m
              ? 'border-brand-500 bg-brand-600 text-white'
              : 'border-ink-200 text-ink-600 hover:bg-ink-50'
          "
          @click="switchMode(m)"
        >
          {{ m === 'file' ? '讀取檔案' : m === 'text' ? '貼上文字' : '十六進位還原' }}
        </button>
      </div>

      <!-- 檔案模式 -->
      <div
        v-if="mode === 'file'"
        class="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition"
        :class="dragging ? 'border-brand-400 bg-brand-50/60' : 'border-line bg-stone-50/40'"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="onDrop"
      >
        <div class="text-4xl">🔢</div>
        <p class="mt-2 font-medium text-ink-700">把檔案拖進來,或</p>
        <label class="mt-2 cursor-pointer rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          選擇檔案
          <input type="file" class="hidden" @change="onPick" />
        </label>
        <p class="mt-3 text-xs text-ink-400">
          只讀取前 <strong>256 KB</strong> 排版,<strong>不會上傳</strong>。
        </p>
      </div>

      <!-- 文字模式 -->
      <div v-else-if="mode === 'text'">
        <label class="field-label">輸入文字(以 UTF-8 編碼後檢視位元組)</label>
        <textarea
          v-model="textInput"
          rows="4"
          class="field-input font-mono"
          placeholder="例如 Hello 中文 😀"
          spellcheck="false"
          @input="setBytesFromText"
        ></textarea>
      </div>

      <!-- 十六進位還原模式 -->
      <div v-else>
        <label class="field-label">貼上十六進位(可含空白 / 換行 / 0x 前綴 / 逗號)</label>
        <textarea
          v-model="hexInput"
          rows="4"
          class="field-input font-mono"
          placeholder="例如 48 65 6c 6c 6f 或 0x48,0x65"
          spellcheck="false"
          @input="setBytesFromHex"
        ></textarea>
        <p v-if="hexError" class="mt-2 text-sm text-amber-700">⚠️ {{ hexError }}</p>
        <div v-else-if="decodedText" class="mt-2 rounded-lg bg-ink-50 p-3">
          <div class="text-xs font-semibold text-ink-400">還原成 UTF-8 文字</div>
          <div class="break-all font-mono text-ink-800">{{ decodedText }}</div>
        </div>
      </div>

      <!-- 顯示選項 -->
      <div v-if="bytes.length" class="flex flex-wrap items-center gap-4 text-sm">
        <label class="flex items-center gap-1.5 text-ink-600">
          每列
          <select v-model.number="bytesPerRow" class="rounded-lg border border-ink-200 px-2 py-1">
            <option v-for="n in rowOptions" :key="n" :value="n">{{ n }} 位元組</option>
          </select>
        </label>
        <label class="flex items-center gap-1.5 text-ink-600">
          <input v-model="uppercase" type="checkbox" class="rounded" />
          大寫
        </label>
        <span class="text-ink-400">
          共 {{ fmtSize(dump.total) }}
          <template v-if="dump.truncated">(只顯示前 {{ fmtSize(dump.shown) }})</template>
        </span>
      </div>
    </div>

    <!-- 結果 -->
    <div v-if="dump.rows.length" class="card p-6 space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-sm font-semibold text-ink-600">
          {{ fileName ? fileName : 'Hex Dump' }}
        </h2>
        <div class="flex gap-2">
          <button
            class="rounded-lg border border-ink-200 px-3 py-1.5 text-sm text-ink-600 transition hover:bg-ink-50"
            @click="copy(asText)"
          >
            複製
          </button>
          <button
            class="rounded-lg border border-ink-200 px-3 py-1.5 text-sm text-ink-600 transition hover:bg-ink-50"
            @click="download"
          >
            下載 .txt
          </button>
        </div>
      </div>
      <div class="overflow-x-auto rounded-lg bg-ink-900/95 p-3">
        <pre class="font-mono text-xs leading-relaxed text-emerald-100"><span v-for="(r, i) in dump.rows" :key="i"><span class="text-ink-400">{{ r.offset }}</span>  <span class="text-sky-200">{{ r.hex }}</span>  <span class="text-amber-100">|{{ r.ascii }}|</span>{{ '\n' }}</span></pre>
      </div>
      <p v-if="dump.truncated" class="text-xs text-amber-600">
        檔案較大,僅排版前 256 KB(避免瀏覽器卡頓)。
      </p>
    </div>

    <div class="text-sm text-ink-500">
      想確認檔案真實格式?用
      <RouterLink to="/tools/file-type" class="font-semibold text-brand-700 underline hover:text-brand-800">
        檔案真實類型檢測
      </RouterLink>
      看魔術位元組;想看單一字元的 Unicode 碼點,用
      <RouterLink to="/tools/char-inspect" class="font-semibold text-brand-700 underline hover:text-brand-800">
        字元檢視器
      </RouterLink>
      。
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>把任何檔案或文字攤開成<strong>十六進位 + ASCII</strong>三欄,看清檔頭、編碼、夾帶內容(像 <code>xxd</code> / <code>hexdump</code>)。</li>
        <li>左欄是<strong>位移位址</strong>、中欄是位元組的十六進位、右欄是可列印字元(其餘以 <code>.</code> 表示)。</li>
        <li>反向把<strong>十六進位字串還原</strong>成位元組與 UTF-8 文字,讀 log / 封包 / 設定值很方便。</li>
        <li>每列位元組數、大小寫可調;結果可複製或下載成 <code>.txt</code>。</li>
        <li>全程<strong>在你的瀏覽器</strong>讀取與排版(檔案只讀前 256 KB),<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
