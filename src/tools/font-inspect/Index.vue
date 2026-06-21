<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parseFont, type FontInfo } from '@/features/font'

/*
  字型檔檢視器 —— 打開 .ttf / .otf / .ttc,看字型名稱、版本、製造商 / 設計師、授權條款、
  是否允許嵌入(fsType)、字重 / 寬度 / 樣式、字符數量、資料表清單,並即時預覽字型外觀。
  全程在你瀏覽器解析,不連網、不上傳。
*/
const info = ref<FontInfo | null>(null)
const fileName = ref('')
const previewFamily = ref('')
const previewText = ref('永 The quick brown fox 0123 字型樣式 Aa')
const previewSize = ref(40)
let loadedFace: FontFace | null = null

const NAME_LABELS: Record<string, string> = {
  family: '字型家族', subfamily: '樣式', fullName: '完整名稱', version: '版本',
  postScriptName: 'PostScript 名稱', manufacturer: '製造商', designer: '設計師',
  copyright: '著作權', trademark: '商標', license: '授權條款', licenseUrl: '授權網址',
  vendorUrl: '廠商網址', designerUrl: '設計師網址', description: '說明', uniqueId: '唯一識別',
}
const NAME_ORDER = ['family', 'subfamily', 'fullName', 'version', 'postScriptName', 'manufacturer', 'designer', 'vendorUrl', 'designerUrl', 'description', 'license', 'licenseUrl', 'copyright', 'trademark', 'uniqueId']

const orderedNames = computed(() => {
  if (!info.value) return []
  return NAME_ORDER.filter((k) => info.value!.names[k]).map((k) => ({ label: NAME_LABELS[k] || k, value: info.value!.names[k] }))
})

const styleTags = computed(() => {
  if (!info.value) return []
  const t: string[] = []
  if (info.value.bold) t.push('粗體')
  if (info.value.italic) t.push('斜體')
  if (info.value.monospaced) t.push('等寬')
  if (!t.length) t.push('一般')
  return t
})

const embedRisky = computed(() => info.value?.embedding.includes('不允許') ?? false)

async function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  fileName.value = f.name
  const buf = await f.arrayBuffer()
  info.value = parseFont(new Uint8Array(buf))
  // 即時預覽:用 FontFace 載入這份字型(僅在瀏覽器,不上傳)
  cleanupFace()
  if (!info.value.error && typeof FontFace !== 'undefined') {
    try {
      const fam = `__preview_${Date.now()}`
      const face = new FontFace(fam, buf)
      await face.load()
      ;(document.fonts as FontFaceSet).add(face)
      loadedFace = face
      previewFamily.value = fam
    } catch {
      previewFamily.value = ''
    }
  }
}

