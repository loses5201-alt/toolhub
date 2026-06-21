<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parsePlistText, parsePlistBytes, plistToJson, type PlistNode } from '@/features/plist'
import PlistTree from './PlistTree.vue'

/*
  Apple plist 檢視器 —— 開啟 .plist 檔(二進位 bplist00 或 XML),拆成可讀的結構樹,
  並一鍵轉乾淨 JSON。iOS / macOS App 設定、iCloud 備份、NSKeyedArchiver 封存常用。
  全程在你瀏覽器解析,不連網、不上傳。
*/
const raw = ref('')
const fileResult = ref<{ root: PlistNode | null; format: string; error?: string } | null>(null)
const fileName = ref('')
const view = ref<'tree' | 'json'>('tree')
const copied = ref(false)

// 範例:XML plist
const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>我的 App</string>
  <key>CFBundleVersion</key>
  <string>3.2.1</string>
  <key>LSMinimumSystemVersion</key>
  <real>14.0</real>
  <key>UILaunchCount</key>
  <integer>128</integer>
  <key>FirstRun</key>
  <false/>
  <key>Devices</key>
  <array>
    <string>iPhone</string>
    <string>iPad</string>
  </array>
</dict>
</plist>`

const result = computed<{ root: PlistNode | null; format: string; error?: string; parsed: boolean }>(() => {
  if (fileResult.value) return { ...fileResult.value, parsed: true }
  if (!raw.value.trim()) return { root: null, format: '', parsed: false }
  const r = parsePlistText(raw.value)
  return { ...r, parsed: true }
})

async function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  fileName.value = f.name
  raw.value = ''
  const buf = await f.arrayBuffer()
  fileResult.value = parsePlistBytes(new Uint8Array(buf))
}

function clearFile() {
  fileResult.value = null
  fileName.value = ''
}

function onPaste() {
  fileResult.value = null
  fileName.value = ''
}

// BigInt 安全的 JSON 序列化(超出安全整數範圍以字串表示)
const jsonText = computed(() => {
  if (!result.value.root) return ''
  const replacer = (_k: string, v: unknown) => {
    if (typeof v === 'bigint') return v >= BigInt(Number.MIN_SAFE_INTEGER) && v <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : v.toString()
    return v
  }
  try {
    return JSON.stringify(plistToJson(result.value.root), replacer, 2)
  } catch {
    return '(無法序列化)'
  }
})

async function copyJson() {
  try {
    await navigator.clipboard.writeText(jsonText.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch { /* 忽略 */ }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">開啟 .plist 檔(二進位或 XML 皆可)</label>
        <input type="file" accept=".plist,.mobileconfig,.xml,text/xml,application/x-plist" class="block w-full text-sm text-ink-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-200" @change="onFile" />
        <p v-if="fileName" class="field-hint">已載入:<strong>{{ fileName }}</strong> · <button type="button" class="text-brand-700 hover:underline" @click="clearFile">清除</button></p>
      </div>
      <div class="text-center text-xs text-ink-400">— 或 —</div>
      <div>
        <label class="field-label">貼上 plist 內容</label>
        <textarea
          v-model="raw"
          rows="6"
          class="field-input font-mono text-sm"
          placeholder="貼上 XML plist 文字,或二進位 plist 的 hex / base64"
          spellcheck="false"
          @input="onPaste"
        ></textarea>
        <p class="field-hint">可貼 XML plist 文字,或二進位 plist(bplist00)的 hex / base64。全程在你瀏覽器解析,內容不上傳。</p>
      </div>
      <button type="button" class="text-sm text-brand-700 hover:underline" @click="raw = SAMPLE; onPaste()">
        載入範例(App Info.plist)
      </button>
    </div>

    <div v-if="result.parsed && result.error && !result.root" class="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-sm text-rose-700">
      ⚠️ {{ result.error }}
    </div>

    <div v-if="result.root" class="card p-5 space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-700">{{ result.format }}</span>
        <div class="inline-flex rounded-lg border border-ink-200 p-0.5 text-xs">
          <button type="button" class="rounded-md px-2.5 py-1 font-medium" :class="view === 'tree' ? 'bg-brand-100 text-brand-700' : 'text-ink-500'" @click="view = 'tree'">結構樹</button>
          <button type="button" class="rounded-md px-2.5 py-1 font-medium" :class="view === 'json' ? 'bg-brand-100 text-brand-700' : 'text-ink-500'" @click="view = 'json'">JSON</button>
        </div>
      </div>

      <div v-if="view === 'tree'" class="overflow-x-auto">
        <PlistTree :nodes="[result.root]" :depth="0" />
      </div>

      <div v-else class="space-y-2">
        <div class="flex justify-end">
          <button type="button" class="text-xs text-brand-700 hover:underline" @click="copyJson">{{ copied ? '已複製 ✓' : '複製 JSON' }}</button>
        </div>
        <pre class="overflow-x-auto rounded-lg bg-ink-50 p-3 text-xs font-mono text-ink-800 whitespace-pre-wrap break-all">{{ jsonText }}</pre>
      </div>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>把 Apple 的 <strong>Property List(plist)</strong>拆成看得懂的結構樹 —— dict / array / 字串 / 整數 / 浮點 / 布林 / data / 日期 / UID 一層層攤開,並可一鍵轉成乾淨 JSON。</li>
        <li>支援<strong>二進位 plist(bplist00)</strong>與 <strong>XML plist</strong>兩種格式:iOS / macOS 的 App 偏好設定(<code>*.plist</code>)、iCloud 與 iTunes 備份、<code>Info.plist</code>、描述檔內層、<strong>NSKeyedArchiver</strong> 封存,二進位的用文字編輯器打開只會看到亂碼。</li>
        <li>plist 裡常藏帳號、權杖、裝置 UDID 等隱私,線上解碼器卻要你上傳 —— 本工具<strong>全程在你瀏覽器解析,不連網、不上傳</strong>。</li>
        <li>需要其他二進位格式請改用 CBOR / MessagePack / Bencode / ASN.1 解碼器。</li>
      </ul>
    </LegalNote>
  </div>
</template>
