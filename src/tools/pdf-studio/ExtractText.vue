<script setup lang="ts">
import { ref, computed } from 'vue'
import { extractPdfText, downloadBlob, type PageText } from './lib'

/*
  PDF 取出文字 —— 用 pdfjs 抽出 PDF 裡可選取的文字,方便複製、引用、搜尋。
  全程在瀏覽器解析,機密文件不上傳。掃描成影像的 PDF 沒有文字層,會抽不到。
*/
const fileBase = ref('')
let buffer: ArrayBuffer | null = null
const pages = ref<PageText[]>([])
const busy = ref(false)
const error = ref('')
const progress = ref('')
const done = ref(false)
const showPageMarks = ref(true)

function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  error.value = ''
  done.value = false
  pages.value = []
  fileBase.value = f.name.replace(/\.pdf$/i, '')
  f.arrayBuffer().then((b) => (buffer = b))
}

async function run() {
  if (!buffer) return
  busy.value = true
  error.value = ''
  pages.value = []
  done.value = false
  try {
    pages.value = await extractPdfText(buffer, (d, t) => {
      progress.value = `解析中… ${d}/${t} 頁`
    })
    done.value = true
  } catch (e) {
    error.value = '解析失敗,可能是受密碼保護的 PDF:' + (e as Error).message
  } finally {
    busy.value = false
    progress.value = ''
  }
}

const fullText = computed(() => {
  if (showPageMarks.value && pages.value.length > 1) {
    return pages.value.map((p) => `── 第 ${p.page} 頁 ──\n${p.text}`).join('\n\n')
  }
  return pages.value.map((p) => p.text).join('\n\n')
})

const hasText = computed(() => pages.value.some((p) => p.text.trim() !== ''))
const charCount = computed(() => fullText.value.length)

const copied = ref(false)
async function copyText() {
  if (!fullText.value) return
  try {
    await navigator.clipboard.writeText(fullText.value)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = fullText.value
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try { document.execCommand('copy') } catch { /* 忽略 */ }
    document.body.removeChild(ta)
  }
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

function downloadTxt() {
  const blob = new Blob([fullText.value], { type: 'text/plain;charset=utf-8' })
  downloadBlob(blob, `${fileBase.value || 'pdf'}.txt`)
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="field-label">選擇一個 PDF</label>
      <input type="file" accept="application/pdf" class="field-input" @change="onFile" />
      <p class="field-hint">抽出其中可選取的文字。檔案只在你的瀏覽器解析,不會上傳。</p>
    </div>

    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

    <div class="flex flex-wrap items-center gap-3">
      <button class="btn-primary" :disabled="!buffer || busy" @click="run">
        {{ busy ? progress || '解析中…' : '取出文字' }}
      </button>
      <label v-if="pages.length > 1" class="flex items-center gap-2 text-sm text-ink-700">
        <input v-model="showPageMarks" type="checkbox" class="accent-brand-600" />標示頁碼分隔
      </label>
    </div>

    <div
      v-if="done && !hasText"
      class="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800"
    >
      這個 PDF 抽不到文字,通常代表它是<strong>掃描成影像</strong>的檔案(文字其實是圖片)。
      這種情況需要 OCR 才能取字;你可以改用上方「PDF 轉圖片」分頁把每頁存成圖片。
    </div>

    <div v-if="done && hasText" class="space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-sm text-ink-500">共 {{ pages.length }} 頁 · {{ charCount }} 字</span>
        <div class="flex gap-2">
          <button class="inline-flex items-center rounded-xl border border-line bg-white px-4 py-1.5 text-sm font-medium text-ink-700 hover:bg-stone-50" @click="downloadTxt">下載 .txt</button>
          <button class="btn-primary !py-1.5 text-sm" @click="copyText">{{ copied ? '已複製 ✓' : '複製全文' }}</button>
        </div>
      </div>
      <textarea
        :value="fullText"
        rows="14"
        readonly
        class="field-input bg-ink-50/40 font-mono text-sm leading-relaxed"
      ></textarea>
    </div>
  </div>
</template>
