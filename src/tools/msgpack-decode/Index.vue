<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parseMsgpackInput, decodeMsgpack, type MsgpackNode } from '@/features/msgpack'
import MsgpackTree from './MsgpackTree.vue'

/*
  MessagePack 解碼器 —— 貼上 hex / base64 的 MessagePack 位元組,依官方 spec 拆成可讀的結構樹。
  Redis、msgpack-rpc、許多 API 用 MessagePack;全程在你瀏覽器解析,不連網、不上傳。
*/
const raw = ref('')

// 範例:{"a":1,"b":[2,3]} 的 MessagePack 編碼
const SAMPLE = '82 a1 61 01 a1 62 92 02 03'

const result = computed<{ format: string; items: MsgpackNode[]; byteLen: number; error?: string; parsed: boolean }>(() => {
  if (!raw.value.trim()) return { format: '', items: [], byteLen: 0, parsed: false }
  const input = parseMsgpackInput(raw.value)
  if (!input.bytes) return { format: input.format, items: [], byteLen: 0, error: input.error, parsed: true }
  const decoded = decodeMsgpack(input.bytes)
  return { format: input.format, items: decoded.items, byteLen: input.bytes.length, error: decoded.error, parsed: true }
})
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-3">
      <div>
        <label class="field-label">貼上 MessagePack 位元組(hex 或 base64)</label>
        <textarea
          v-model="raw"
          rows="6"
          class="field-input font-mono text-sm"
          placeholder="82 a1 61 01 a1 62 92 02 03&#10;&#10;或 base64:gqFhAaFiggID"
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
        <span v-if="result.items.length > 1" class="text-ink-400 text-xs">{{ result.items.length }} 個串接物件</span>
      </div>
      <div v-if="result.error" class="rounded-lg border border-amber-200 bg-amber-50/60 p-2 text-xs text-amber-800">
        ⚠️ 解析中止:{{ result.error }}(以下為已成功解析的部分)
      </div>
      <div class="overflow-x-auto">
        <MsgpackTree :nodes="result.items" :depth="0" />
      </div>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>把 <strong>MessagePack</strong> 二進位(比 JSON 更小、更快的序列化格式)拆成看得懂的結構樹 —— 整數、float、字串、bin、陣列、map 一層層攤開。</li>
        <li>除錯 <strong>Redis</strong>、<strong>msgpack-rpc</strong>、遊戲 / IoT 即時通訊與許多用 MessagePack 的 API 時很常用;支援全部格式族、64 位元整數(BigInt 不失真)與 <strong>timestamp 擴充</strong>(自動換成可讀時間)。</li>
        <li>封包資料常含 token、個資,線上解碼器卻要你貼到別人的伺服器 —— 本工具<strong>全程在你瀏覽器解析,不連網、不上傳</strong>。</li>
        <li>需要 CBOR 請用「CBOR 解碼器」、Protobuf 用「Protobuf 二進位解碼器」、憑證 DER 用「ASN.1 / DER 解碼器」。</li>
      </ul>
    </LegalNote>
  </div>
</template>
