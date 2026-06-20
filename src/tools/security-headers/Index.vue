<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { analyzeSecurityHeaders } from '@/features/securityHeaders'

/*
  HTTP 安全標頭稽核 —— 貼上回應標頭,逐項檢查安全防護並給總評分。
  全程在你的瀏覽器離線判讀,不連網、不上傳。
*/

const input = ref(
  [
    'HTTP/2 200',
    'content-type: text/html; charset=utf-8',
    'strict-transport-security: max-age=63072000; includeSubDomains',
    "content-security-policy: default-src 'self'; script-src 'self' 'unsafe-inline'",
    'x-content-type-options: nosniff',
    'referrer-policy: no-referrer-when-downgrade',
    'server: nginx/1.18.0',
  ].join('\n'),
)

const result = computed(() => analyzeSecurityHeaders(input.value))

const gradeColor = computed(() => {
  const g = result.value.grade
  if (g === 'A+' || g === 'A') return 'text-emerald-600 border-emerald-300 bg-emerald-50'
  if (g === 'B' || g === 'C') return 'text-amber-600 border-amber-300 bg-amber-50'
  return 'text-rose-600 border-rose-300 bg-rose-50'
})

const statusMeta: Record<string, { icon: string; cls: string }> = {
  good: { icon: '✓', cls: 'text-emerald-600' },
  warn: { icon: '!', cls: 'text-amber-600' },
  bad: { icon: '✕', cls: 'text-rose-600' },
  info: { icon: 'ℹ', cls: 'text-ink-400' },
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-5">
      <label class="block text-sm">
        <span class="text-ink-500">貼上 HTTP 回應標頭(curl -I 網址,或 DevTools → Network → Response Headers)</span>
        <textarea v-model="input" rows="9" class="sh-input font-mono" spellcheck="false" />
      </label>
    </div>

    <!-- 評分 -->
    <div class="card p-5 flex items-center gap-5">
      <div class="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-2 text-3xl font-bold" :class="gradeColor">
        {{ result.grade }}
      </div>
      <div class="flex-1">
        <div class="text-sm text-ink-500">安全標頭評分</div>
        <div class="text-2xl font-bold text-ink-800">{{ result.score }}<span class="text-base font-normal text-ink-400"> / 100</span></div>
        <div class="mt-2 h-2 w-full rounded-full bg-ink-100 overflow-hidden">
          <div
            class="h-full rounded-full transition-all"
            :class="result.score >= 85 ? 'bg-emerald-500' : result.score >= 55 ? 'bg-amber-500' : 'bg-rose-500'"
            :style="{ width: result.score + '%' }"
          />
        </div>
      </div>
    </div>

    <!-- 逐項結果 -->
    <div class="card p-5 space-y-3">
      <h3 class="text-sm font-semibold text-ink-700">逐項檢查</h3>
      <ul class="space-y-3">
        <li v-for="fd in result.findings" :key="fd.id" class="flex gap-3">
          <span class="mt-0.5 shrink-0 font-bold w-5 text-center" :class="statusMeta[fd.status].cls">
            {{ statusMeta[fd.status].icon }}
          </span>
          <div class="min-w-0">
            <div class="text-sm font-medium text-ink-800">{{ fd.title }}</div>
            <div class="text-sm text-ink-600">{{ fd.message }}</div>
            <div v-if="fd.value" class="mt-0.5 truncate font-mono text-xs text-ink-400" :title="fd.value">
              {{ fd.header }}: {{ fd.value }}
            </div>
          </div>
        </li>
      </ul>
    </div>

    <LegalNote>
      安全標頭是伺服器回應裡用來保護使用者的防護設定。
      <strong>HSTS</strong> 強制 HTTPS、<strong>CSP</strong> 防 XSS 與注入、
      <strong>X-Content-Type-Options: nosniff</strong> 防 MIME 嗅探、
      <strong>X-Frame-Options / frame-ancestors</strong> 防點擊劫持、
      <strong>Referrer-Policy</strong> 控制來源外洩、<strong>Permissions-Policy</strong> 限制裝置功能。
      本工具的評分為啟發式參考,實際安全還取決於 CSP 的具體內容與整體架構;
      全程在你的瀏覽器離線判讀,不連網、不上傳。
    </LegalNote>
  </div>
</template>

<style scoped>
.sh-input {
  width: 100%;
  margin-top: 0.25rem;
  border: 1px solid var(--color-ink-200, #e2e8f0);
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
  font-size: 0.8125rem;
  line-height: 1.55;
  resize: vertical;
}
</style>
