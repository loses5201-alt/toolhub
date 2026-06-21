<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parseVcards, type VcardContact } from '@/features/vcardParse'

/*
  vCard(.vcf)檢視 / 分割器 —— 開啟 Google 通訊錄 / iCloud / Android 匯出的 .vcf,
  列出每張名片(姓名、電話、Email、公司、職稱),可搜尋、單張或整批下載。
  全程在你瀏覽器解析,聯絡人不連網、不上傳。
*/
const raw = ref('')
const fileName = ref('')
const query = ref('')

const SAMPLE = `BEGIN:VCARD
VERSION:3.0
N:王;小明;;;
FN:王小明
ORG:範例科技;研發部
TITLE:資深工程師
TEL;TYPE=CELL:0912-345-678
EMAIL;TYPE=INTERNET:ming@example.com
END:VCARD
BEGIN:VCARD
VERSION:3.0
FN:Alice Chen
TEL;TYPE=WORK:02-2345-6789
EMAIL:alice@example.com
END:VCARD`

function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  fileName.value = f.name
  const reader = new FileReader()
  reader.onload = () => { raw.value = String(reader.result || '') }
  reader.readAsText(f) // vCard 多為 UTF-8
}

const contacts = computed<VcardContact[]>(() => {
  if (!raw.value.trim()) return []
  try { return parseVcards(raw.value) } catch { return [] }
})
const parsed = computed(() => raw.value.trim().length > 0)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return contacts.value
  return contacts.value.filter((c) => {
    const hay = [c.fn, c.org, c.title, ...c.tels.map((t) => t.value), ...c.emails.map((e) => e.value)].join(' ').toLowerCase()
    return hay.includes(q)
  })
})

function safeName(c: VcardContact, i: number): string {
  const base = (c.fn || 'contact').replace(/[\\/:*?"<>|]/g, '_').slice(0, 50).trim() || 'contact'
  return `${String(i + 1).padStart(3, '0')}-${base}.vcf`
}

function downloadText(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/vcard;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function downloadOne(c: VcardContact, i: number) {
  downloadText(c.raw, safeName(c, i))
}

function downloadCsv() {
  const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`
  const head = ['姓名', '電話', 'Email', '公司', '職稱']
  const rows = contacts.value.map((c) => [
    c.fn,
    c.tels.map((t) => t.value).join(' / '),
    c.emails.map((e) => e.value).join(' / '),
    c.org,
    c.title,
  ].map(esc).join(','))
  downloadText('﻿' + [head.map(esc).join(','), ...rows].join('\r\n'), (fileName.value.replace(/\.vcf$/i, '') || '通訊錄') + '.csv')
}

function typeLabel(types: string[]): string {
  const map: Record<string, string> = { CELL: '手機', MOBILE: '手機', WORK: '公司', HOME: '住家', FAX: '傳真', MAIN: '主要', INTERNET: '' }
  return types.map((t) => map[t] ?? t).filter(Boolean).join('·')
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div class="flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept=".vcf,text/vcard,text/x-vcard"
          class="block text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-brand-500 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-brand-600"
          @change="onFile"
        />
        <button type="button" class="text-sm text-brand-700 hover:underline" @click="raw = SAMPLE; fileName = ''">載入範例</button>
        <span v-if="fileName" class="text-sm text-ink-500">{{ fileName }}</span>
      </div>
      <div>
        <label class="field-label">或直接貼上 .vcf 內容</label>
        <textarea v-model="raw" rows="5" class="field-input font-mono text-sm" placeholder="BEGIN:VCARD&#10;..." spellcheck="false"></textarea>
        <p class="field-hint">支援 Google 通訊錄、iCloud、Android 匯出的 .vcf(vCard 2.1 / 3.0 / 4.0)。全程在你瀏覽器解析,聯絡人不上傳。</p>
      </div>
    </div>

    <div v-if="parsed && !contacts.length" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
      ⚠️ 找不到名片(VCARD)。請確認這是有效的 .vcf 通訊錄檔。
    </div>

    <div v-if="contacts.length" class="space-y-3">
      <div class="card p-4 flex flex-wrap items-center gap-3">
        <div class="text-sm font-semibold text-ink-700">共 {{ contacts.length }} 張名片</div>
        <input v-model="query" type="search" placeholder="搜尋姓名 / 電話 / Email / 公司…" class="field-input max-w-xs flex-1 text-sm" />
        <button type="button" class="rounded-lg border border-brand-200 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50" @click="downloadCsv">匯出 CSV</button>
      </div>

      <div v-if="query && !filtered.length" class="text-sm text-ink-500">沒有符合「{{ query }}」的名片。</div>

      <ul class="grid gap-3 sm:grid-cols-2">
        <li v-for="(c, i) in filtered" :key="i" class="card p-4 space-y-2">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="truncate font-semibold text-ink-800">{{ c.fn || '(無姓名)' }}</div>
              <div v-if="c.title || c.org" class="truncate text-xs text-ink-400">
                <span v-if="c.title">{{ c.title }}</span><span v-if="c.title && c.org"> · </span><span v-if="c.org">{{ c.org }}</span>
              </div>
            </div>
            <button type="button" class="shrink-0 rounded-lg border border-ink-200 px-2.5 py-1 text-xs font-semibold text-ink-600 hover:bg-ink-50" @click="downloadOne(c, contacts.indexOf(c))">.vcf</button>
          </div>
          <dl class="space-y-0.5 text-sm">
            <div v-for="(t, k) in c.tels" :key="'t' + k" class="flex gap-2">
              <dt class="shrink-0 text-xs text-ink-400">{{ typeLabel(t.types) || '電話' }}</dt>
              <dd class="text-ink-700">{{ t.value }}</dd>
            </div>
            <div v-for="(e, k) in c.emails" :key="'e' + k" class="flex gap-2">
              <dt class="shrink-0 text-xs text-ink-400">Email</dt>
              <dd class="truncate text-ink-700">{{ e.value }}</dd>
            </div>
            <div v-for="(a, k) in c.adrs" :key="'a' + k" class="flex gap-2">
              <dt class="shrink-0 text-xs text-ink-400">{{ typeLabel(a.types) || '地址' }}</dt>
              <dd class="text-ink-600">{{ a.value }}</dd>
            </div>
            <div v-if="c.bday" class="flex gap-2"><dt class="shrink-0 text-xs text-ink-400">生日</dt><dd class="text-ink-600">{{ c.bday }}</dd></div>
          </dl>
          <p v-if="c.note" class="whitespace-pre-wrap rounded-lg bg-ink-50 p-2 text-xs text-ink-500">{{ c.note }}</p>
        </li>
      </ul>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>Google 通訊錄、iCloud、Android 匯出的 <code>.vcf</code> 常是<strong>一個檔塞了上百張名片</strong>,用記事本開全是欄位代碼 —— 這支幫你<strong>列成一張張看得懂的名片</strong>,可搜尋姓名 / 電話 / Email / 公司。</li>
        <li>可<strong>單張另存 .vcf</strong>(分一張給別人不用全給),或<strong>整批匯出成 CSV</strong>(用 Excel / Google 試算表開、做合併列印)。</li>
        <li>支援 vCard 2.1 / 3.0 / 4.0,含折行還原、跳脫字元、QUOTED-PRINTABLE 編碼姓名。</li>
        <li>通訊錄全是親友隱私,線上 vCard 工具卻要你整本上傳 —— 本工具<strong>全程在你瀏覽器解析,不連網、不上傳</strong>。與「電子名片產生器」「合併列印」互補。</li>
      </ul>
    </LegalNote>
  </div>
</template>
