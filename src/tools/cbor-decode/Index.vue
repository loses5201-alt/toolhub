<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parseCborInput, decodeCbor, type CborNode } from '@/features/cbor'
import CborTree from './CborTree.vue'

/*
  CBOR 解碼器 —— 貼上 hex / base64 的 CBOR 位元組,依 RFC 8949 拆成可讀的結構樹。
  WebAuthn / passkey 認證、COSE、CTAP、IoT 常用 CBOR;全程在你瀏覽器解析,不連網、不上傳。
*/
const raw = ref('')

// 範例:{"a":1,"b":[2,3]} 的 CBOR 編碼
const SAMPLE = 'a2 61 61 01 61 62 82 02 03'

const result = computed<{ format: string; items: CborNode[]; byteLen: number; error?: string; parsed: boolean }>(() => {
  if (!raw.value.trim()) return { format: '', items: [], byteLen: 0, parsed: false }
  const input = parseCborInput(raw.value)
  if (!input.bytes) return { format: input.format, items: [], byteLen: 0, error: input.error, parsed: true }
  const decoded = decodeCbor(input.bytes)
  return { format: input.format, items: decoded.items, byteLen: input.bytes.length, error: decoded.error, parsed: true }
})
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-3">
      <div>
        <label class="field-label">貼上 CBOR 位元組(hex 或 base64)</label>
        <textarea
          v-model="raw"
          rows="6"
          class="field-input font-mono text-sm"
          placeholder="a2 61 61 01 61 62 82 02 03&#10;&#10;或 base64:omFhAWFiggID"
          spellcheck="false"
        ></textarea>
        <p class="field-hint">支援空白分隔的 hex、0x 前綴,或 base64 / base64url。全程在你瀏覽器解析,內容不上傳。</p>
      </div>
      <button type="button" class="text-sm text-brand-700 hover:underline" @click="raw = SAMPLE">
        載入範例(含巢狀陣列的 map)
      </button>
    </div>

    <div v-if="result.parsed && result.error && !result.items.length" class="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-sm text-rose-700">
      ⚠️ {{ result.error }}
    </div>

    <div v-if="result.items.length" class="card p-5 space-y-3">
      <div class="flex flex-wrap items-center gap-2 text-sm">
        <span class="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-700">{{ result.format }}</span>
        <span class="text-ink-500">{{ result.byteLen }} 位元組</span>
        <span v-if="result.items.length > 1" class="text-ink-400 text-xs">CBOR 序列:{{ result.items.length }} 個頂層項目</span>
      </div>
      <div v-if="result.error" class="rounded-lg border border-amber-200 bg-amber-50/60 p-2 text-xs text-amber-800">
        ⚠️ 解析中止:{{ result.error }}(以下為已成功解析的部分)
      </div>
      <div class="overflow-x-auto">
        <CborTree :nodes="result.items" :depth="0" />
      </div>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>把 <strong>CBOR</strong>(Concise Binary Object Representation,RFC 8949)二進位拆成看得懂的結構樹 —— 整數、byte / text 字串、陣列、map、標籤(tag)、浮點與布林 / null 一層層攤開。</li>
        <li>處理 <strong>WebAuthn / passkey 認證資料</strong>、<strong>COSE</strong> 簽章金鑰、<strong>CTAP</strong> 指令、<strong>IoT</strong> 訊息時最常遇到 CBOR;支援定長與不定長字串 / 陣列 / map、float16/32/64,well-known 標籤會標上名稱,bignum(tag 2/3)還原成整數。</li>
        <li>這些資料常含憑證、金鑰、個資,線上解碼器卻要你貼到別人的伺服器 —— 本工具<strong>全程在你瀏覽器解析,不連網、不上傳</strong>。</li>
        <li>需要 Protobuf 請用「Protobuf 二進位解碼器」、憑證 DER 用「ASN.1 / DER 解碼器」。</li>
      </ul>
    </LegalNote>
  </div>
</template>
