<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parseUA } from '@/features/uaParser'

/*
  User-Agent 解析器 —— 貼上 UA 字串,拆出瀏覽器 / 版本 / 引擎 / 作業系統 / 裝置類型。
  看 server log、分析流量、debug 相容性時很常用。全程在你的瀏覽器,不連網、不上傳。
*/
const input = ref(navigator.userAgent || '')

const result = computed(() => parseUA(input.value))

function useMine() {
  input.value = navigator.userAgent || ''
}

const deviceLabel: Record<string, string> = {
  desktop: '🖥️ 桌機',
  mobile: '📱 手機',
  tablet: '📲 平板',
  bot: '🤖 爬蟲 / 機器人',
  unknown: '❓ 無法判斷',
}

const rows = computed(() => {
  const r = result.value
  const fmt = (name: string, version: string) =>
    name ? (version ? `${name} ${version}` : name) : '—'
  return [
    { label: '瀏覽器', value: fmt(r.browser, r.browserVersion) },
    { label: '排版引擎', value: fmt(r.engine, r.engineVersion) },
    { label: '作業系統', value: fmt(r.os, r.osVersion) },
    { label: '裝置類型', value: deviceLabel[r.deviceType] || r.deviceType },
  ]
})

const examples: { name: string; ua: string }[] = [
  {
    name: 'Chrome / Windows',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
  {
    name: 'Safari / iPhone',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
  },
  {
    name: 'Chrome / Android',
    ua: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  },
  {
    name: 'Googlebot',
    ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  },
]
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <div class="flex items-center gap-3">
          <label class="field-label mb-0">User-Agent 字串</label>
          <button class="ml-auto text-sm text-brand-700 underline hover:text-brand-800" @click="useMine">
            帶入我的瀏覽器
          </button>
        </div>
        <textarea
          v-model="input"
          rows="4"
          class="field-input font-mono text-xs leading-relaxed mt-2"
          spellcheck="false"
          placeholder="貼上 User-Agent 字串…"
        />
        <p class="field-hint">可從 server log、瀏覽器開發者工具的 Network 標頭取得。全程在你的瀏覽器處理,不上傳。</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="ex in examples"
          :key="ex.name"
          class="rounded-lg border border-ink-200 bg-ink-50/60 px-3 py-1.5 text-xs text-ink-700 hover:bg-ink-100"
          @click="input = ex.ua"
        >
          {{ ex.name }}
        </button>
      </div>
    </div>

    <div v-if="input.trim()" class="card p-4">
      <div v-if="result.isBot" class="mb-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
        🤖 這看起來是<strong>爬蟲、機器人或程式發出的請求</strong>(非一般使用者瀏覽器)。
      </div>
      <dl class="divide-y divide-ink-100">
        <div v-for="row in rows" :key="row.label" class="flex items-center gap-4 py-3">
          <dt class="w-28 shrink-0 text-sm font-semibold text-ink-600">{{ row.label }}</dt>
          <dd class="text-base text-ink-900 font-medium">{{ row.value }}</dd>
        </div>
      </dl>
    </div>

    <LegalNote title="關於 User-Agent 解析">
      <ul class="list-disc pl-5 space-y-1">
        <li>UA 字串充滿歷史包袱:幾乎每家瀏覽器都含 <code>Mozilla/5.0</code>,Chrome 也含 <code>Safari</code> 與 <code>AppleWebKit</code>,所以解析靠的是<strong>比對順序與啟發式規則</strong>,結果為合理推斷,不保證 100%(尤其偽造或極罕見的 UA)。</li>
        <li>iOS 上所有瀏覽器(含 Chrome、Firefox、Edge)都被系統強制使用 <strong>WebKit</strong> 引擎,所以引擎會顯示 WebKit 而非 Blink/Gecko。</li>
        <li>Windows <code>10.0</code> 同時對應 Windows 10 與 11(UA 無法區分);macOS 因隱私考量近年常停在 <code>10.15.7</code>。</li>
        <li>UA 可被任意竄改,<strong>不應</strong>單憑它做安全判斷;此工具僅供分析與除錯參考。</li>
        <li>全程在你的瀏覽器計算,<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
