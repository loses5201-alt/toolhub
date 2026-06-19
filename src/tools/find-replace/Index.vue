<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'

/*
  尋找取代工坊 —— 批次尋找/取代文字,支援正規表達式、忽略大小寫。
  全程在瀏覽器,文字不上傳。整理從各處貼來的資料很快。
*/
const input = ref('')
const find = ref('')
const replace = ref('')
const useRegex = ref(false)
const ignoreCase = ref(false)
const output = ref('')
const error = ref('')
const count = ref<number | null>(null)

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const flags = computed(() => 'g' + (ignoreCase.value ? 'i' : ''))

function run() {
  error.value = ''
  count.value = null
  if (!find.value) {
    output.value = input.value
    return
  }
  try {
    const pattern = useRegex.value ? find.value : escapeRe(find.value)
    const re = new RegExp(pattern, flags.value)
    let n = 0
    output.value = input.value.replace(re, (...args) => {
      n++
      // 支援正則時的 $1 等替換群組
      if (useRegex.value) {
        const groups = args.slice(1, -2)
        return replace.value.replace(/\$(\d+)/g, (_, i) => groups[Number(i) - 1] ?? '')
      }
      return replace.value
    })
    count.value = n
  } catch (e) {
    error.value = '正規表達式錯誤:' + (e instanceof Error ? e.message : String(e))
  }
}

async function copy() {
  try { await navigator.clipboard.writeText(output.value) } catch { /* 忽略 */ }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">原始文字</label>
        <textarea v-model="input" rows="6" placeholder="貼上要處理的文字…" class="field-input resize-y font-mono text-sm" />
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <label class="field-label">尋找</label>
          <input v-model="find" class="field-input font-mono" :placeholder="useRegex ? '例:\\d{4}' : '要找的字'" />
        </div>
        <div>
          <label class="field-label">取代成</label>
          <input v-model="replace" class="field-input font-mono" placeholder="換成的字(可留空=刪除)" />
        </div>
      </div>
      <div class="flex flex-wrap gap-4">
        <label class="flex items-center gap-2 text-ink-700"><input v-model="useRegex" type="checkbox" class="h-5 w-5 accent-brand-600" />使用正規表達式(可用 $1 取群組)</label>
        <label class="flex items-center gap-2 text-ink-700"><input v-model="ignoreCase" type="checkbox" class="h-5 w-5 accent-brand-600" />忽略大小寫</label>
      </div>
      <button class="btn-primary w-full sm:w-auto" :disabled="!input" @click="run">全部取代</button>
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      <p v-else-if="count !== null" class="text-sm text-brand-700">完成,共取代 {{ count }} 處。</p>
    </div>

    <div v-if="output" class="card p-5 space-y-3">
      <div class="flex items-center justify-between">
        <span class="font-semibold text-ink-900">結果</span>
        <button class="text-sm text-brand-700 hover:underline" @click="copy">複製</button>
      </div>
      <textarea :value="output" rows="6" readonly class="field-input resize-y font-mono text-sm" />
    </div>

    <LegalNote title="說明">
      <ul class="list-disc pl-5 space-y-1">
        <li>支援正規表達式(例:<code>\d{4}</code> 找四位數字),取代欄可用 <code>$1</code> 引用括號群組。</li>
        <li>全程在你瀏覽器,<strong>文字不上傳</strong>。整理名單、批次改格式很實用。</li>
      </ul>
    </LegalNote>
  </div>
</template>
