<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  decodeJwt,
  tokenStatus,
  REGISTERED_CLAIMS,
  isTimeClaim,
  formatUnix,
  verifyHmac,
  type VerifyResult,
} from '@/features/jwt'

/*
  JWT 解碼 / 檢視 —— 把 JSON Web Token 解開成標頭與內容,整理 exp/iat/nbf 等時間宣告、
  判斷是否已過期,並可在本機用密鑰驗證 HMAC 簽章。
  全程在你的瀏覽器:把「真的」存取權杖貼到 jwt.io 等線上網站,等於把可登入系統的憑證交給第三方;這支不上傳。
*/
const SAMPLE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYzMjU0MjJ9.' +
  'sLh0_kRY97Yqd7m6E9zL9OQ2y7gd0lFkz0i3hHmkQbE'

const input = ref(SAMPLE)
const result = computed(() => decodeJwt(input.value))
const status = computed(() => (result.value.ok ? tokenStatus(result.value.payload) : null))

// payload 內的各宣告整理成列(時間宣告附人類可讀時間)
interface Row {
  key: string
  label: string
  value: string
  time?: { local: string; utc: string } | null
}
const claimRows = computed<Row[]>(() => {
  if (!result.value.ok || !result.value.payload) return []
  return Object.entries(result.value.payload).map(([key, val]) => {
    const time = isTimeClaim(key) && typeof val === 'number' ? formatUnix(val) : undefined
    return {
      key,
      label: REGISTERED_CLAIMS[key] ?? key,
      value: typeof val === 'object' ? JSON.stringify(val) : String(val),
      time,
    }
  })
})

// --- 簽章驗證 ---
const secret = ref('')
const verifyState = ref<VerifyResult | null>(null)
const verifying = ref(false)
async function doVerify() {
  verifying.value = true
  try {
    verifyState.value = await verifyHmac(input.value, secret.value)
  } catch {
    verifyState.value = { supported: false, error: '驗證時發生錯誤。' }
  } finally {
    verifying.value = false
  }
}
// token 改變就清掉舊的驗證結果,避免誤導
watch([input, secret], () => (verifyState.value = null))

function clearAll() {
  input.value = ''
  secret.value = ''
}

