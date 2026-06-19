<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  utf8ToBytes,
  bytesToUtf8,
  bytesToHex,
  hexToBytes,
  base32Encode,
  base32Decode,
  base58Encode,
  base58Decode,
} from '@/features/baseEncode'

/*
  Base32 / Base58 編解碼 —— 位元組串(文字或 hex)與 Base32(RFC 4648)/ Base58(Bitcoin)互轉。
  與 base-convert(數字進位)不同,這支處理「位元組」編碼。全程在你的瀏覽器,不連網、不上傳。
*/

const scheme = ref<'base32' | 'base58'>('base32')
const direction = ref<'encode' | 'decode'>('encode')
const inputType = ref<'text' | 'hex'>('text')
const input = ref('foobar')

const result = computed(() => {
  const s = input.value
  try {
    if (direction.value === 'encode') {
      const bytes = inputType.value === 'hex' ? hexToBytes(s) : utf8ToBytes(s)
      if (bytes === null) return { ok: false, msg: 'hex 格式不正確(需偶數個 0-9a-f)' }
      const text = scheme.value === 'base32' ? base32Encode(bytes) : base58Encode(bytes)
      return { ok: true, text }
    } else {
      const bytes = scheme.value === 'base32' ? base32Decode(s) : base58Decode(s)
      if (bytes === null) return { ok: false, msg: `不是合法的 ${scheme.value} 字串` }
      return {
        ok: true,
        text: inputType.value === 'hex' ? bytesToHex(bytes) : bytesToUtf8(bytes),
        hex: bytesToHex(bytes),
      }
    }
  } catch {
    return { ok: false, msg: '處理失敗' }
  }
})

const copied = ref(false)
function copy() {
  if (!result.value.ok || !result.value.text) return
  navigator.clipboard?.writeText(result.value.text)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

function swap() {
  if (result.value.ok && result.value.text != null) {
    input.value = result.value.text
    direction.value = direction.value === 'encode' ? 'decode' : 'encode'
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-5 space-y-4">
      <div class="flex flex-wrap gap-4">
        <div class="flex rounded-lg border border-ink-200 p-0.5 text-sm">
          <button type="button" class="rounded-md px-3 py-1" :class="scheme === 'base32' ? 'bg-brand-500 text-white' : 'text-ink-600'" @click="scheme = 'base32'">Base32</button>
          <button type="button" class="rounded-md px-3 py-1" :class="scheme === 'base58' ? 'bg-brand-500 text-white' : 'text-ink-600'" @click="scheme = 'base58'">Base58</button>
        </div>
        <div class="flex rounded-lg border border-ink-200 p-0.5 text-sm">
          <button type="button" class="rounded-md px-3 py-1" :class="direction === 'encode' ? 'bg-ink-700 text-white' : 'text-ink-600'" @click="direction = 'encode'">編碼</button>
          <button type="button" class="rounded-md px-3 py-1" :class="direction === 'decode' ? 'bg-ink-700 text-white' : 'text-ink-600'" @click="direction = 'decode'">解碼</button>
        </div>
        <div class="flex rounded-lg border border-ink-200 p-0.5 text-sm">
          <button type="button" class="rounded-md px-3 py-1" :class="inputType === 'text' ? 'bg-ink-700 text-white' : 'text-ink-600'" @click="inputType = 'text'">文字</button>
          <button type="button" class="rounded-md px-3 py-1" :class="inputType === 'hex' ? 'bg-ink-700 text-white' : 'text-ink-600'" @click="inputType = 'hex'">Hex</button>
        </div>
      </div>

      <label class="block text-sm">
        <span class="text-ink-500">
          {{ direction === 'encode' ? `輸入(${inputType === 'hex' ? 'hex 位元組' : '文字'})` : `輸入(${scheme} 字串)` }}
        </span>
        <textarea v-model="input" rows="3" class="be-input font-mono" spellcheck="false" />
      </label>
    </div>

    <div v-if="!result.ok" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
      ⚠️ {{ result.msg }}
    </div>
    <div v-else class="card p-5 space-y-2">
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-ink-700">結果</span>
        <button type="button" class="ml-auto rounded-lg border border-ink-200 px-3 py-1 text-xs text-ink-600 hover:bg-ink-50" @click="swap">⇄ 把結果當輸入</button>
        <button type="button" class="rounded-lg border border-ink-200 px-3 py-1 text-xs text-ink-600 hover:bg-ink-50" @click="copy">{{ copied ? '已複製' : '複製' }}</button>
      </div>
      <pre class="whitespace-pre-wrap break-all font-mono text-sm text-ink-800">{{ result.text }}</pre>
      <p v-if="direction === 'decode' && inputType === 'text' && result.hex" class="text-xs text-ink-400">
        hex:<code class="font-mono">{{ result.hex }}</code>
      </p>
    </div>

    <LegalNote>
      Base32 採 RFC 4648 字母表(A–Z、2–7,以 <code>=</code> 補位),常見於 TOTP 兩步驟驗證金鑰、檔名安全字串;
      解碼大小寫不敏感、容忍空白。Base58 採 Bitcoin/IPFS 字母表(去掉易混淆的 <code>0 O I l</code>),
      常用於錢包位址、IPFS CID,前導零位元組會編成 <code>1</code>。這是位元組編碼,與「進位轉換器」(數字 2–36 進位)不同。
      全程在你的瀏覽器計算,不連網、不上傳。
    </LegalNote>
  </div>
</template>

<style scoped>
.be-input {
  width: 100%;
  margin-top: 0.25rem;
  border: 1px solid var(--color-ink-200, #e2e8f0);
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
  font-size: 0.875rem;
  line-height: 1.5;
  resize: vertical;
}
</style>
