<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { signJwt, applyTimeClaims, type SignAlg, type TimeClaimOptions } from '@/features/jwt'

/*
  JWT 簽發 / 產生 —— 在本機用密鑰簽出 HS256/384/512 的 JSON Web Token,
  測 API、做後端對接、重現某個過期情境時很好用。可自動補 iat / exp / nbf 時間宣告。
  全程在你的瀏覽器:把密鑰貼進 jwt.io 等線上產生器,等於把能偽造憑證的鑰匙交給第三方;這支不連網、不上傳。
*/
const SAMPLE = `{
  "sub": "1234567890",
  "name": "John Doe",
  "role": "admin"
}`

const algs: SignAlg[] = ['HS256', 'HS384', 'HS512']
const alg = ref<SignAlg>('HS256')
const payloadText = ref(SAMPLE)
const secret = ref('your-256-bit-secret')

// 時間宣告選項
const addIat = ref(true)
const addExp = ref(true)
const expValue = ref(1)
const expUnit = ref<'min' | 'hour' | 'day'>('hour')
const addNbf = ref(false)

const UNIT_SECONDS: Record<'min' | 'hour' | 'day', number> = { min: 60, hour: 3600, day: 86400 }

// 解析使用者輸入的 payload,套上時間宣告後得到「實際會簽進去」的內容
const parsed = computed<
  { ok: true; payload: Record<string, unknown>; preview: string } | { ok: false; error: string }
>(() => {
  const raw = payloadText.value.trim()
  if (!raw) return { ok: false, error: '請輸入 payload(JSON 物件)。' }
  let obj: unknown
  try {
    obj = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'payload 不是有效的 JSON。' }
  }
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return { ok: false, error: 'payload 必須是 JSON 物件(以 { } 包起來)。' }
  }
  const opts: TimeClaimOptions = {
    iat: addIat.value,
    nbf: addNbf.value,
    expSeconds: addExp.value ? Math.max(1, Math.floor(expValue.value)) * UNIT_SECONDS[expUnit.value] : undefined,
  }
  const full = applyTimeClaims(obj as Record<string, unknown>, opts)
  return { ok: true, payload: full, preview: JSON.stringify(full, null, 2) }
})

const token = ref('')
const signing = ref(false)
const signError = ref('')
const copied = ref(false)

async function generate() {
  if (!parsed.value.ok) return
  if (!secret.value) {
    signError.value = '請輸入用來簽章的密鑰(secret)。'
    return
  }
  signing.value = true
  signError.value = ''
  try {
    token.value = await signJwt(parsed.value.payload, secret.value, alg.value)
  } catch (err) {
    signError.value = err instanceof Error ? err.message : '簽發時發生錯誤。'
    token.value = ''
  } finally {
    signing.value = false
  }
}

// 任一輸入變動就讓舊 token 失效,避免誤以為是最新結果
watch([payloadText, secret, alg, addIat, addExp, expValue, expUnit, addNbf], () => {
  token.value = ''
  signError.value = ''
})

