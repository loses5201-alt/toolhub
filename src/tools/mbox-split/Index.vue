<script setup lang="ts">
import { ref, computed } from 'vue'
import JSZip from 'jszip'
import LegalNote from '@/components/LegalNote.vue'
import { splitMbox } from '@/features/mbox'
import { parseEml } from '@/features/eml'

/*
  mbox 信箱分割器 —— 開啟 Thunderbird / Google Takeout 匯出的 mbox 檔,分割成一封封郵件,
  顯示主旨/寄件者/日期,可單封或整批下載成 .eml。全程在你瀏覽器處理,信件不連網、不上傳。
*/
interface Row {
  fromLine: string
  raw: string
  subject: string
  from: string
  date: string
}

const fileName = ref('')
const loading = ref(false)
const rows = ref<Row[]>([])
const parsed = ref(false)
const query = ref('')

function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  fileName.value = f.name
  loading.value = true
  parsed.value = false
  rows.value = []
  const reader = new FileReader()
  reader.onload = () => {
    const buf = new Uint8Array(reader.result as ArrayBuffer)
    let bin = ''
    // 分塊組字串,避免超長檔案爆 call stack
    const CH = 0x8000
    for (let i = 0; i < buf.length; i += CH) {
      bin += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + CH)))
    }
    rows.value = splitMbox(bin).map((m) => {
      let subject = '(無主旨)', from = '', date = ''
      try {
        const mail = parseEml(m.raw)
        subject = mail.subject || '(無主旨)'
        from = mail.from.map((a) => (a.name ? a.name : a.email)).join(', ')
        date = mail.date
      } catch { /* 解析失敗仍保留原始郵件 */ }
      return { fromLine: m.fromLine, raw: m.raw, subject, from, date }
    })
    parsed.value = true
    loading.value = false
  }
  reader.readAsArrayBuffer(f)
}

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return rows.value
  return rows.value.filter(
    (r) => r.subject.toLowerCase().includes(q) || r.from.toLowerCase().includes(q),
  )
})

function safeName(r: Row, i: number): string {
  const base = (r.subject || 'message').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60).trim() || 'message'
  return `${String(i + 1).padStart(3, '0')}-${base}.eml`
}

function downloadOne(r: Row, i: number) {
  const url = URL.createObjectURL(new Blob([r.raw], { type: 'message/rfc822' }))
  const a = document.createElement('a')
  a.href = url
  a.download = safeName(r, i)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const zipping = ref(false)
async function downloadAll() {
  if (!rows.value.length) return
  zipping.value = true
  try {
    const zip = new JSZip()
    rows.value.forEach((r, i) => zip.file(safeName(r, i), r.raw))
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = (fileName.value.replace(/\.mbox$/i, '') || 'mbox') + '-郵件.zip'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } finally {
    zipping.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div class="flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept=".mbox,application/mbox,text/plain"
          class="block text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-brand-500 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-brand-600"
          @change="onFile"
        />
        <span v-if="fileName" class="text-sm text-ink-500">{{ fileName }}</span>
      </div>
      <p class="field-hint">
        支援 Thunderbird、Apple Mail、Google Takeout 匯出的 <code>.mbox</code>。檔案在你瀏覽器內分割,郵件內容不上傳。
      </p>
    </div>

    <div v-if="loading" class="card p-6 text-center text-ink-500">分割中…</div>

    <div v-if="parsed && !rows.length" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
      ⚠️ 找不到郵件。請確認這是有效的 mbox 檔(每封信以 “From ” 開頭的分隔行起始)。
    </div>

    <div v-if="rows.length" class="space-y-3">
      <div class="card p-4 flex flex-wrap items-center gap-3">
        <div class="text-sm font-semibold text-ink-700">共 {{ rows.length }} 封郵件</div>
        <input
          v-model="query"
          type="search"
          placeholder="搜尋主旨 / 寄件者…"
          class="field-input max-w-xs flex-1 text-sm"
        />
        <button
          type="button"
          class="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          :disabled="zipping"
          @click="downloadAll"
        >
          {{ zipping ? '打包中…' : '全部下載為 ZIP' }}
        </button>
      </div>

      <div v-if="query && !filtered.length" class="text-sm text-ink-500">沒有符合「{{ query }}」的郵件。</div>

      <ul class="space-y-2">
        <li
          v-for="(r, i) in filtered"
          :key="i"
          class="card flex items-center justify-between gap-3 p-4"
        >
          <div class="min-w-0">
            <div class="truncate font-medium text-ink-800">{{ r.subject }}</div>
            <div class="truncate text-xs text-ink-400">
              <span v-if="r.from">{{ r.from }}</span><span v-if="r.from && r.date"> · </span><span v-if="r.date">{{ r.date }}</span>
            </div>
          </div>
          <button
            type="button"
            class="shrink-0 rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50"
            @click="downloadOne(r, rows.indexOf(r))"
          >
            下載 .eml
          </button>
        </li>
      </ul>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>Google Takeout、Thunderbird、Apple Mail 匯出的信箱常是一個<strong>動輒上 GB 的 mbox 檔</strong>,所有信件擠在一起 —— 這支幫你<strong>分割成一封封獨立郵件</strong>,列出主旨、寄件者、日期。</li>
        <li>可單封或整批<strong>下載成標準 .eml</strong>(用「.eml 郵件檢視器」開、或匯入其他信箱)。mboxrd 的 <code>&gt;From</code> 跳脫會自動還原。</li>
        <li>信箱裡全是隱私,線上 mbox 工具卻要你把整個信箱上傳 —— 本工具<strong>全程在你瀏覽器處理,不連網、不上傳</strong>。</li>
        <li>與「.eml 郵件檢視器」互補:分割後直接逐封檢視內文與附件。</li>
      </ul>
    </LegalNote>
  </div>
</template>
