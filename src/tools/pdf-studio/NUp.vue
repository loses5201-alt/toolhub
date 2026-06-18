<script setup lang="ts">
import { ref } from 'vue'
import { nUpPdf, getPageCount, downloadBlob, fmtSize } from './lib'

// N-up 併頁省紙 —— 把多頁 PDF 縮排成每張 A4 放 2/4/6/9 頁,印講義/校稿省紙
const file = ref<File | null>(null)
const pageCount = ref(0)
const perSheet = ref<2 | 4 | 6 | 9>(2)
const busy = ref(false)
const error = ref('')

const options = [
  { v: 2 as const, label: '2 合 1', desc: '橫式,兩頁並排' },
  { v: 4 as const, label: '4 合 1', desc: '直式 2×2' },
  { v: 6 as const, label: '6 合 1', desc: '直式 2×3' },
  { v: 9 as const, label: '9 合 1', desc: '直式 3×3' },
]

async function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0] || null
  ;(e.target as HTMLInputElement).value = ''
  file.value = f
  pageCount.value = 0
  error.value = ''
  if (!f) return
  try {
    pageCount.value = await getPageCount(await f.arrayBuffer())
  } catch (err) {
    error.value = '無法讀取此 PDF,可能已損毀或受密碼保護:' + (err as Error).message
    file.value = null
  }
}

async function run() {
  if (!file.value) return
  busy.value = true
  error.value = ''
  try {
    const bytes = await nUpPdf(await file.value.arrayBuffer(), perSheet.value)
    const base = file.value.name.replace(/\.pdf$/i, '') || '文件'
    downloadBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `${base}_${perSheet.value}合1.pdf`)
  } catch (err) {
    error.value = '併頁失敗:' + (err as Error).message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="field-label">選擇要併頁的 PDF</label>
      <input type="file" accept="application/pdf" class="field-input" @change="onFile" />
      <p class="field-hint">把多頁縮排到每張紙印多頁,省紙、印講義或校稿很方便。檔案只在你的瀏覽器處理,不會上傳。</p>
    </div>

    <p v-if="file && pageCount" class="text-sm text-ink-600">
      📄 {{ file.name }}({{ pageCount }} 頁,{{ fmtSize(file.size) }})
      → 預估輸出 {{ Math.ceil(pageCount / perSheet) }} 張 A4
    </p>

    <div v-if="file">
      <label class="field-label">每張放幾頁</label>
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button
          v-for="o in options"
          :key="o.v"
          class="rounded-xl border px-3 py-3 text-left transition"
          :class="perSheet === o.v
            ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-300'
            : 'border-line bg-white hover:bg-stone-50'"
          @click="perSheet = o.v"
        >
          <div class="font-semibold text-ink-900">{{ o.label }}</div>
          <div class="mt-0.5 text-xs text-ink-500">{{ o.desc }}</div>
        </button>
      </div>
    </div>

    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

    <button class="btn-primary w-full sm:w-auto" :disabled="!file || busy" @click="run">
      {{ busy ? '併頁中…' : !file ? '請先選擇 PDF' : `併成每張 ${perSheet} 頁並下載` }}
    </button>

    <p class="field-hint">
      頁面會等比例縮放、置中排列,不會變形。旋轉過的頁面請先用「整理頁面」轉正,再來併頁。
    </p>
  </div>
</template>
