<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { analyzeHeaders, type HeaderResult, type Severity } from '@/features/emailHeader'

/*
  郵件來源檢視 / 防冒名 —— 貼上一封可疑信件的「完整郵件原始碼/標頭」,
  解析寄件者、回覆地址、退信來源與 SPF/DKIM/DMARC 驗證,比對網域是否對得上,
  標出冒名詐騙常見破綻。全程在你瀏覽器以純函式判讀、不上傳信件內容。
*/
const raw = ref('')
const result = ref<HeaderResult | null>(null)

function run() {
  result.value = raw.value.trim() ? analyzeHeaders(raw.value) : null
}
function clear() {
  raw.value = ''
  result.value = null
}

const sevMeta: Record<Severity, { cls: string; icon: string; label: string }> = {
  danger: { cls: 'border-rose-300 bg-rose-50 text-rose-800', icon: '🚨', label: '高風險' },
  warn: { cls: 'border-amber-300 bg-amber-50 text-amber-800', icon: '⚠️', label: '注意' },
  info: { cls: 'border-line bg-stone-50 text-ink-700', icon: 'ℹ️', label: '參考' },
}

const topSeverity = computed<Severity | null>(() => {
  if (!result.value) return null
  if (result.value.warnings.some((w) => w.severity === 'danger')) return 'danger'
  if (result.value.warnings.some((w) => w.severity === 'warn')) return 'warn'
  return 'info'
})

const sample = [
  'From: "service@bank.com.tw" <secure@bank-tw-verify.com>',
  'Reply-To: support@bank-tw-verify.com',
  'Return-Path: <bounce@mailgun.spam-host.ru>',
  'To: you@example.com',
  'Subject: 【台灣銀行】您的帳戶異常,請立即驗證',
  'Authentication-Results: mx.google.com; spf=fail; dkim=none; dmarc=fail',
  '',
  '親愛的客戶您好,您的帳戶有異常登入...',
].join('\n')

function fillSample() {
  raw.value = sample
  run()
}

function fieldLine(a: { display: string; address: string } | null): string {
  if (!a) return '(無)'
  return a.display ? `${a.display} <${a.address}>` : a.address
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">貼上完整的「郵件原始碼 / 標頭」</label>
        <textarea
          v-model="raw"
          rows="9"
          placeholder="在 Gmail 點信件右上「⋮」→「顯示原始郵件」;Outlook 開信件→「檔案」→「內容」→網際網路標頭,整段貼上即可。"
          class="field-input resize-none font-mono text-sm"
        ></textarea>
        <p class="field-hint">
          只需上半部的標頭(到第一個空行為止)即可判讀。全程在你瀏覽器內解析、<strong>不上傳</strong>。
        </p>
      </div>
      <div class="flex flex-wrap gap-3">
        <button class="btn-primary" :disabled="!raw.trim()" @click="run">檢視來源</button>
        <button class="inline-flex items-center rounded-xl border border-line bg-white px-5 py-3 font-medium text-ink-700 hover:bg-stone-50" @click="fillSample">看範例(冒名信)</button>
        <button v-if="raw" class="inline-flex items-center rounded-xl border border-line bg-white px-5 py-3 font-medium text-ink-700 hover:bg-stone-50" @click="clear">清空</button>
      </div>
    </div>

    <template v-if="result">
      <div
        v-if="topSeverity"
        class="card p-5 border-2"
        :class="sevMeta[topSeverity].cls"
      >
        <div class="flex items-center gap-2 font-semibold">
          <span class="text-xl">{{ sevMeta[topSeverity].icon }}</span>
          <span v-if="topSeverity === 'danger'">發現高風險特徵,請特別小心</span>
          <span v-else-if="topSeverity === 'warn'">有需要留意的地方</span>
          <span v-else>未發現明顯破綻(仍請謹慎)</span>
        </div>
      </div>

      <div class="card p-6 space-y-3">
        <h3 class="font-semibold text-ink-800">解析結果</h3>
        <dl class="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[7rem_1fr]">
          <dt class="text-ink-500">寄件者 From</dt>
          <dd class="break-all font-mono text-ink-800">{{ fieldLine(result.from) }}</dd>
          <template v-if="result.replyTo">
            <dt class="text-ink-500">回覆 Reply-To</dt>
            <dd class="break-all font-mono text-ink-800">{{ fieldLine(result.replyTo) }}</dd>
          </template>
          <template v-if="result.returnPath">
            <dt class="text-ink-500">退信 Return-Path</dt>
            <dd class="break-all font-mono text-ink-800">{{ fieldLine(result.returnPath) }}</dd>
          </template>
          <template v-if="result.subject">
            <dt class="text-ink-500">主旨</dt>
            <dd class="break-all text-ink-800">{{ result.subject }}</dd>
          </template>
          <template v-if="result.auth.spf || result.auth.dkim || result.auth.dmarc">
            <dt class="text-ink-500">驗證結果</dt>
            <dd class="font-mono text-ink-800">
              <span v-if="result.auth.spf">SPF={{ result.auth.spf }} </span>
              <span v-if="result.auth.dkim">DKIM={{ result.auth.dkim }} </span>
              <span v-if="result.auth.dmarc">DMARC={{ result.auth.dmarc }}</span>
            </dd>
          </template>
        </dl>
      </div>

      <div class="card p-6 space-y-3">
        <h3 class="font-semibold text-ink-800">提醒 ({{ result.warnings.length }})</h3>
        <div
          v-for="(wn, i) in result.warnings"
          :key="i"
          class="flex items-start gap-3 rounded-xl border p-3 text-sm leading-relaxed"
          :class="sevMeta[wn.severity].cls"
        >
          <span>{{ sevMeta[wn.severity].icon }}</span>
          <span>{{ wn.text }}</span>
        </div>
      </div>
    </template>

    <LegalNote title="怎麼用、注意什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>怎麼取得標頭</strong>:Gmail 開信→右上「⋮」→「顯示原始郵件」;Outlook 開信→「檔案/⋯」→「內容」看「網際網路標頭」,整段複製貼上。</li>
        <li><strong>看什麼</strong>:寄件網域和你認識的官方是否一致、按「回覆」會不會跑到別的網域、SPF/DKIM/DMARC 是否通過。網域對不上或驗證失敗,是釣魚信常見破綻。</li>
        <li><strong>重要</strong>:標頭可被偽冒,本工具是輔助判讀與教育,<strong>不是「是否詐騙」的保證</strong>;通過檢查也別大意。可疑信一律別點連結、別給帳密、別匯款,改用官方電話或 165 反詐騙專線查證。全程不上傳。</li>
      </ul>
    </LegalNote>
  </div>
</template>
