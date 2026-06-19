<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import { hmacHex, hmacBase64, safeEqualHex, type HmacAlgo } from '@/features/hmacText'

/*
  HMAC / Webhook 簽章驗證 —— 用一把密鑰對訊息算 HMAC,驗證 webhook 來源
  (GitHub X-Hub-Signature-256、Stripe、LINE 等)。全程在你的瀏覽器,密鑰與內容不上傳。
*/

const message = ref('')
const secret = ref('')
const algo = ref<HmacAlgo>('SHA-256')

const hex = ref('')
const base64 = ref('')

const compareTo = ref('')

async function compute() {
  if (secret.value === '' && message.value === '') {
    hex.value = ''
    base64.value = ''
    return
  }
  try {
    hex.value = await hmacHex(message.value, secret.value, algo.value)
    base64.value = await hmacBase64(message.value, secret.value, algo.value)
  } catch {
    hex.value = ''
    base64.value = ''
  }
}

watch([message, secret, algo], compute, { immediate: false })

// 比對:支援帶 "sha256=" 前綴(GitHub 格式)的簽章
function normalizeSig(s: string): string {
  return s.trim().replace(/^sha(1|256|512)=/i, '')
}
const matchResult = ref<null | boolean>(null)
watch([compareTo, hex], () => {
  if (compareTo.value.trim() === '' || hex.value === '') {
    matchResult.value = null
    return
  }
  matchResult.value = safeEqualHex(normalizeSig(compareTo.value), hex.value)
})

async function copy(text: string) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* 忽略 */
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">訊息內容(payload)</label>
        <textarea
          v-model="message"
          rows="5"
          class="field-input font-mono text-xs leading-relaxed"
          placeholder="貼上原始請求內容(raw body),例如 webhook 的 JSON"
          spellcheck="false"
        ></textarea>
      </div>
      <div>
        <label class="field-label">密鑰(secret)</label>
        <input
          v-model="secret"
          class="field-input font-mono"
          placeholder="簽章用的共享密鑰"
          spellcheck="false"
          autocomplete="off"
        />
      </div>
      <div class="flex flex-wrap items-center gap-2 text-sm text-ink-600">
        <span>演算法</span>
        <button
          v-for="a in (['SHA-1', 'SHA-256', 'SHA-512'] as HmacAlgo[])"
          :key="a"
          type="button"
          class="rounded-lg border px-3 py-1 transition"
          :class="
            algo === a
              ? 'border-brand-500 bg-brand-600 text-white'
              : 'border-ink-200 text-ink-600 hover:bg-ink-50'
          "
          @click="algo = a"
        >
          {{ a }}
        </button>
      </div>
    </div>

    <div v-if="hex" class="card p-6 space-y-2">
      <button
        type="button"
        class="block w-full rounded-lg bg-ink-50 px-3 py-2 text-left transition hover:bg-ink-100"
        title="點一下複製"
        @click="copy(hex)"
      >
        <div class="text-xs font-semibold text-ink-400">HMAC({{ algo }}) · 十六進位</div>
        <div class="break-all font-mono text-sm text-ink-800">{{ hex }}</div>
      </button>
      <button
        type="button"
        class="block w-full rounded-lg bg-ink-50 px-3 py-2 text-left transition hover:bg-ink-100"
        title="點一下複製"
        @click="copy(base64)"
      >
        <div class="text-xs font-semibold text-ink-400">Base64</div>
        <div class="break-all font-mono text-sm text-ink-800">{{ base64 }}</div>
      </button>
    </div>

    <div class="card p-6 space-y-3">
      <div>
        <label class="field-label">驗證:貼上收到的簽章來比對</label>
        <input
          v-model="compareTo"
          class="field-input font-mono text-sm"
          placeholder="例如 sha256=abcd... 或純十六進位"
          spellcheck="false"
          autocomplete="off"
        />
        <p class="field-hint">可直接貼帶 <code>sha256=</code> 前綴的值(GitHub 格式),會自動忽略前綴。</p>
      </div>
      <div
        v-if="matchResult !== null"
        class="rounded-xl border p-3 text-sm font-semibold"
        :class="matchResult ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800' : 'border-red-200 bg-red-50/70 text-red-800'"
      >
        {{ matchResult ? '✅ 簽章相符 —— 來源與內容可信' : '❌ 簽章不符 —— 內容可能被竄改或密鑰/演算法不對' }}
      </div>
    </div>

    <div class="text-sm text-ink-500">
      只是要算<strong>一般雜湊值</strong>(無密鑰)?用
      <RouterLink to="/tools/text-hash" class="font-semibold text-brand-700 underline hover:text-brand-800">
        文字雜湊值
      </RouterLink>
      。
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>驗證 <strong>webhook</strong> 是不是真的來自服務方:把收到的 raw body 加上你的密鑰算 HMAC,和對方標頭裡的簽章比對(GitHub <code>X-Hub-Signature-256</code>、Stripe、LINE Messaging API 等)。</li>
        <li>同時輸出<strong>十六進位</strong>與 <strong>Base64</strong>,比對時用<strong>定時比較</strong>避免時序側通道。</li>
        <li><strong>HMAC 與一般雜湊不同</strong>:它需要一把共享密鑰,沒有密鑰就算不出、也偽造不了,因此能證明來源。</li>
        <li>比對欄可直接貼帶 <code>sha256=</code> 前綴的值,會自動處理。</li>
        <li>全程<strong>在你的瀏覽器</strong>用 Web Crypto 計算,密鑰與內容<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
