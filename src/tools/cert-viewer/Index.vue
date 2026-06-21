<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parseDerInput } from '@/features/asn1'
import { parseCertificate, type CertInfo } from '@/features/x509'

/*
  X.509 憑證檢視器 —— 貼上 PEM / base64 / hex 的憑證,翻成白話欄位:主體 / 簽發者、有效期(到期判斷)、
  公鑰、SAN、各擴充,並算 SHA-256 指紋。全程在你瀏覽器解析,憑證不連網、不上傳。
*/
const raw = ref('')
const fingerprint = ref('')

const SAMPLE = `-----BEGIN CERTIFICATE-----
MIICBTCCAaugAwIBAgICEjQwCgYIKoZIzj0EAwIwPjELMAkGA1UEBhMCVFcxFTAT
BgNVBAoMDFRvb2xIdWIgVGVzdDEYMBYGA1UEAwwPdG9vbGh1Yi5leGFtcGxlMB4X
DTI2MDYyMTExMzcwOFoXDTM2MDYxODExMzcwOFowPjELMAkGA1UEBhMCVFcxFTAT
BgNVBAoMDFRvb2xIdWIgVGVzdDEYMBYGA1UEAwwPdG9vbGh1Yi5leGFtcGxlMFkw
EwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEOgRR2JDFMVqg1g3qSEHjIrmV6gJhGnPM
6x5FEKSnB5n0OJKvHQd3qcVKmd5bXUI51hi4hlpbb4n7FdkcuSJFs6OBmDCBlTAd
BgNVHQ4EFgQUXPk8E3ejm4l359/qlJ17xpqPD5EwHwYDVR0jBBgwFoAUXPk8E3ej
m4l359/qlJ17xpqPD5EwDwYDVR0TAQH/BAUwAwEB/zBCBgNVHREEOzA5gg90b29s
aHViLmV4YW1wbGWCE3d3dy50b29saHViLmV4YW1wbGWBEWFAdG9vbGh1Yi5leGFt
cGxlMAoGCCqGSM49BAMCA0gAMEUCIQC4QQcfbRPOkdGm/uDp8XIKwOkDA+eDbma8
Huuo2XhtDAIgG9+M4Q4Vu1kTgz1FQLu9cOUQAW6HX4ELK7lz5YNoYA4=
-----END CERTIFICATE-----`

const result = computed<{ cert: CertInfo | null; error?: string; parsed: boolean }>(() => {
  if (!raw.value.trim()) return { cert: null, parsed: false }
  const input = parseDerInput(raw.value)
  if (!input.bytes) return { cert: null, error: input.error, parsed: true }
  const cert = parseCertificate(input.bytes)
  return { cert, error: cert.error, parsed: true }
})

watch(raw, async () => {
  fingerprint.value = ''
  const input = parseDerInput(raw.value)
  if (!input.bytes || !globalThis.crypto?.subtle) return
  try {
    const buf = await crypto.subtle.digest('SHA-256', input.bytes as BufferSource)
    fingerprint.value = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join(':')
  } catch { /* 略過 */ }
})

const now = Date.now()
const validity = computed(() => {
  const c = result.value.cert
  if (!c || isNaN(c.notBeforeMs) || isNaN(c.notAfterMs)) return null
  if (now < c.notBeforeMs) return { state: 'future', text: '尚未生效', cls: 'amber' }
  if (now > c.notAfterMs) return { state: 'expired', text: '已過期', cls: 'rose' }
  const days = Math.floor((c.notAfterMs - now) / 86400000)
  return { state: 'valid', text: `有效 · 還有 ${days} 天到期`, cls: days < 30 ? 'amber' : 'emerald' }
})

