<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parsePhpInput, decodePhp, phpToJson, type PhpNode } from '@/features/phpSerialize'
import PhpTree from './PhpTree.vue'

/*
  PHP serialize() 解碼器 —— 貼上 WordPress / Laravel / Drupal 資料庫裡的 serialize() 字串,
  拆成可讀的結構樹並可轉成乾淨 JSON。全程在你瀏覽器解析,不連網、不上傳。
*/
const raw = ref('')

const SAMPLE =
  'a:3:{s:4:"name";s:6:"張小明";s:3:"age";i:30;s:5:"roles";a:2:{i:0;s:5:"admin";i:1;s:6:"editor";}}'

const result = computed<{
  parsed: boolean
  source: string
  byteLen: number
  node: PhpNode | null
  error?: string
  trailing: number
  json: string
}>(() => {
  if (!raw.value.trim()) return { parsed: false, source: '', byteLen: 0, node: null, trailing: 0, json: '' }
  const input = parsePhpInput(raw.value)
  const decoded = decodePhp(input.bytes)
  let json = ''
  if (decoded.node) {
    try {
      json = JSON.stringify(phpToJson(decoded.node), null, 2)
    } catch {
      json = ''
    }
  }
  return {
    parsed: true,
    source: input.source,
    byteLen: input.bytes.length,
    node: decoded.node,
    error: decoded.error,
    trailing: decoded.trailing,
    json,
  }
})

const view = ref<'tree' | 'json'>('tree')
const copied = ref(false)
async function copyJson() {
  try {
    await navigator.clipboard.writeText(result.value.json)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    /* 忽略 */
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-3">
      <div>
        <label class="field-label">貼上 PHP serialize() 字串</label>
        <textarea
          v-model="raw"
          rows="6"
          class="field-input font-mono text-sm"
          placeholder='a:2:{s:4:"name";s:5:"Alice";s:3:"age";i:30;}'
          spellcheck="false"
        ></textarea>
        <p class="field-hint">
          常見於 WordPress 的 wp_options / postmeta、Laravel / Drupal 的資料庫欄位。也支援 base64 包裝。全程在你瀏覽器解析,內容不上傳。
        </p>
      </div>
      <button type="button" class="text-sm text-brand-700 hover:underline" @click="raw = SAMPLE">
        載入範例(含巢狀陣列)
      </button>
    </div>

    <div
      v-if="result.parsed && result.error && !result.node"
      class="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-sm text-rose-700"
    >
      ⚠️ {{ result.error }}
    </div>

    <div v-if="result.node" class="card p-5 space-y-3">
      <div class="flex flex-wrap items-center gap-2 text-sm">
        <span class="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-700">{{ result.source }}</span>
        <span class="text-ink-500">{{ result.byteLen }} 位元組</span>
        <span v-if="result.trailing > 0" class="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs text-amber-700">
          尾端多 {{ result.trailing }} 位元組未使用
        </span>
        <div class="ml-auto inline-flex rounded-lg border border-ink-200 p-0.5 text-xs">
          <button
            type="button"
            class="rounded-md px-2.5 py-1"
            :class="view === 'tree' ? 'bg-brand-600 text-white' : 'text-ink-600'"
            @click="view = 'tree'"
          >
            結構樹
          </button>
          <button
            type="button"
            class="rounded-md px-2.5 py-1"
            :class="view === 'json' ? 'bg-brand-600 text-white' : 'text-ink-600'"
            @click="view = 'json'"
          >
            JSON
          </button>
        </div>
      </div>

      <div v-if="result.error" class="rounded-lg border border-amber-200 bg-amber-50/60 p-2 text-xs text-amber-800">
        ⚠️ 解析中止:{{ result.error }}(以下為已成功解析的部分)
      </div>

      <div v-if="view === 'tree'" class="overflow-x-auto">
        <PhpTree :nodes="[result.node]" :depth="0" />
      </div>
      <div v-else class="space-y-2">
        <div class="flex justify-end">
          <button type="button" class="text-xs text-brand-700 hover:underline" @click="copyJson">
            {{ copied ? '已複製 ✓' : '複製 JSON' }}
          </button>
        </div>
        <pre class="overflow-x-auto rounded-lg bg-ink-900 p-3 text-xs text-ink-100 font-mono">{{ result.json }}</pre>
        <p class="text-[11px] text-ink-400">
          連續整數鍵(0,1,2…)的 PHP array 轉為 JSON 陣列,否則轉為物件;物件附 <code>__class__</code> 標出原類別名,
          protected / private 屬性以 <code>[可見性]</code> 標註。
        </p>
      </div>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>把 PHP <strong>serialize()</strong> 產生的字串(像 <code>a:2:{…}</code>、<code>O:8:"stdClass":…</code>)拆成看得懂的結構樹,並可一鍵轉成乾淨 <strong>JSON</strong>。</li>
        <li>最常見在 <strong>WordPress</strong> 的 wp_options / postmeta、<strong>Laravel</strong> session / cache、<strong>Drupal</strong> 等資料庫欄位 —— 一坨密密麻麻的字串,人工數位元組長度很痛苦。</li>
        <li>正確以 <strong>UTF-8 位元組長度</strong>解析字串(中文不會錯位),支援 array、object(含 protected / private 屬性)、reference、自訂序列化,並偵測尾端多餘資料。</li>
        <li>序列化內容常含帳號、密碼雜湊、個資,線上解碼器卻要你貼到別人的伺服器 —— 本工具<strong>全程在你瀏覽器解析,不連網、不上傳</strong>。</li>
        <li>需要相反方向或其他格式:JSON 美化 / 修復、YAML、CBOR / MessagePack / Protobuf 解碼器都在處理工坊。</li>
      </ul>
    </LegalNote>
  </div>
</template>
