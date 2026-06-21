<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parseEml, formatBytes, type EmlPart, type ParsedEml } from '@/features/eml'

/*
  .eml 郵件檢視器 —— 開啟存下來的 .eml 信件,解析標頭(主旨/寄件/收件/日期,含亂碼還原)、
  MIME 結構、內文(quoted-printable / base64 解碼)與附件清單,附件可直接下載。
  全程在你瀏覽器解析,信件內容不連網、不上傳。HTML 內文以原始碼呈現,不載入遠端追蹤圖片。
*/
const raw = ref('')
const fileName = ref('')

const SAMPLE = [
  'From: 客服中心 <service@example.com>',
  'To: you@example.com',
  'Subject: =?UTF-8?B?5biz5Zau6YCa55+l?=',
  'Date: Mon, 16 Jun 2026 09:30:00 +0800',
  'Content-Type: multipart/mixed; boundary="X"',
  '',
  '--X',
  'Content-Type: text/plain; charset=utf-8',
  'Content-Transfer-Encoding: quoted-printable',
  '',
  '=E6=82=A8=E5=A5=BD=EF=BC=8C=E9=80=99=E6=98=AF=E7=AF=84=E4=BE=8B=E5=85=A7=E6=96=87=E3=80=82',
  '--X',
  'Content-Type: text/plain; charset=utf-8; name="note.txt"',
  'Content-Transfer-Encoding: base64',
  'Content-Disposition: attachment; filename="note.txt"',
  '',
  'aGVsbG8gd29ybGQ=',
  '--X--',
].join('\n')

function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  fileName.value = f.name
  const reader = new FileReader()
  reader.onload = () => {
    const buf = new Uint8Array(reader.result as ArrayBuffer)
    let bin = ''
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i])
    raw.value = bin
  }
  reader.readAsArrayBuffer(f)
}

const result = computed<{ mail: ParsedEml | null; parsed: boolean }>(() => {
  const text = raw.value
  if (!text.trim()) return { mail: null, parsed: false }
  try {
    return { mail: parseEml(text), parsed: true }
  } catch {
    return { mail: null, parsed: true }
  }
})

// MIME 結構樹攤平成帶縮排的清單
interface TreeRow { depth: number; label: string; detail: string }
function buildTree(part: EmlPart, depth: number, rows: TreeRow[]) {
  const detail = part.isMultipart
    ? `${part.children.length} 段`
    : `${part.filename ? part.filename + ' · ' : ''}${formatBytes(part.size)}${part.encoding && part.encoding !== '7bit' ? ' · ' + part.encoding : ''}`
  rows.push({ depth, label: part.contentType || '(未知)', detail })
  for (const c of part.children) buildTree(c, depth + 1, rows)
}
const tree = computed<TreeRow[]>(() => {
  if (!result.value.mail) return []
  const rows: TreeRow[] = []
  buildTree(result.value.mail.root, 0, rows)
  return rows
})

function fmtAddr(a: { name: string; email: string }): string {
  return a.name ? `${a.name} <${a.email}>` : a.email
}