function cleanupFace() {
  if (loadedFace) { try { (document.fonts as FontFaceSet).delete(loadedFace) } catch { /* ignore */ } loadedFace = null }
  previewFamily.value = ''
}
onBeforeUnmount(cleanupFace)
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-3">
      <label class="field-label">開啟字型檔(.ttf / .otf / .ttc)</label>
      <input type="file" accept=".ttf,.otf,.ttc,font/ttf,font/otf,application/font-sfnt" class="block w-full text-sm text-ink-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-200" @change="onFile" />
      <p v-if="fileName" class="field-hint">已載入:<strong>{{ fileName }}</strong></p>
      <p class="field-hint">支援 TrueType(.ttf)、OpenType(.otf)、字型集(.ttc)。WOFF / WOFF2 網頁字型請先轉成 .ttf / .otf。全程在你瀏覽器解析,不上傳。</p>
    </div>

    <div v-if="info?.error" class="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-sm text-rose-700">
      ⚠️ {{ info.error }}
    </div>

    <template v-if="info && !info.error">
      <!-- 即時預覽 -->
      <div v-if="previewFamily" class="card p-5 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-sm font-semibold text-ink-700">即時預覽</span>
          <label class="flex items-center gap-2 text-xs text-ink-500">字級
            <input v-model.number="previewSize" type="range" min="16" max="96" class="w-32" />
            <span class="w-8 tabular-nums">{{ previewSize }}</span>
          </label>
        </div>
        <input v-model="previewText" class="field-input text-sm" placeholder="輸入預覽文字" />
        <div class="overflow-x-auto rounded-lg bg-ink-50 p-4" :style="{ fontFamily: previewFamily, fontSize: previewSize + 'px', lineHeight: 1.3 }">{{ previewText }}</div>
      </div>

      <!-- 概要 -->
      <div class="card p-5 space-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <span class="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-700">{{ info.format }}</span>
          <span v-for="t in styleTags" :key="t" class="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs text-ink-600">{{ t }}</span>
          <span v-if="info.fontCount > 1" class="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs text-ink-600">字型集({{ info.fontCount }} 款)</span>
        </div>
        <div
          class="rounded-lg border p-3 text-sm"
          :class="embedRisky ? 'border-rose-200 bg-rose-50/60 text-rose-700' : 'border-emerald-200 bg-emerald-50/60 text-emerald-800'"
        >
          {{ embedRisky ? '🔒' : '✅' }} 嵌入授權(fsType):<strong>{{ info.embedding }}</strong>
          <span class="block text-xs opacity-80 mt-0.5">把字型嵌入 PDF / 簡報 / 網頁前,請依此與授權條款確認是否允許。</span>
        </div>
      </div>

      <!-- 名稱資訊 -->
      <div v-if="orderedNames.length" class="card p-5">
        <dl class="grid gap-x-4 gap-y-2 sm:grid-cols-[8rem_1fr] text-sm">
          <template v-for="n in orderedNames" :key="n.label">
            <dt class="text-ink-500">{{ n.label }}</dt>
            <dd class="text-ink-800 break-words">{{ n.value }}</dd>
          </template>
        </dl>
      </div>

      <!-- 技術指標 -->
      <div class="card p-5">
        <dl class="grid gap-x-4 gap-y-2 sm:grid-cols-[8rem_1fr] text-sm">
          <dt class="text-ink-500">字重</dt><dd class="text-ink-800">{{ info.weightClass ?? '—' }}<span v-if="info.weightName"> · {{ info.weightName }}</span></dd>
          <dt class="text-ink-500">寬度</dt><dd class="text-ink-800">{{ info.widthClass ?? '—' }}<span v-if="info.widthName"> · {{ info.widthName }}</span></dd>
          <dt class="text-ink-500">每 em 單位</dt><dd class="text-ink-800">{{ info.unitsPerEm ?? '—' }}</dd>
          <dt class="text-ink-500">字符數</dt><dd class="text-ink-800">{{ info.numGlyphs?.toLocaleString() ?? '—' }}</dd>
          <dt class="text-ink-500">cmap 編碼表</dt><dd class="text-ink-800">{{ info.cmapSubtables ?? '—' }} 個</dd>
          <dt v-if="info.bbox" class="text-ink-500">字框 bbox</dt><dd v-if="info.bbox" class="text-ink-800 font-mono text-xs">{{ info.bbox.xMin }}, {{ info.bbox.yMin }} → {{ info.bbox.xMax }}, {{ info.bbox.yMax }}</dd>
          <dt v-if="info.created" class="text-ink-500">建立時間</dt><dd v-if="info.created" class="text-ink-800 font-mono text-xs">{{ info.created.replace('T', ' ').replace('.000Z', ' UTC') }}</dd>
          <dt v-if="info.modified" class="text-ink-500">修改時間</dt><dd v-if="info.modified" class="text-ink-800 font-mono text-xs">{{ info.modified.replace('T', ' ').replace('.000Z', ' UTC') }}</dd>
        </dl>
      </div>

      <!-- 資料表 -->
      <div class="card p-5 space-y-2">
        <div class="text-sm font-semibold text-ink-700">資料表({{ info.tables.length }})</div>
        <div class="flex flex-wrap gap-1.5">
          <span v-for="t in info.tables" :key="t.tag" class="rounded bg-ink-100 px-2 py-0.5 font-mono text-xs text-ink-700" :title="t.length + ' 位元組'">{{ t.tag.trim() }}</span>
        </div>
      </div>
    </template>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>打開一個字型檔不必裝任何軟體,就能看到<strong>這是什麼字型</strong>(家族 / 樣式 / 完整名稱)、版本、製造商 / 設計師、<strong>著作權與授權條款</strong>。</li>
        <li>重點看<strong>是否允許嵌入(fsType)</strong> —— 把字型放進 PDF、簡報或網頁前,先確認授權是否允許,避免侵權。</li>
        <li>也顯示字重 / 寬度 / 斜體 / 等寬、每 em 單位、字符(glyph)數量、建立 / 修改日期與包含哪些資料表,並能<strong>即時預覽</strong>字型外觀。</li>
        <li>支援 TrueType(.ttf)、OpenType(.otf)、字型集(.ttc);WOFF / WOFF2 請先轉成 .ttf / .otf。字型檔<strong>全程在你瀏覽器解析,不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
