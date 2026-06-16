<script setup lang="ts">
import { ref, reactive, computed, onBeforeUnmount } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import type { ZipEntryInfo } from '@/features/zipStudio'

/*
  ZIP 工坊 —— 把多個檔案打包成一個 .zip 好寄出/上傳,或把收到的 .zip
  在本機解開來看內容,全程在你瀏覽器處理、不上傳。線上壓縮/解壓網站常要你
  把檔案上傳到別人的伺服器、滿是廣告、又限制大小與檔數;這裡用 JSZip 在本機完成。
*/
type Mode = 'pack' | 'unpack'
const mode = ref<Mode>('pack')

// ── 壓縮(打包)──
interface PackItem {
  id: number
  file: File
  name: string // 在壓縮檔內的路徑(可改)
}
let seq = 0
const items = ref<PackItem[]>([])
const zipName = ref('打包')
const level = ref(6) // 0=不壓縮 / 6=標準 / 9=最大
const packing = ref(false)
const packError = ref('')
const result = reactive({ url: '', size: 0, raw: 0 })

function clearResult() {
  if (result.url) URL.revokeObjectURL(result.url)
  result.url = ''
  result.size = 0
  result.raw = 0
}

function onPackFiles(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ''
  if (!files.length) return
  packError.value = ''
  clearResult()
  for (const f of files) {
    // webkitRelativePath 在選資料夾時帶有相對路徑,保留資料夾結構
    const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath
    items.value.push({ id: ++seq, file: f, name: rel || f.name })
  }
}

function removeItem(i: number) {
  items.value.splice(i, 1)
  clearResult()
}

function clearPack() {
  items.value = []
  packError.value = ''
  clearResult()
}

const totalRaw = computed(() => items.value.reduce((s, it) => s + it.file.size, 0))

async function doPack() {
  if (!items.value.length || packing.value) return
  packing.value = true
  packError.value = ''
  clearResult()
  try {
    const { buildZip } = await import('@/features/zipStudio')
    const files = []
    for (const it of items.value) {
      const buf = await it.file.arrayBuffer()
      files.push({ name: it.name, data: new Uint8Array(buf), date: new Date(it.file.lastModified) })
    }
    const bytes = await buildZip(files, { level: level.value })
    const blob = new Blob([bytes as BlobPart], { type: 'application/zip' })
    result.url = URL.createObjectURL(blob)
    result.size = blob.size
    result.raw = totalRaw.value
  } catch (e) {
    packError.value = (e as Error).message || '打包失敗。'
  } finally {
    packing.value = false
  }
}

const ratio = computed(() => {
  if (!result.raw || !result.size) return 0
  return Math.max(0, Math.round((1 - result.size / result.raw) * 100))
})
const packDownloadName = computed(() => `${(zipName.value || '打包').replace(/\.zip$/i, '')}.zip`)

// ── 解壓(檢視)──
const entries = ref<ZipEntryInfo[]>([])
const unpacking = ref(false)
const unpackError = ref('')
const zipFileName = ref('')

async function onZipFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = (input.files || [])[0]
  input.value = ''
  if (!file) return
  unpacking.value = true
  unpackError.value = ''
  entries.value = []
  zipFileName.value = file.name
  try {
    const { readZip } = await import('@/features/zipStudio')
    const buf = await file.arrayBuffer()
    entries.value = await readZip(new Uint8Array(buf))
  } catch (err) {
    unpackError.value = (err as Error).message || '解壓失敗。'
  } finally {
    unpacking.value = false
  }
}

