<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parseProtoInput, decodeProto, type ProtoNode } from '@/features/protobuf'
import ProtoTree from './ProtoTree.vue'

/*
  Protobuf 二進位解碼器 —— 貼上 hex / base64 的 protobuf 位元組(沒有 .proto schema 也行),
  依 wire format 拆成「欄位編號 + wire type + 值」的結構樹,等同 protoc --decode_raw。
  全程在你瀏覽器解析,不連網、不上傳。
*/
const raw = ref('')

// 範例:{ 1: 150, 2: "testing", 3: { 1: 150 } } 的 protobuf 編碼
const SAMPLE = '08 96 01 12 07 74 65 73 74 69 6e 67 1a 03 08 96 01'

const result = computed<{ format: string; nodes: ProtoNode[]; byteLen: number; error?: string; parsed: boolean }>(() => {
  if (!raw.value.trim()) return { format: '', nodes: [], byteLen: 0, parsed: false }
  const input = parseProtoInput(raw.value)
  if (!input.bytes) return { format: input.format, nodes: [], byteLen: 0, error: input.error, parsed: true }
  const decoded = decodeProto(input.bytes)
  return { format: input.format, nodes: decoded.nodes, byteLen: input.bytes.length, error: decoded.error, parsed: true }
})
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-3">
      <div>
        <label class="field-label">貼上 protobuf 位元組(hex 或 base64)</label>
        <textarea
          v-model="raw"
          rows="6"
          class="field-input font-mono text-sm"
          placeholder="08 96 01 12 07 74 65 73 74 …&#10;&#10;或 base64:CJYBEgd0ZXN0aW5n…"
          spellcheck="false"
        ></textarea>
        <p class="field-hint">支援空白分隔的 hex、0x 前綴,或 base64 / base64url。不需要 .proto 定義。全程在你瀏覽器解析,內容不上傳。</p>
      </div>
      <button type="button" class="text-sm text-brand-700 hover:underline" @click="raw = SAMPLE">
        載入範例(含巢狀訊息)
      </button>
    </div>

    <div v-if="result.parsed && result.error && !result.nodes.length" class="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-sm text-rose-700">
      ⚠️ {{ result.error }}
    </div>

    <div v-if="result.nodes.length" class="card p-5 space-y-3">
      <div class="flex flex-wrap items-center gap-2 text-sm">
        <span class="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-700">{{ result.format }}</span>
        <span class="text-ink-500">{{ result.byteLen }} 位元組</span>
        <span class="text-ink-400 text-xs">#欄位編號 · wire type · 值</span>
      </div>
      <div v-if="result.error" class="rounded-lg border border-amber-200 bg-amber-50/60 p-2 text-xs text-amber-800">
        ⚠️ 解析中止:{{ result.error }}(以下為已成功解析的部分)
      </div>
      <div class="overflow-x-auto">
        <ProtoTree :nodes="result.nodes" :depth="0" />
      </div>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>把沒有 <code>.proto</code> schema 的 <strong>Protobuf 二進位</strong>(從 gRPC 抓包、log、檔案來的),依 wire format 拆成「<strong>欄位編號 + wire type + 值</strong>」的結構樹 —— 等同 <code>protoc --decode_raw</code>,免裝 protoc。</li>
        <li>四種 wire type 都解:<strong>varint</strong>(同時給有號 / zigzag / bool 詮釋)、<strong>64-bit</strong>(uint64 / int64 / double)、<strong>length-delimited</strong>(自動嘗試解成巢狀訊息,否則當字串 / bytes)、<strong>32-bit</strong>(uint32 / int32 / float)。</li>
        <li>沒有 schema 時欄位是字串還是巢狀訊息本來就有歧義;遇到可同時解讀的情況會<strong>兩種都列給你</strong>判斷。</li>
        <li>抓包資料常含 token、個資,線上解碼器卻要你貼到別人的伺服器 —— 本工具<strong>全程在你瀏覽器解析,不連網、不上傳</strong>。需要更底層的 TLV 結構請用「ASN.1 / DER 解碼器」。</li>
      </ul>
    </LegalNote>
  </div>
</template>
