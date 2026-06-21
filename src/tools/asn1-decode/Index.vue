<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parseDerInput, decodeDer, type Asn1Node } from '@/features/asn1'
import Asn1Tree from './Asn1Tree.vue'

/*
  ASN.1 / DER 解碼器 —— 貼上 PEM / base64 / hex 的 DER 編碼(X.509 憑證、公私鑰、CSR…),
  解析成可讀的 TLV 結構樹,並對常見 OID 標上名稱。全程在你瀏覽器解析,不連網、不上傳。
*/
const raw = ref('')

const SAMPLE = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA11qYAYKxCrfVS/7TyWQHOg7hcvPapiMlrwIaaPcHURo=
-----END PUBLIC KEY-----`

const result = computed<{ format: string; nodes: Asn1Node[]; byteLen: number; error?: string; parsed: boolean }>(() => {
  if (!raw.value.trim()) return { format: '', nodes: [], byteLen: 0, parsed: false }
  const input = parseDerInput(raw.value)
  if (!input.bytes) return { format: input.format, nodes: [], byteLen: 0, error: input.error, parsed: true }
  const decoded = decodeDer(input.bytes)
  return { format: input.format, nodes: decoded.nodes, byteLen: input.bytes.length, error: decoded.error, parsed: true }
})
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-3">
      <div>
        <label class="field-label">貼上 PEM / base64 / hex(DER 編碼)</label>
        <textarea
          v-model="raw"
          rows="7"
          class="field-input font-mono text-sm"
          placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----&#10;&#10;或直接貼 base64 / hex"
          spellcheck="false"
        ></textarea>
        <p class="field-hint">支援 .pem / .crt / .cer / .key / .csr 內容,或純 base64、hex。全程在你瀏覽器解析,憑證與金鑰不上傳。</p>
      </div>
      <button type="button" class="text-sm text-brand-700 hover:underline" @click="raw = SAMPLE">
        載入範例(Ed25519 公鑰)
      </button>
    </div>

    <div v-if="result.parsed && result.error && !result.nodes.length" class="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-sm text-rose-700">
      ⚠️ {{ result.error }}
    </div>

    <div v-if="result.nodes.length" class="card p-5 space-y-3">
      <div class="flex flex-wrap items-center gap-2 text-sm">
        <span class="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-700">{{ result.format }}</span>
        <span class="text-ink-500">{{ result.byteLen }} 位元組 DER</span>
      </div>
      <div v-if="result.error" class="rounded-lg border border-amber-200 bg-amber-50/60 p-2 text-xs text-amber-800">
        ⚠️ 解析中止:{{ result.error }}(以下為已成功解析的部分)
      </div>
      <div class="overflow-x-auto">
        <Asn1Tree :nodes="result.nodes" :depth="0" />
      </div>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>把 <code>.pem</code> / <code>.crt</code> / <code>.key</code> / <code>.csr</code> 這類 <strong>DER 編碼</strong>(PEM 是它的 base64 包裝)拆解成看得懂的 <strong>ASN.1 結構樹</strong> —— SEQUENCE、INTEGER、OID、BIT STRING…一層層攤開。</li>
        <li>常見 <strong>OID 自動標名稱</strong>:簽章演算法(sha256WithRSAEncryption)、公鑰型別(rsaEncryption、ecPublicKey、Ed25519)、憑證欄位(commonName、organizationName)、擴充(subjectAltName、keyUsage)等。</li>
        <li>BIT STRING / OCTET STRING 內若包著 DER(如公鑰、憑證擴充),會自動再往內解一層。</li>
        <li>憑證與金鑰是高度敏感資料,線上解碼器卻常要你貼到別人的伺服器 —— 本工具<strong>全程在你瀏覽器解析,不連網、不上傳</strong>。支援 DER 標準長度;遇到 BER 不定長度會明確標示。</li>
      </ul>
    </LegalNote>
  </div>
</template>
