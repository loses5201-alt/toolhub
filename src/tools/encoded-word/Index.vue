<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { decodeMimeHeader } from '@/features/encodedWord'

/*
  MIME 亂碼主旨還原(RFC 2047 encoded-word)—— 把 email 主旨 / 寄件者 / 附件檔名裡
  =?charset?B?...?= 或 =?charset?Q?...?= 的亂碼還原成可讀文字。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

const input = ref('=?UTF-8?B?5L2g5aW9?=,=?Big5?B?pKSk5Q==?= =?ISO-8859-1?Q?Fr=E9d=E9ric?=')
const res = computed(() => decodeMimeHeader(input.value))

const copied = ref(false)
async function copyOut() {
  try {
    await navigator.clipboard.writeText(res.value.text)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    /* 忽略 */
  }
}

const EXAMPLES = [
  { label: 'UTF-8 Base64', v: '=?UTF-8?B?6YO15Lu25Li76aGM?=' },
  { label: 'UTF-8 Q', v: '=?UTF-8?Q?=E4=BD=A0=E5=A5=BD?=' },
  { label: 'Big5(繁中)', v: '=?Big5?B?pKSk5Q==?=' },
  { label: 'ISO-8859-1 Q', v: '=?ISO-8859-1?Q?Patrik_F=E4ltstr=F6m?=' },
  { label: '混合', v: 'Re: =?UTF-8?B?5L2g5aW9?= - =?UTF-8?Q?thanks?=' },
]
</script>

<template>
  <div class="space-y-6">
    <div class="card p-5 space-y-3">
      <label class="block text-sm">
        <span class="text-ink-500">貼上亂碼的標頭(主旨 / 寄件者 / 檔名)</span>
        <textarea
          v-model="input"
          rows="3"
          class="ew-input font-mono"
          placeholder="=?UTF-8?B?5L2g5aW9?="
        ></textarea>
      </label>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="ex in EXAMPLES"
          :key="ex.label"
          type="button"
          class="rounded-lg border border-ink-200 px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          @click="input = ex.v"
        >
          {{ ex.label }}
        </button>
      </div>
    </div>

    <div class="card p-5 space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-sm font-semibold text-ink-700">還原結果</span>
        <button
          type="button"
          class="rounded-lg border border-ink-200 px-3 py-1 text-xs text-ink-600 hover:bg-ink-50"
          @click="copyOut"
        >
          {{ copied ? '已複製 ✓' : '複製' }}
        </button>
      </div>
      <div class="text-xl text-ink-900 break-all min-h-[1.75rem]">{{ res.text }}</div>
      <p v-if="!res.hadEncoded" class="text-xs text-ink-400">
        這段文字沒有偵測到 encoded-word(=?charset?B/Q?...?=),已原樣顯示。
      </p>
    </div>

    <div v-if="res.hadEncoded" class="card p-5 space-y-2">
      <span class="text-sm font-semibold text-ink-700">逐段拆解</span>
      <div class="space-y-1.5 text-sm">
        <div
          v-for="(seg, i) in res.segments"
          :key="i"
          class="flex flex-wrap items-center gap-2 border-b border-ink-100 pb-1.5 last:border-0"
        >
          <template v-if="seg.type === 'word'">
            <span class="rounded bg-brand-50 text-brand-700 text-xs px-1.5 py-0.5 font-mono">
              {{ seg.charset }} · {{ seg.encoding }}
            </span>
            <code class="font-mono text-xs text-ink-400 break-all">{{ seg.raw }}</code>
            <span class="text-ink-400">→</span>
            <span class="text-ink-800">{{ seg.decoded }}</span>
            <span v-if="seg.error" class="text-rose-600 text-xs">{{ seg.error }}</span>
          </template>
          <template v-else>
            <span class="rounded bg-ink-100 text-ink-500 text-xs px-1.5 py-0.5">原文</span>
            <span class="text-ink-700">{{ seg.decoded }}</span>
          </template>
        </div>
      </div>
    </div>

    <LegalNote>
      電子郵件標頭只能放 ASCII,非英數字會用 <strong>RFC 2047 encoded-word</strong> 編碼成
      <code>=?字元集?B?...?=</code>(Base64)或 <code>=?字元集?Q?...?=</code>(Quoted-Printable)。
      信箱軟體沒正確解碼時就會看到這串亂碼。本工具支援 UTF-8、Big5、ISO-8859-1、Shift_JIS、GBK 等
      (由瀏覽器內建解碼器處理),並依規範移除相鄰編碼字之間的空白。
      全程在你的瀏覽器計算,不連網、不上傳。
    </LegalNote>
  </div>
</template>

<style scoped>
.ew-input {
  width: 100%;
  margin-top: 0.25rem;
  border: 1px solid var(--color-ink-200, #e2e8f0);
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
  font-size: 0.95rem;
  resize: vertical;
}
</style>