const badgeCls: Record<string, string> = {
  rose: 'bg-rose-100 text-rose-700',
  amber: 'bg-amber-100 text-amber-800',
  emerald: 'bg-emerald-100 text-emerald-700',
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-3">
      <div>
        <label class="field-label">貼上憑證(PEM / base64 / hex)</label>
        <textarea
          v-model="raw"
          rows="7"
          class="field-input font-mono text-sm"
          placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
          spellcheck="false"
        ></textarea>
        <p class="field-hint">支援 .pem / .crt / .cer 內容。全程在你瀏覽器解析,憑證不上傳。</p>
      </div>
      <button type="button" class="text-sm text-brand-700 hover:underline" @click="raw = SAMPLE">載入範例憑證</button>
    </div>

    <div v-if="result.parsed && result.error && !result.cert?.subject.text" class="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-sm text-rose-700">
      ⚠️ {{ result.error }}
    </div>

    <template v-if="result.cert && result.cert.subject.text">
      <div class="card p-5 space-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <span v-if="validity" class="rounded-full px-3 py-0.5 text-xs font-semibold" :class="badgeCls[validity.cls]">{{ validity.text }}</span>
          <span v-if="result.cert.selfSigned" class="rounded-full bg-ink-100 px-3 py-0.5 text-xs font-semibold text-ink-600">自簽憑證</span>
          <span class="rounded-full bg-brand-100 px-3 py-0.5 text-xs font-semibold text-brand-700">v{{ result.cert.version }}</span>
        </div>
        <dl class="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
          <dt class="text-ink-400">主體 (Subject)</dt>
          <dd class="font-medium text-ink-800 break-all">{{ result.cert.subject.text }}</dd>
          <dt class="text-ink-400">簽發者 (Issuer)</dt>
          <dd class="text-ink-700 break-all">{{ result.cert.issuer.text }}</dd>
          <dt class="text-ink-400">有效期自</dt>
          <dd class="text-ink-700">{{ result.cert.notBefore }}</dd>
          <dt class="text-ink-400">有效期至</dt>
          <dd class="text-ink-700">{{ result.cert.notAfter }}</dd>
          <dt class="text-ink-400">公鑰</dt>
          <dd class="text-ink-700">{{ result.cert.publicKeyAlgorithm }}<span v-if="result.cert.publicKeyDetail"> · {{ result.cert.publicKeyDetail }}</span></dd>
          <dt class="text-ink-400">簽章演算法</dt>
          <dd class="text-ink-700">{{ result.cert.signatureAlgorithm }}</dd>
          <dt class="text-ink-400">序號</dt>
          <dd class="font-mono text-xs text-ink-700 break-all">{{ result.cert.serialHex }}</dd>
        </dl>
      </div>

      <div v-if="result.cert.sans.length" class="card p-5 space-y-2">
        <h3 class="text-sm font-semibold text-ink-700">Subject Alternative Name(此憑證適用的網域 / 主機)</h3>
        <ul class="flex flex-wrap gap-2">
          <li v-for="(s, i) in result.cert.sans" :key="i" class="rounded-lg bg-ink-50 px-2.5 py-1 font-mono text-xs text-ink-700">{{ s }}</li>
        </ul>
      </div>

      <div v-if="fingerprint" class="card p-5 space-y-1">
        <h3 class="text-sm font-semibold text-ink-700">SHA-256 指紋</h3>
        <p class="break-all font-mono text-xs text-ink-600">{{ fingerprint }}</p>
        <p class="text-xs text-ink-400">用來核對「這張憑證是不是你以為的那張」—— 與對方公布的指紋逐字比對。</p>
      </div>

      <div v-if="result.cert.extensions.length" class="card p-5 space-y-2">
        <h3 class="text-sm font-semibold text-ink-700">擴充 (Extensions)</h3>
        <ul class="space-y-1.5 text-sm">
          <li v-for="(e, i) in result.cert.extensions" :key="i" class="flex flex-wrap items-baseline gap-x-2">
            <span class="font-medium text-ink-800">{{ e.name }}</span>
            <span v-if="e.critical" class="rounded bg-rose-50 px-1.5 text-[10px] font-semibold text-rose-600">critical</span>
            <span v-if="e.detail" class="text-ink-600 break-all">{{ e.detail }}</span>
          </li>
        </ul>
      </div>
    </template>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>把 SSL/TLS 憑證(<code>.pem</code> / <code>.crt</code> / <code>.cer</code>)翻成白話 —— <strong>發給誰、誰簽的、什麼時候到期、適用哪些網域(SAN)、用什麼演算法</strong>,一眼看完。</li>
        <li>自動標示<strong>到期狀態</strong>(已過期 / 快到期 / 還有幾天),換憑證前先確認;並算 <strong>SHA-256 指紋</strong>供核對。</li>
        <li>需要更底層的 ASN.1 結構,用「ASN.1 / DER 解碼器」;這支聚焦在憑證欄位的白話解讀。</li>
        <li>憑證雖是公開資料,但線上解析器常一併要你貼私鑰或內部憑證 —— 本工具<strong>全程在你瀏覽器解析,不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
