<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  utf8ToBytes,
  bytesToUtf8,
  bytesToHex,
  hexToBytes,
  encodeAscii85,
  decodeAscii85,
  encodeZ85,
  decodeZ85,
} from '@/features/base85'

/*
  Base85 / Ascii85 / Z85 編解碼 —— 全程在你的瀏覽器計算,不連網、不上傳。
*/
type Scheme = 'ascii85' | 'z85'
type Dir = 'encode' | 'decode'
type InType = 'text' | 'hex'

const scheme = ref<Scheme>('ascii85')
const dir = ref<Dir>('encode')
const inType = ref<InType>('text')
const delimiters = ref(false)
const input = ref('Hello, World!')

interface Result {
  ok: boolean
  out?: string
  hex?: string
  error?: string
}

const result = computed<Result>(() => {
  const text = input.value
  if (!text.trim()) return { ok: true, out: '' }
  try {
    if (dir.value === 'encode') {
      const bytes = inType.value === 'hex' ? hexToBytes(text) : utf8ToBytes(text)
      const out =
        scheme.value === 'z85'
          ? encodeZ85(bytes)
          : encodeAscii85(bytes, { delimiters: delimiters.value })
      return { ok: true, out }
    } else {
      const bytes = scheme.value === 'z85' ? decodeZ85(text) : decodeAscii85(text)
      let asText = ''
      try {
        asText = bytesToUtf8(bytes)
        // 含控制字元 / 替代字元時,改以提示處理
        if (/�/.test(asText)) asText = '(非文字資料,請看下方十六進位)'
      } catch {
        asText = '(非文字資料,請看下方十六進位)'
      }
      return { ok: true, out: asText, hex: bytesToHex(bytes) }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
})

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

const SCHEMES: { id: Scheme; name: string }[] = [
  { id: 'ascii85', name: 'Ascii85(Adobe/PDF)' },
  { id: 'z85', name: 'Z85(ZeroMQ)' },
]
</script>

<template>
  <div class="space-y-6">
    <div class="card p-5 space-y-4">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="s in SCHEMES"
          :key="s.id"
          type="button"
          class="rounded-lg border px-3 py-1.5 text-sm font-medium"
          :class="
            scheme === s.id
              ? 'border-brand-400 bg-brand-50 text-brand-700'
              : 'border-ink-200 text-ink-600 hover:bg-ink-50'
          "
          @click="scheme = s.id"
        >
          {{ s.name }}
        </button>
      </div>

      <div class="flex flex-wrap items-center gap-4">
        <div class="inline-flex rounded-lg border border-ink-200 p-0.5 text-sm">
          <button
            type="button"
            class="rounded-md px-3 py-1"
            :class="dir === 'encode' ? 'bg-brand-50 text-brand-700' : 'text-ink-500'"
            @click="dir = 'encode'"
          >
            編碼
          </button>
          <button
            type="button"
            class="rounded-md px-3 py-1"
            :class="dir === 'decode' ? 'bg-brand-50 text-brand-700' : 'text-ink-500'"
            @click="dir = 'decode'"
          >
            解碼
          </button>
        </div>

        <label v-if="dir === 'encode'" class="flex items-center gap-2 text-sm">
          輸入為
          <select v-model="inType" class="rounded-lg border border-ink-200 px-2 py-1">
            <option value="text">文字(UTF-8)</option>
            <option value="hex">十六進位</option>
          </select>
        </label>

        <label
          v-if="dir === 'encode' && scheme === 'ascii85'"
          class="flex items-center gap-2 text-sm"
        >
          <input v-model="delimiters" type="checkbox" class="w-4 h-4" />
          <span>加 <code class="font-mono">&lt;~ ~&gt;</code> 包裹</span>
        </label>
      </div>

      <label class="block text-sm">
        <span class="text-ink-500">{{ dir === 'encode' ? '輸入' : '貼上 Base85 字串' }}</span>
        <textarea v-model="input" rows="4" class="b85-input font-mono"></textarea>
      </label>
    </div>

    <div class="card p-5 space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-sm font-semibold text-ink-700">結果</span>
        <button
          v-if="result.ok && result.out"
          type="button"
          class="rounded-lg border border-ink-200 px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          @click="copy(result.out, 'out')"
        >
          {{ copied === 'out' ? '已複製' : '複製' }}
        </button>
      </div>

      <p v-if="!result.ok" class="rounded-lg bg-red-50 p-3 text-sm text-red-700">
        ⚠️ {{ result.error }}
      </p>
      <template v-else>
        <div class="min-h-[3rem] rounded-lg bg-ink-50 p-3 font-mono break-all text-ink-800">
          {{ result.out || '—' }}
        </div>
        <div v-if="result.hex" class="space-y-1">
          <div class="flex items-center justify-between">
            <span class="text-xs text-ink-400">十六進位</span>
            <button
              type="button"
              class="rounded-lg border border-ink-200 px-2 py-1 text-xs text-ink-600 hover:bg-ink-50"
              @click="copy(result.hex, 'hex')"
            >
              {{ copied === 'hex' ? '已複製' : '複製 hex' }}
            </button>
          </div>
          <div class="rounded-lg bg-ink-50 p-3 font-mono break-all text-xs text-ink-700">
            {{ result.hex }}
          </div>
        </div>
      </template>
    </div>

    <LegalNote title="Base85 是什麼?和 Base64 差在哪?">
      <ul class="list-disc pl-5 space-y-1">
        <li>
          <strong>Base85</strong> 用 85 個可見字元表示二進位資料,每 4 bytes 編成 5 字元,
          比 Base64(每 3 bytes 編 4 字元)<strong>省約 7% 體積</strong>。
        </li>
        <li>
          <strong>Ascii85</strong> 是 Adobe / PostScript / PDF 採用的版本:全為零的 4-byte 組可縮寫成
          <code class="font-mono">z</code>,慣例以 <code class="font-mono">&lt;~ ... ~&gt;</code> 包裹。
        </li>
        <li>
          <strong>Z85</strong> 是 ZeroMQ(RFC 32)採用的版本,字元集挑過、對放進程式原始碼或 JSON 更友善
          (常用於傳遞金鑰);輸入長度須為 4 的倍數。
        </li>
        <li>解碼出的若是純文字會直接顯示,否則請看「十六進位」。全程在你瀏覽器計算,<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>

<style scoped>
.b85-input {
  width: 100%;
  margin-top: 0.25rem;
  border: 1px solid var(--color-ink-200, #e2e8f0);
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
  font-size: 0.9rem;
  resize: vertical;
  word-break: break-all;
}
</style>
