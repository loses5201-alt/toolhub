<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parseSetCookie, parseCookieHeader } from '@/features/cookieParse'

/*
  Cookie / Set-Cookie 解析器 —— 把 cookie 標頭拆成結構化欄位,並附安全性提醒。
  全程在你的瀏覽器解析,不連網、不上傳。
*/

const mode = ref<'set' | 'request'>('set')
const input = ref(
  'sessionId=abc123; Domain=example.com; Path=/; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Secure; HttpOnly; SameSite=Lax',
)

const setResult = computed(() => (mode.value === 'set' ? parseSetCookie(input.value) : null))
const reqResult = computed(() => (mode.value === 'request' ? parseCookieHeader(input.value) : []))

const attrRows = computed(() => {
  const r = setResult.value
  if (!r) return []
  return Object.entries(r.attributes).map(([k, v]) => ({
    key: k,
    value: v === true ? '✓(旗標)' : String(v),
  }))
})
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 flex flex-wrap gap-2">
      <button
        type="button"
        class="rounded-lg border px-3 py-1.5 text-sm"
        :class="mode === 'set' ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600 hover:bg-ink-50'"
        @click="mode = 'set'"
      >
        Set-Cookie(回應)
      </button>
      <button
        type="button"
        class="rounded-lg border px-3 py-1.5 text-sm"
        :class="mode === 'request' ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600 hover:bg-ink-50'"
        @click="mode = 'request'"
      >
        Cookie(請求)
      </button>
    </div>

    <div class="card p-5">
      <label class="block text-sm">
        <span class="text-ink-500">{{ mode === 'set' ? '貼上 Set-Cookie 標頭' : '貼上 Cookie 標頭' }}</span>
        <textarea v-model="input" rows="3" class="ck-input font-mono" spellcheck="false" />
      </label>
    </div>

    <!-- Set-Cookie 結果 -->
    <template v-if="mode === 'set'">
      <template v-if="setResult">
        <div class="card p-5 grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <span class="text-ink-500">名稱</span>
            <div class="font-mono text-ink-800 break-all">{{ setResult.name }}</div>
          </div>
          <div>
            <span class="text-ink-500">值</span>
            <div class="font-mono text-ink-800 break-all">{{ setResult.value || '(空)' }}</div>
          </div>
        </div>

        <div v-if="attrRows.length" class="card p-5 space-y-2">
          <span class="text-sm font-semibold text-ink-700">屬性</span>
          <table class="w-full text-sm">
            <tbody>
              <tr v-for="row in attrRows" :key="row.key" class="border-b border-ink-100 last:border-0">
                <td class="py-1.5 pr-4 font-mono text-ink-500">{{ row.key }}</td>
                <td class="py-1.5 font-mono text-ink-800 break-all">{{ row.value }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="card p-5 space-y-1 text-sm">
          <span class="font-semibold text-ink-700">存活時間</span>
          <p class="text-ink-700">{{ setResult.expiresInfo }}</p>
        </div>

        <div v-if="setResult.warnings.length" class="card p-5 space-y-2">
          <span class="text-sm font-semibold text-amber-700">安全性提醒</span>
          <ul class="space-y-1.5 text-sm text-amber-700">
            <li v-for="(w, i) in setResult.warnings" :key="i">⚠️ {{ w }}</li>
          </ul>
        </div>
        <p v-else class="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">✓ 安全屬性齊全(Secure / HttpOnly / SameSite)。</p>
      </template>
      <p v-else class="card p-5 text-sm text-ink-500">請貼上有效的 Set-Cookie 標頭。</p>
    </template>

    <!-- 請求 Cookie 結果 -->
    <template v-else>
      <div v-if="reqResult.length" class="card p-5 space-y-2">
        <span class="text-sm font-semibold text-ink-700">{{ reqResult.length }} 組 cookie</span>
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-ink-400">
              <th class="py-1.5 pr-4 font-medium">名稱</th>
              <th class="py-1.5 font-medium">值</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(c, i) in reqResult" :key="i" class="border-b border-ink-100 last:border-0">
              <td class="py-1.5 pr-4 font-mono text-ink-700">{{ c.name }}</td>
              <td class="py-1.5 font-mono text-ink-800 break-all">{{ c.value || '(空)' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="card p-5 text-sm text-ink-500">請貼上有效的 Cookie 標頭(name=value; …)。</p>
    </template>

    <LegalNote>
      Set-Cookie 是伺服器設定 cookie 的回應標頭;Cookie 是瀏覽器送回的請求標頭。
      <strong>HttpOnly</strong> 防 JavaScript 讀取(抗 XSS 竊取);<strong>Secure</strong> 只在 HTTPS 傳送;
      <strong>SameSite</strong> 控制跨站送出(<code>None</code> 必須配 <code>Secure</code>)。
      未設 Expires/Max-Age 即為關閉瀏覽器就失效的 session cookie。全程在你的瀏覽器解析,不連網、不上傳。
    </LegalNote>
  </div>
</template>

<style scoped>
.ck-input {
  width: 100%;
  margin-top: 0.25rem;
  border: 1px solid var(--color-ink-200, #e2e8f0);
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
  font-size: 0.875rem;
  line-height: 1.5;
  resize: vertical;
}
</style>