const statusStyle = computed(() => {
  switch (status.value?.state) {
    case 'valid':
      return 'border-emerald-200 bg-emerald-50/70 text-emerald-800'
    case 'expired':
      return 'border-red-200 bg-red-50/70 text-red-800'
    case 'not-yet':
      return 'border-amber-200 bg-amber-50/70 text-amber-800'
    default:
      return 'border-ink-200 bg-ink-50 text-ink-600'
  }
})
const statusIcon = computed(() => {
  switch (status.value?.state) {
    case 'valid':
      return '✅'
    case 'expired':
      return '⛔'
    case 'not-yet':
      return '⏳'
    default:
      return 'ℹ️'
  }
})
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-3">
      <div class="flex items-center gap-3">
        <label class="field-label mb-0">貼上 JWT</label>
        <button type="button" class="ml-auto text-xs text-ink-400 underline hover:text-ink-600" @click="input = SAMPLE">
          載入範例
        </button>
        <button type="button" class="text-xs text-ink-400 underline hover:text-ink-600" @click="clearAll">清空</button>
      </div>
      <textarea
        v-model="input"
        rows="6"
        class="field-input font-mono text-xs leading-relaxed break-all"
        spellcheck="false"
        placeholder="eyJhbGciOi...（可含 Bearer 前綴）"
      />
      <p class="field-hint">
        全程在你的瀏覽器解碼,<strong>不連網、不上傳</strong>。內容(payload)只是 Base64 編碼、<strong>並非加密</strong>,任何人都能讀;
        真正保護是靠簽章,請勿把機密放進 payload。
      </p>
    </div>

    <div v-if="!result.ok" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
      ⚠️ {{ result.error }}
    </div>

    <template v-else>
      <!-- 有效期狀態 -->
      <div v-if="status" class="rounded-xl border p-4" :class="statusStyle">
        <span class="text-base font-semibold">{{ statusIcon }} {{ status.message }}</span>
      </div>

      <!-- 標頭 -->
      <div class="card p-5 space-y-2">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-ink-700">標頭 Header</span>
          <span v-if="result.alg" class="rounded-md bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
            alg: {{ result.alg }}
          </span>
          <span v-if="result.typ" class="rounded-md bg-ink-100 px-2 py-0.5 text-xs text-ink-600">typ: {{ result.typ }}</span>
        </div>
        <pre class="overflow-x-auto rounded-lg bg-ink-900 p-3 text-xs leading-relaxed text-ink-50"><code>{{ result.headerJson }}</code></pre>
      </div>

      <!-- 內容宣告表 -->
      <div class="card p-5 space-y-3">
        <span class="text-sm font-semibold text-ink-700">內容 Payload</span>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <tbody>
              <tr v-for="row in claimRows" :key="row.key" class="border-b border-ink-100 last:border-0 align-top">
                <td class="py-2 pr-4 whitespace-nowrap font-mono text-ink-500">{{ row.key }}</td>
                <td class="py-2 pr-4 whitespace-nowrap text-xs text-ink-400">{{ row.label !== row.key ? row.label : '' }}</td>
                <td class="py-2 break-all text-ink-800">
                  {{ row.value }}
                  <div v-if="row.time" class="mt-0.5 text-xs text-brand-700">
                    🕒 {{ row.time.local }}　<span class="text-ink-400">({{ row.time.utc }})</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <details class="text-xs">
          <summary class="cursor-pointer text-ink-400 hover:text-ink-600">看原始 JSON</summary>
          <pre class="mt-2 overflow-x-auto rounded-lg bg-ink-900 p-3 leading-relaxed text-ink-50"><code>{{ result.payloadJson }}</code></pre>
        </details>
      </div>

      <!-- 簽章驗證 -->
      <div class="card p-5 space-y-3">
        <span class="text-sm font-semibold text-ink-700">驗證簽章(HMAC)</span>
        <p class="text-xs text-ink-500">
          若是 HS256/384/512 簽發,輸入當初的密鑰(secret)即可在本機核對簽章是否相符 —— 確認 Token 沒被竄改、確實由持有密鑰者簽發。
        </p>
        <div class="flex flex-wrap items-end gap-3">
          <div class="flex-1 min-w-[200px]">
            <label class="field-label">密鑰 secret</label>
            <input v-model="secret" class="field-input font-mono" placeholder="your-256-bit-secret" spellcheck="false" />
          </div>
          <button type="button" class="btn-primary" :disabled="verifying" @click="doVerify">
            {{ verifying ? '驗證中…' : '驗證' }}
          </button>
        </div>
        <div
          v-if="verifyState && verifyState.valid === true"
          class="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-sm font-semibold text-emerald-800"
        >
          ✅ 簽章正確 —— 此 Token 確實由這把密鑰簽發,內容未遭竄改。
        </div>
        <div
          v-else-if="verifyState && verifyState.valid === false"
          class="rounded-lg border border-red-200 bg-red-50/70 p-3 text-sm font-semibold text-red-800"
        >
          ⛔ 簽章不符 —— 密鑰錯誤,或 Token 已被竄改。
        </div>
        <div
          v-else-if="verifyState && verifyState.error"
          class="rounded-lg border border-ink-200 bg-ink-50 p-3 text-sm text-ink-600"
        >
          ℹ️ {{ verifyState.error }}
        </div>
      </div>
    </template>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>把 <strong>JWT</strong>(常見於登入 token、API 授權、OAuth)解開,看清楚 alg、發行者、主體與各項宣告。</li>
        <li>自動把 <code>exp</code> / <code>iat</code> / <code>nbf</code> 這些 Unix 時間翻成可讀時間,並直接判斷<strong>是否已過期或尚未生效</strong>。</li>
        <li>可用密鑰在<strong>本機驗證 HMAC(HS256/384/512)簽章</strong>;RS/ES 等非對稱簽章需要公鑰,此工具不處理。</li>
        <li>
          重點安全提醒:JWT 的 payload <strong>只是 Base64 編碼、不是加密</strong>,任何人都讀得到 ——
          很多人卻把<strong>正式環境的 token 貼進線上解碼網站</strong>,等於把可登入的憑證送給對方。
          本工具<strong>不連網、不上傳</strong>,token 與密鑰只留在你的瀏覽器。
        </li>
      </ul>
    </LegalNote>
  </div>
</template>
