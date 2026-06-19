<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import { md5Hex, crc32Hex, bytesToHex, utf8Bytes } from '@/features/hashText'

/*
  文字雜湊值產生器 —— 把一段文字算出 MD5 / SHA-1 / SHA-256 / SHA-512 / CRC32。
  MD5 與 CRC32 由純函式計算(瀏覽器 Web Crypto 不含),SHA 家族用 crypto.subtle。
  驗證下載字串、比對內容、產生 ETag/識別碼用;全程在你的瀏覽器,文字不上傳。
*/

const input = ref('')
const uppercase = ref(false)

interface Row {
  name: string
  value: string
}
const rows = ref<Row[]>([])
const busy = ref(false)

async function subtleHex(algo: string, bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest(algo, bytes as BufferSource)
  return bytesToHex(new Uint8Array(buf))
}

async function compute() {
  busy.value = true
  try {
    const bytes = utf8Bytes(input.value)
    const [sha1, sha256, sha384, sha512] = await Promise.all([
      subtleHex('SHA-1', bytes),
      subtleHex('SHA-256', bytes),
      subtleHex('SHA-384', bytes),
      subtleHex('SHA-512', bytes),
    ])
    rows.value = [
      { name: 'MD5', value: md5Hex(input.value) },
      { name: 'CRC32', value: crc32Hex(input.value) },
      { name: 'SHA-1', value: sha1 },
      { name: 'SHA-256', value: sha256 },
      { name: 'SHA-384', value: sha384 },
      { name: 'SHA-512', value: sha512 },
    ]
  } finally {
    busy.value = false
  }
}

// 輸入即時重算(debounce 由 watch 本身的批次足夠;內容小、運算快)
watch(input, compute, { immediate: false })

function display(v: string): string {
  return uppercase.value ? v.toUpperCase() : v
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* 忽略:某些瀏覽器需 HTTPS 或權限 */
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">輸入要計算雜湊值的文字</label>
        <textarea
          v-model="input"
          rows="5"
          class="field-input font-mono"
          placeholder="貼上任何文字(密碼、字串、JSON…)"
          spellcheck="false"
        ></textarea>
        <p class="field-hint">
          文字以 <strong>UTF-8</strong> 編碼後計算。全程在你的瀏覽器,
          <strong>不連網、不上傳</strong> —— 連密碼也能安心算。
        </p>
      </div>

      <label class="flex items-center gap-1.5 text-sm text-ink-600">
        <input v-model="uppercase" type="checkbox" class="rounded" />
        以大寫顯示
      </label>

      <div v-if="rows.length" class="grid gap-2">
        <button
          v-for="row in rows"
          :key="row.name"
          type="button"
          class="group rounded-lg bg-ink-50 px-3 py-2 text-left transition hover:bg-ink-100"
          title="點一下複製"
          @click="copy(display(row.value))"
        >
          <div class="flex items-baseline justify-between gap-2">
            <span class="text-xs font-semibold text-ink-400">{{ row.name }}</span>
            <span class="text-[10px] text-ink-300 opacity-0 transition group-hover:opacity-100">點一下複製</span>
          </div>
          <div class="break-all font-mono text-sm text-ink-800">{{ display(row.value) }}</div>
        </button>
      </div>

      <p v-else class="text-sm text-ink-400">在上方輸入文字,會即時算出各種雜湊值。</p>
    </div>

    <div class="text-sm text-ink-500">
      要算<strong>檔案</strong>的雜湊值(SHA-256/512)、或比對官方校驗碼防掉包?請用
      <RouterLink to="/tools/file-checksum" class="font-semibold text-brand-700 underline hover:text-brand-800">
        檔案校驗碼工具
      </RouterLink>
      。
    </div>

    <LegalNote title="這個工具能、不能做什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>能</strong>:把任意文字算出 <strong>MD5、SHA-1、SHA-256/384/512、CRC32</strong>,用來比對內容是否一致、產生識別碼或 ETag。</li>
        <li><strong>能</strong>:離線算 <strong>MD5 / CRC32</strong> —— 這兩種瀏覽器內建加密不提供,本工具用純 JavaScript 計算(已用已知向量驗證)。</li>
        <li><strong>注意</strong>:<strong>MD5 與 SHA-1 已不安全</strong>,不可用於密碼儲存或防竄改;僅適合相容舊系統或非安全用途的快速比對。</li>
        <li><strong>注意</strong>:雜湊<strong>不可逆</strong>,無法從雜湊值還原原文;相同輸入永遠得到相同雜湊值。</li>
        <li>全程<strong>在你的瀏覽器</strong>計算,文字(含密碼)<strong>不連網、不上傳、不記錄</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