function download(part: EmlPart) {
  if (!part.bytes) return
  const url = URL.createObjectURL(new Blob([part.bytes as BlobPart], { type: part.contentType || 'application/octet-stream' }))
  const a = document.createElement('a')
  a.href = url
  a.download = part.filename || 'attachment'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const showHtmlSource = ref(false)
async function copy(text: string) {
  try { await navigator.clipboard.writeText(text) } catch { /* 忽略 */ }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div class="flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept=".eml,message/rfc822,text/plain"
          class="block text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-brand-500 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-brand-600"
          @change="onFile"
        />
        <button type="button" class="text-sm text-brand-700 hover:underline" @click="raw = SAMPLE; fileName = ''">
          載入範例
        </button>
        <span v-if="fileName" class="text-sm text-ink-500">{{ fileName }}</span>
      </div>
      <div>
        <label class="field-label">或直接貼上郵件原始碼(.eml 內容)</label>
        <textarea
          v-model="raw"
          rows="6"
          class="field-input font-mono text-sm"
          placeholder="From: ...&#10;Subject: ...&#10;Content-Type: ...&#10;&#10;內文"
          spellcheck="false"
        ></textarea>
        <p class="field-hint">在 Gmail / Outlook 選「顯示原始郵件」另存的 .eml,或直接貼上原始碼。全程在你瀏覽器解析,不上傳。</p>
      </div>
    </div>

    <div v-if="result.parsed && !result.mail" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
      ⚠️ 無法解析這封信。請確認貼上的是完整的郵件原始碼 / .eml 內容。
    </div>

    <template v-if="result.mail">
      <!-- 標頭 -->
      <div class="card p-5 space-y-2">
        <h2 class="text-xl font-semibold text-ink-800 break-words">{{ result.mail.subject || '(無主旨)' }}</h2>
        <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <template v-if="result.mail.from.length">
            <dt class="text-ink-400">寄件者</dt>
            <dd class="text-ink-700 break-all">{{ result.mail.from.map(fmtAddr).join(', ') }}</dd>
          </template>
          <template v-if="result.mail.to.length">
            <dt class="text-ink-400">收件者</dt>
            <dd class="text-ink-700 break-all">{{ result.mail.to.map(fmtAddr).join(', ') }}</dd>
          </template>
          <template v-if="result.mail.cc.length">
            <dt class="text-ink-400">副本</dt>
            <dd class="text-ink-700 break-all">{{ result.mail.cc.map(fmtAddr).join(', ') }}</dd>
          </template>
          <template v-if="result.mail.date">
            <dt class="text-ink-400">日期</dt>
            <dd class="text-ink-700">{{ result.mail.date }}</dd>
          </template>
        </dl>
      </div>

      <!-- 純文字內文 -->
      <div v-if="result.mail.text" class="card p-5 space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-ink-700">純文字內文</h3>
          <button type="button" class="text-xs text-brand-700 hover:underline" @click="copy(result.mail!.text)">複製</button>
        </div>
        <pre class="whitespace-pre-wrap break-words rounded-lg bg-ink-50 p-3 text-sm text-ink-700">{{ result.mail.text }}</pre>
      </div>

      <!-- HTML 內文(以原始碼呈現,不載入遠端內容) -->
      <div v-if="result.mail.html" class="card p-5 space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-ink-700">HTML 內文</h3>
          <div class="flex gap-3">
            <button type="button" class="text-xs text-brand-700 hover:underline" @click="showHtmlSource = !showHtmlSource">
              {{ showHtmlSource ? '隱藏原始碼' : '顯示原始碼' }}
            </button>
            <button type="button" class="text-xs text-brand-700 hover:underline" @click="copy(result.mail!.html)">複製</button>
          </div>
        </div>
        <p class="text-xs text-ink-500">為保護隱私,HTML 不直接渲染(避免載入遠端追蹤圖片);如需檢視排版請複製後在信任的環境開啟。</p>
        <pre v-if="showHtmlSource" class="whitespace-pre-wrap break-words rounded-lg bg-ink-50 p-3 text-xs text-ink-600 max-h-96 overflow-auto">{{ result.mail.html }}</pre>
      </div>

      <!-- 附件 -->
      <div v-if="result.mail.attachments.length" class="card p-5 space-y-2">
        <h3 class="text-sm font-semibold text-ink-700">附件 / 內嵌內容({{ result.mail.attachments.length }})</h3>
        <ul class="divide-y divide-ink-100">
          <li v-for="(att, i) in result.mail.attachments" :key="i" class="flex items-center justify-between gap-3 py-2">
            <div class="min-w-0">
              <div class="truncate text-sm font-medium text-ink-800">{{ att.filename || '(未命名)' }}</div>
              <div class="text-xs text-ink-400">{{ att.contentType }} · {{ formatBytes(att.size) }}</div>
            </div>
            <button type="button" class="shrink-0 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600" @click="download(att)">
              下載
            </button>
          </li>
        </ul>
      </div>

      <!-- MIME 結構 -->
      <div class="card p-5 space-y-2">
        <h3 class="text-sm font-semibold text-ink-700">MIME 結構</h3>
        <ul class="space-y-0.5 font-mono text-xs">
          <li v-for="(row, i) in tree" :key="i" class="flex gap-2" :style="{ paddingLeft: row.depth * 16 + 'px' }">
            <span class="text-ink-700">{{ row.label }}</span>
            <span class="text-ink-400">{{ row.detail }}</span>
          </li>
        </ul>
      </div>
    </template>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>收到 <code>.eml</code> 信件檔(或在 Gmail/Outlook 選「顯示原始郵件」存下的檔)時,不必匯入信箱就能<strong>看清楚主旨、寄件者、內文與附件</strong>。</li>
        <li>主旨/寄件者常是 <code>=?UTF-8?B?…?=</code> 這種亂碼,內文是 <code>quoted-printable</code> 或 <code>base64</code> 編碼 —— 本工具<strong>自動還原成可讀文字</strong>,附件可直接下載。</li>
        <li>為防隱私外洩,<strong>HTML 內文不直接渲染</strong>(不載入遠端追蹤圖片 / beacon),只呈現原始碼。要判斷是不是釣魚信,搭配「郵件來源檢視 / 防冒名」看 SPF/DKIM/DMARC。</li>
        <li>全程在你瀏覽器解析,<strong>信件內容不連網、不上傳</strong>。與「.ics 行事曆檢視器」「郵件來源檢視」互補。</li>
      </ul>
    </LegalNote>
  </div>
</template>
