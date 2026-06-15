<script setup lang="ts">
import { ref } from 'vue'
import { mergePdfs, downloadBlob, fmtSize } from './lib'

// 合併多個 PDF —— 依清單順序串接,可上下移動調整順序
interface Item {
  id: number
  file: File
}
const items = ref<Item[]>([])
const busy = ref(false)
const error = ref('')
let uid = 0

function onFiles(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (!files) return
  for (const f of Array.from(files)) {
    if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
      items.value.push({ id: ++uid, file: f })
    }
  }
  ;(e.target as HTMLInputElement).value = ''
}

function move(i: number, dir: -1 | 1) {
  const j = i + dir
  if (j < 0 || j >= items.value.length) return
  const arr = items.value
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
}

function remove(id: number) {
  items.value = items.value.filter((x) => x.id !== id)
}

async function run() {
  if (items.value.length < 2) return
  busy.value = true
  error.value = ''
  try {
    const buffers = await Promise.all(items.value.map((it) => it.file.arrayBuffer()))
    const bytes = await mergePdfs(buffers)
    downloadBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), '合併結果.pdf')
  } catch (e) {
    error.value = '合併失敗,可能有檔案損毀或受密碼保護:' + (e as Error).message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="field-label">選擇要合併的 PDF(可多選,可分次加入)</label>
      <input type="file" accept="application/pdf" multiple class="field-input" @change="onFiles" />
      <p class="field-hint">合併順序 = 下方清單由上到下。檔案只在你的瀏覽器處理,不會上傳。</p>
    </div>

    <ul v-if="items.length" class="space-y-2">
      <li
        v-for="(it, i) in items"
        :key="it.id"
        class="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3"
      >
        <span class="font-mono text-sm text-ink-400 w-6 shrink-0">{{ i + 1 }}.</span>
        <span class="min-w-0 flex-1 truncate text-ink-800">📄 {{ it.file.name }}</span>
        <span class="shrink-0 text-sm text-ink-400">{{ fmtSize(it.file.size) }}</span>
        <button class="shrink-0 px-1.5 text-ink-400 hover:text-brand-700 disabled:opacity-30" :disabled="i === 0" aria-label="上移" @click="move(i, -1)">▲</button>
        <button class="shrink-0 px-1.5 text-ink-400 hover:text-brand-700 disabled:opacity-30" :disabled="i === items.length - 1" aria-label="下移" @click="move(i, 1)">▼</button>
        <button class="shrink-0 px-1.5 text-ink-400 hover:text-red-500" aria-label="移除" @click="remove(it.id)">✕</button>
      </li>
    </ul>

    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

    <button class="btn-primary w-full sm:w-auto" :disabled="items.length < 2 || busy" @click="run">
      {{ busy ? '合併中…' : items.length < 2 ? '至少選 2 個 PDF' : `合併 ${items.length} 個 PDF 並下載` }}
    </button>
  </div>
</template>
