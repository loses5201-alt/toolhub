<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  base32Decode,
  totp,
  parseOtpauth,
  type HashAlgo,
} from '@/features/totp'

/*
  TOTP 兩步驟驗證碼產生器 —— 輸入 base32 密鑰或 otpauth:// 連結,
  在本機算出當下的 6 位數驗證碼與倒數秒數(RFC 6238)。
  ⚠️ 你的 2FA 密鑰是高度敏感資訊,絕不該貼到一般網站。本工具全程在你的瀏覽器計算,不連網、不上傳。
*/

const secret = ref('')
const digits = ref(6)
const period = ref(30)
const algo = ref<HashAlgo>('SHA-1')
const label = ref('')

const code = ref('')
const remaining = ref(0)
const error = ref('')

const keyBytes = computed(() => base32Decode(secret.value))

// 貼上 otpauth:// 連結時自動帶入參數
function onSecretInput() {
  const v = secret.value.trim()
  if (/^otpauth:\/\//i.test(v)) {
    const p = parseOtpauth(v)
    if (p.ok && p.secret) {
      secret.value = p.secret
      digits.value = p.digits
      period.value = p.period
      algo.value = p.algo
      label.value = [p.issuer, p.label].filter(Boolean).join(' · ')
    } else {
      error.value = p.error || 'otpauth 連結無法解析。'
    }
  }
}

async function refresh() {
  const key = keyBytes.value
  if (secret.value.trim() === '') {
    code.value = ''
    error.value = ''
    return
  }
  if (key === null) {
    error.value = '密鑰不是有效的 base32(只接受 A–Z 與 2–7)。'
    code.value = ''
    return
  }
  if (key.length === 0) {
    error.value = '密鑰為空。'
    code.value = ''
    return
  }
  error.value = ''
  try {
    const now = Math.floor(Date.now() / 1000)
    const r = await totp(key, now, {
      step: period.value,
      digits: digits.value,
      algo: algo.value,
    })
    code.value = r.code
    remaining.value = r.remaining
  } catch {
    error.value = '計算失敗(此瀏覽器可能不支援 Web Crypto)。'
    code.value = ''
  }
}

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  refresh()
  timer = setInterval(refresh, 1000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})
watch([secret, digits, period, algo], refresh)

const spaced = computed(() => {
  // 6 位 → "123 456",8 位 → "1234 5678"
  const c = code.value
  if (c.length === 6) return c.slice(0, 3) + ' ' + c.slice(3)
  if (c.length === 8) return c.slice(0, 4) + ' ' + c.slice(4)
  return c
})

async function copyCode() {
  if (!code.value) return
  try {
    await navigator.clipboard.writeText(code.value)
  } catch {
    /* 忽略 */
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">密鑰(base32)或 otpauth:// 連結</label>
        <input
          v-model="secret"
          class="field-input font-mono"
          placeholder="JBSWY3DPEHPK3PXP 或 otpauth://totp/..."
          spellcheck="false"
          autocomplete="off"
          @input="onSecretInput"
        />
        <p class="field-hint">
          就是設定 2FA 時顯示的那串「設定金鑰 / setup key」。
          <strong class="text-amber-700">請只在你信任的裝置上使用,別把密鑰貼到陌生網站。</strong>
        </p>
      </div>

      <div class="flex flex-wrap gap-4 text-sm text-ink-600">
        <label class="flex items-center gap-1.5">
          位數
          <select v-model.number="digits" class="rounded-lg border border-ink-200 px-2 py-1">
            <option :value="6">6</option>
            <option :value="7">7</option>
            <option :value="8">8</option>
          </select>
        </label>
        <label class="flex items-center gap-1.5">
          週期(秒)
          <select v-model.number="period" class="rounded-lg border border-ink-200 px-2 py-1">
            <option :value="30">30</option>
            <option :value="60">60</option>
          </select>
        </label>
        <label class="flex items-center gap-1.5">
          演算法
          <select v-model="algo" class="rounded-lg border border-ink-200 px-2 py-1">
            <option value="SHA-1">SHA-1</option>
            <option value="SHA-256">SHA-256</option>
            <option value="SHA-512">SHA-512</option>
          </select>
        </label>
      </div>
    </div>

    <div v-if="error" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
      ⚠️ {{ error }}
    </div>

    <div v-else-if="code" class="card p-6 text-center space-y-3">
      <p v-if="label" class="text-sm text-ink-500">{{ label }}</p>
      <button
        type="button"
        class="block w-full font-mono text-5xl font-bold tracking-widest text-ink-800 transition hover:text-brand-700"
        title="點一下複製"
        @click="copyCode"
      >
        {{ spaced }}
      </button>
      <div class="mx-auto h-2 w-full max-w-xs overflow-hidden rounded-full bg-ink-100">
        <div
          class="h-full rounded-full transition-all duration-1000 ease-linear"
          :class="remaining <= 5 ? 'bg-red-500' : 'bg-brand-500'"
          :style="{ width: (remaining / period) * 100 + '%' }"
        ></div>
      </div>
      <p class="text-sm text-ink-400">{{ remaining }} 秒後更新 · 點數字可複製</p>
    </div>

    <LegalNote title="這個工具能、不能做什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>能</strong>:輸入 2FA 設定金鑰(base32)或 <code>otpauth://</code> 連結,在本機算出當下的一次性驗證碼 —— 等同 Google Authenticator / Authy 的功能(RFC 6238 TOTP)。</li>
        <li><strong>能</strong>:臨時在電腦上登入需要 2FA 的帳號(手機不在身邊時)、或核對驗證器是否設定正確。</li>
        <li><strong>注意安全</strong>:密鑰能算出驗證碼就等於「第二把鑰匙」。<strong>請只在自己信任的裝置上使用,別存進公用電腦,也別把密鑰貼到任何網站</strong>。本工具<strong>不連網、不上傳、不儲存</strong>,關掉分頁就清空。</li>
        <li><strong>注意</strong>:驗證碼依你裝置的時間計算,<strong>時間不準會算錯</strong>;請確認系統時間正確(自動校時)。</li>
        <li>長期使用仍建議搭配專用驗證器 App 或硬體金鑰,並妥善保存備援碼。</li>
      </ul>
    </LegalNote>
  </div>
</template>