function downloadEntry(en: ZipEntryInfo) {
  if (!en.data) return
  const blob = new Blob([en.data as BlobPart], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = en.name.split('/').pop() || 'file'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const fileEntries = computed(() => entries.value.filter((e) => !e.dir))
const unpackTotal = computed(() => fileEntries.value.reduce((s, e) => s + e.size, 0))

function fmtSize(n: number): string {
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1024 / 1024).toFixed(2) + ' MB'
}

onBeforeUnmount(clearResult)
</script>

<template>
  <div class="space-y-6">
    <div class="inline-flex rounded-xl border border-line bg-white p-1">
      <button
        class="rounded-lg px-4 py-2 text-sm font-medium"
        :class="mode === 'pack' ? 'bg-brand-600 text-white' : 'text-ink-600 hover:text-brand-700'"
        @click="mode = 'pack'"
      >
        🗜️ 壓縮打包
      </button>
      <button
        class="rounded-lg px-4 py-2 text-sm font-medium"
        :class="mode === 'unpack' ? 'bg-brand-600 text-white' : 'text-ink-600 hover:text-brand-700'"
        @click="mode = 'unpack'"
      >
        📂 解壓檢視
      </button>
    </div>

    <!-- 壓縮 -->
    <template v-if="mode === 'pack'">
      <div class="card p-6 space-y-4">
        <div>
          <label class="field-label">選擇要打包的檔案(可多選、可多次加入)</label>
          <input type="file" multiple class="field-input" @change="onPackFiles" />
          <p class="field-hint">把零散的多個檔案合成一個 .zip,寄信附件或上傳表單一次搞定。全程在你瀏覽器處理、不上傳。</p>
        </div>

        <div v-if="items.length" class="space-y-2">
          <div
            v-for="(it, i) in items"
            :key="it.id"
            class="flex items-center gap-3 rounded-xl border border-line bg-white p-2"
          >
            <span class="w-6 text-center text-sm text-ink-400 tabular-nums">{{ i + 1 }}</span>
            <div class="min-w-0 flex-1">
              <input v-model="it.name" class="w-full rounded border border-line px-2 py-1 text-sm text-ink-800" />
              <div class="mt-0.5 text-xs text-ink-500">{{ fmtSize(it.file.size) }}</div>
            </div>
            <button class="px-2 text-rose-500 hover:text-rose-700" title="移除" @click="removeItem(i)">✕</button>
          </div>
          <p class="text-xs text-ink-500">共 {{ items.length }} 個檔案 · 原始合計 {{ fmtSize(totalRaw) }}。檔名可直接修改(含 / 可建立資料夾)。</p>
        </div>
      </div>

      <div v-if="items.length" class="card p-6 space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="field-label">壓縮檔名稱</label>
            <div class="flex items-center gap-2">
              <input v-model="zipName" class="field-input" placeholder="打包" />
              <span class="text-ink-500">.zip</span>
            </div>
          </div>
          <div>
            <label class="field-label">壓縮強度</label>
            <select v-model.number="level" class="field-input">
              <option :value="0">不壓縮(最快,適合相片/影片等已壓縮檔)</option>
              <option :value="6">標準(推薦)</option>
              <option :value="9">最大(較慢,文件/文字檔較有效)</option>
            </select>
          </div>
        </div>

        <p v-if="packError" class="text-sm text-red-600">{{ packError }}</p>

        <div class="flex flex-wrap gap-3">
          <button class="btn-primary" :disabled="packing" @click="doPack">
            {{ packing ? '打包中…' : '打包成 ZIP' }}
          </button>
          <button class="inline-flex items-center rounded-xl border border-line bg-white px-5 py-3 font-medium text-ink-700 hover:bg-stone-50" @click="clearPack">清空</button>
        </div>
      </div>

      <div v-if="result.url" class="card p-6 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <span class="text-sm text-ink-500">
            完成 · {{ fmtSize(result.size) }}
            <template v-if="ratio > 0">(較原始小 {{ ratio }}%)</template>
            <template v-else>(已壓縮的檔案再壓多半不會變小,屬正常)</template>
          </span>
          <a :href="result.url" :download="packDownloadName" class="btn-primary !py-1.5 text-sm">下載 {{ packDownloadName }}</a>
        </div>
      </div>
    </template>

    <!-- 解壓 -->
    <template v-else>
      <div class="card p-6 space-y-4">
        <div>
          <label class="field-label">選擇一個 .zip 檔</label>
          <input type="file" accept=".zip,application/zip" class="field-input" @change="onZipFile" />
          <p class="field-hint">在本機解開來看裡面有什麼、單獨下載需要的檔案,不必把可能含機密的壓縮檔上傳到陌生網站。</p>
        </div>
        <p v-if="unpacking" class="text-sm text-ink-500">讀取中…</p>
        <p v-if="unpackError" class="text-sm text-red-600">{{ unpackError }}</p>
      </div>

      <div v-if="entries.length" class="card p-6 space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-sm text-ink-500">{{ zipFileName }}</span>
          <span class="text-sm text-ink-500">{{ fileEntries.length }} 個檔案 · 解壓後 {{ fmtSize(unpackTotal) }}</span>
        </div>
        <div class="divide-y divide-line rounded-xl border border-line">
          <div
            v-for="en in entries"
            :key="en.name"
            class="flex items-center gap-3 px-3 py-2"
          >
            <span>{{ en.dir ? '📁' : '📄' }}</span>
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm text-ink-800">{{ en.name }}</div>
              <div v-if="!en.dir" class="text-xs text-ink-500">{{ fmtSize(en.size) }}</div>
            </div>
            <button
              v-if="!en.dir"
              class="rounded-lg border border-line px-3 py-1 text-sm text-ink-700 hover:bg-stone-50"
              @click="downloadEntry(en)"
            >
              下載
            </button>
          </div>
        </div>
        <p class="text-xs text-ink-500">逐一點「下載」即可把單檔存到本機;所有解壓都在你瀏覽器內完成,沒有上傳。</p>
      </div>

      <div v-else-if="!unpacking && !unpackError && zipFileName" class="card p-6">
        <p class="text-sm text-ink-500">這個 ZIP 是空的,沒有任何檔案。</p>
      </div>
    </template>

    <LegalNote title="什麼時候用得到?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>寄一堆檔案</strong>:把多個檔案/一個資料夾打包成單一 .zip,郵件附件或表單上傳一次完成,對方也好收。</li>
        <li><strong>收到 .zip 想先看看</strong>:在本機解開、單獨下載需要的檔,不用整包上傳到滿是廣告、可能偷存你檔案的線上解壓站。</li>
        <li><strong>全程在你瀏覽器內處理、不上傳、無廣告、無檔數/大小限制</strong>。注意:本工具不支援有密碼加密的 ZIP;要替檔案上密碼可改用「本機加密保險箱」。</li>
      </ul>
    </LegalNote>
  </div>
</template>