async function copyToken() {
  if (!token.value) return
  try {
    await navigator.clipboard.writeText(token.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    /* 忽略剪貼簿失敗 */
  }
}

// 把 token 三段以不同顏色標示(header.payload.signature)
const tokenParts = computed(() => token.value.split('.'))
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <!-- 演算法 -->
      <div>
        <label class="field-label">簽章演算法</label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="a in algs"
            :key="a"
            type="button"
            class="rounded-lg border px-3 py-1.5 text-sm font-semibold transition"
            :class="alg === a ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-500 hover:border-ink-300'"
            @click="alg = a"
          >
            {{ a }}
          </button>
        </div>
        <p class="field-hint">HS256/384/512 都是用同一把密鑰簽與驗(對稱式),最常見。</p>
      </div>

      <!-- payload -->
      <div>
        <div class="flex items-center gap-3">
          <label class="field-label mb-0">內容 Payload(JSON 物件)</label>
          <button type="button" class="ml-auto text-xs text-ink-400 underline hover:text-ink-600" @click="payloadText = SAMPLE">
            載入範例
          </button>
        </div>
        <textarea
          v-model="payloadText"
          rows="6"
          class="field-input mt-1 font-mono text-xs leading-relaxed"
          spellcheck="false"
          placeholder='{ "sub": "user-123" }'
        />
      </div>

      <!-- 時間宣告 -->
      <div class="rounded-xl border border-ink-200 bg-ink-50/60 p-4 space-y-2">
        <p class="text-sm font-semibold text-ink-700">自動補時間宣告(可選)</p>
        <label class="flex items-center gap-2 text-sm text-ink-700">
          <input v-model="addIat" type="checkbox" class="size-4" />
          加入簽發時間 <code>iat</code>(現在)
        </label>
        <label class="flex flex-wrap items-center gap-2 text-sm text-ink-700">
          <input v-model="addExp" type="checkbox" class="size-4" />
          設定到期 <code>exp</code> ——
          <input
            v-model.number="expValue"
            type="number"
            min="1"
            class="field-input w-20 py-1 text-sm"
            :disabled="!addExp"
          />
          <select v-model="expUnit" class="field-input w-auto py-1 text-sm" :disabled="!addExp">
            <option value="min">分鐘後</option>
            <option value="hour">小時後</option>
            <option value="day">天後</option>
          </select>
        </label>
        <label class="flex items-center gap-2 text-sm text-ink-700">
          <input v-model="addNbf" type="checkbox" class="size-4" />
          加入生效時間 <code>nbf</code>(現在)
        </label>
      </div>

      <!-- 密鑰 -->
      <div>
        <label class="field-label">密鑰 secret</label>
        <input v-model="secret" class="field-input font-mono" placeholder="your-256-bit-secret" spellcheck="false" />
        <p class="field-hint">
          密鑰只留在你的瀏覽器、<strong>不連網、不上傳</strong>。任何人拿到這把密鑰都能偽造 token,務必妥善保管。
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <button type="button" class="btn-primary" :disabled="!parsed.ok || signing" @click="generate">
          {{ signing ? '簽發中…' : '簽發 JWT' }}
        </button>
        <span v-if="!parsed.ok" class="text-sm text-amber-700">⚠️ {{ parsed.error }}</span>
      </div>
    </div>

    <!-- 將實際簽入的內容預覽(含補上的時間宣告) -->
    <div v-if="parsed.ok" class="card p-5 space-y-2">
      <span class="text-sm font-semibold text-ink-700">實際簽入的內容</span>
      <pre class="overflow-x-auto rounded-lg bg-ink-900 p-3 text-xs leading-relaxed text-ink-50"><code>{{ parsed.preview }}</code></pre>
    </div>

    <!-- 結果 -->
    <div v-if="signError" class="rounded-xl border border-red-200 bg-red-50/60 p-3 text-sm text-red-800">
      ⛔ {{ signError }}
    </div>

    <div v-if="token" class="card p-5 space-y-3">
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-ink-700">簽發結果 Token</span>
        <button type="button" class="ml-auto text-sm text-brand-700 underline hover:text-brand-800" @click="copyToken">
          {{ copied ? '已複製 ✓' : '複製' }}
        </button>
      </div>
      <p class="overflow-x-auto rounded-lg bg-ink-900 p-3 font-mono text-xs leading-relaxed break-all">
        <span class="text-rose-300">{{ tokenParts[0] }}</span><span class="text-ink-500">.</span><span
          class="text-emerald-300"
          >{{ tokenParts[1] }}</span
        ><span class="text-ink-500">.</span><span class="text-sky-300">{{ tokenParts[2] }}</span>
      </p>
      <p class="text-xs text-ink-400">
        <span class="text-rose-400">■</span> 標頭　<span class="text-emerald-400">■</span> 內容　<span class="text-sky-400">■</span> 簽章。
        可貼到「JWT 解碼 / 檢視」工具驗證。
      </p>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>在本機<strong>簽發 JWT</strong>(HS256/384/512),測試 API 授權、後端串接、或重現「token 過期/尚未生效」情境。</li>
        <li>可一鍵自動補上 <code>iat</code>(簽發時間)、<code>exp</code>(到期)、<code>nbf</code>(生效時間)等時間宣告,免自己換算 Unix 秒數。</li>
        <li>產出的 token 與「JWT 解碼 / 檢視」工具互通 —— 簽發後可貼過去用同一把密鑰驗證。</li>
        <li>
          安全重點:簽發 JWT 需要<strong>密鑰</strong>,持有者即可偽造任何身分的憑證 ——
          線上產生器會看到你的密鑰,等於拱手交出系統鑰匙。本工具<strong>不連網、不上傳</strong>,密鑰只留在你的瀏覽器。
          僅支援對稱式 HMAC;RS/ES 等非對稱簽發需要私鑰與更完整的金鑰管理,不在此提供。
        </li>
      </ul>
    </LegalNote>
  </div>
</template>
