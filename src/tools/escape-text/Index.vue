<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  toJsonString,
  escapeForQuote,
  escapeUnicode,
  unescapeString,
} from '@/features/escapeText'

/*
  文字跳脫 / 還原 —— 把文字轉成可貼進 JSON/程式碼的跳脫字串(換行→\n、引號→\"…),
  或反過來把含 \n \uXXXX 的跳脫字串還原成原文。全程在你瀏覽器,不連網、不上傳。
*/

type Mode = 'json' | 'quote' | 'unicode' | 'decode'

const mode = ref<Mode>('json')
const input = ref('')

const modes: { id: Mode; label: string; hint: string }[] = [
  { id: 'json', label: '→ JSON 字串', hint: '含外層雙引號,可直接當 JSON 值' },
  { id: 'quote', label: '→ 程式碼跳脫', hint: '不含引號,換行/Tab/引號轉跳脫' },
  { id: 'unicode', label: '→ \\uXXXX', hint: '所有非 ASCII 與控制字元轉 \\uXXXX' },
  { id: 'decode', label: '還原成原文', hint: '把跳脫字串解回原文' },
]

const result = computed<{ ok: boolean; text: string; error?: string }>(() => {
  const s = input.value
  if (s === '') return { ok: true, text: '' }
  if (mode.value === 'json') return { ok: true, text: toJsonString(s) }
  if (mode.value === 'quote') return { ok: true, text: escapeForQuote(s) }
  if (mode.value === 'unicode') return { ok: true, text: escapeUnicode(s) }
  const r = unescapeString(s)
  return r.ok ? { ok: true, text: r.value! } : { ok: false, text: '', error: r.error }
})

const currentHint = computed(() => modes.find((m) => m.id === mode.value)?.hint ?? '')

async function copy(text: string) {
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
      <!-- 模式 -->
      <div class="flex flex-wrap gap-2">
        <button
          v-for="m in modes"
          :key="m.id"
          type="button"
          class="rounded-lg border px-3 py-1.5 text-sm transition"
          :class="
            mode === m.id
              ? 'border-brand-500 bg-brand-600 text-white'
              : 'border-ink-200 text-ink-600 hover:bg-ink-50'
          "
          @click="mode = m.id"
        >
          {{ m.label }}
        </button>
      </div>
      <p class="text-sm text-ink-500">{{ currentHint }}</p>

      <div>
        <label class="field-label">{{ mode === 'decode' ? '跳脫字串' : '原始文字' }}</label>
        <textarea
          v-model="input"
          rows="6"
          class="field-input font-mono text-sm"
          :placeholder="mode === 'decode' ? '例如 Hello\\n\\u4e2d\\u6587' : '貼上文字…'"
          spellcheck="false"
        ></textarea>
      </div>

      <div
        v-if="!result.ok"
        class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800"
      >
        ⚠️ {{ result.error }}
      </div>

      <div v-else-if="input !== ''">
        <div class="mb-1 flex items-center justify-between">
          <label class="field-label !mb-0">結果</label>
          <button
            type="button"
            class="rounded-lg border border-ink-200 px-2.5 py-1 text-xs text-ink-600 transition hover:bg-ink-50"
            @click="copy(result.text)"
          >
            複製
          </button>
        </div>
        <pre class="max-h-80 overflow-auto rounded-lg bg-ink-50 px-3 py-2 font-mono text-sm text-ink-800 whitespace-pre-wrap break-all">{{ result.text }}</pre>
      </div>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>把一段含<strong>換行、Tab、引號</strong>的文字塞進 JSON 或程式碼字串,免手動加跳脫。</li>
        <li>把含 <code>\n</code>、<code>\uXXXX</code>、<code>\xXX</code> 的 log/設定值<strong>還原成看得懂的原文</strong>。</li>
        <li><code>\uXXXX</code> 模式把非 ASCII 全轉碼,確保純 ASCII 環境也能正確傳遞中文。</li>
        <li>支援 <code>\u{...}</code> 變長碼位(emoji)、自動去除外層成對引號。</li>
        <li>本工具<strong>不連網、不上傳</strong>,全部在你的裝置上處理。</li>
      </ul>
    </LegalNote>
  </div>
</template>
