<script setup lang="ts">
import { ref, computed } from 'vue'
import JSZip from 'jszip'
import LegalNote from '@/components/LegalNote.vue'
import { htmlToText } from '@/features/htmlToText'
import {
  parseContainer, parseOpf, findCoverHref, parseNcx, parseNav, resolveHref,
  type Opf, type TocEntry,
} from '@/features/epub'

/*
  EPUB 電子書檢視器 —— 打開 .epub,看書名 / 作者 / 出版資訊 / 封面 / 目錄,
  並能離線把章節轉成乾淨純文字閱讀(不載入遠端追蹤圖片)。電子書全程在你瀏覽器解析,不上傳。
*/
const fileName = ref('')
const loading = ref(false)
const error = ref('')
const opf = ref<Opf | null>(null)
const coverUrl = ref('')
const toc = ref<TocEntry[]>([])
const totalChars = ref(0)
const zipRef = ref<JSZip | null>(null)

// 目前閱讀的章節
const chapterTitle = ref('')
const chapterText = ref('')
const chapterLoading = ref(false)

function reset() {
  error.value = ''
  opf.value = null
  if (coverUrl.value) URL.revokeObjectURL(coverUrl.value)
  coverUrl.value = ''
  toc.value = []
  totalChars.value = 0
  chapterTitle.value = ''
  chapterText.value = ''
  zipRef.value = null
}

async function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  reset()
  fileName.value = f.name
  loading.value = true
  try {
    const zip = await JSZip.loadAsync(await f.arrayBuffer())
    zipRef.value = zip
    const containerFile = zip.file('META-INF/container.xml')
    if (!containerFile) throw new Error('找不到 META-INF/container.xml,可能不是有效的 EPUB')
    const opfPath = parseContainer(await containerFile.async('string'))
    if (!opfPath) throw new Error('container.xml 未指向 OPF 檔')
    const opfFile = zip.file(opfPath)
    if (!opfFile) throw new Error(`找不到 OPF 檔:${opfPath}`)
    const parsed = parseOpf(await opfFile.async('string'), opfPath)
    opf.value = parsed

    // 封面
    const coverHref = findCoverHref(parsed)
    if (coverHref) {
      const cf = zip.file(coverHref)
      if (cf) {
        const blob = await cf.async('blob')
        coverUrl.value = URL.createObjectURL(blob)
      }
    }

    // 目錄:EPUB3 nav 優先,再退回 EPUB2 ncx
    const navItem = parsed.manifest.find((i) => (i.properties || '').split(/\s+/).includes('nav'))
    const ncxItem = parsed.manifest.find((i) => i.mediaType === 'application/x-dtbncx+xml')
    if (navItem) {
      const nf = zip.file(resolveHref(parsed.opfDir, navItem.href))
      if (nf) toc.value = parseNav(await nf.async('string'), parsed.opfDir)
    }
    if (!toc.value.length && ncxItem) {
      const nf = zip.file(resolveHref(parsed.opfDir, ncxItem.href))
      if (nf) toc.value = parseNcx(await nf.async('string'), parsed.opfDir)
    }

    // 估算總字數(掃描 spine 各章 XHTML)
    let chars = 0
    for (const idref of parsed.spine) {
      const it = parsed.manifest.find((i) => i.id === idref)
      if (!it) continue
      const cf = zip.file(resolveHref(parsed.opfDir, it.href))
      if (cf) chars += htmlToText(await cf.async('string')).replace(/\s/g, '').length
    }
    totalChars.value = chars
  } catch (err) {
    error.value = err instanceof Error ? err.message : '解析失敗'
  } finally {
    loading.value = false
  }
}

// spine 章節清單(含標題,標題取自 TOC 對應或檔名)
const spineList = computed<{ idref: string; href: string; title: string }[]>(() => {
  if (!opf.value) return []
  const tocByHref = new Map(toc.value.map((t) => [t.href, t.label]))
  return opf.value.spine.map((idref) => {
    const it = opf.value!.manifest.find((i) => i.id === idref)
    const href = it ? resolveHref(opf.value!.opfDir, it.href) : ''
    return { idref, href, title: tocByHref.get(href) || href.split('/').pop() || idref }
  })
})

async function readChapter(href: string, title: string) {
  if (!zipRef.value || !href) return
  chapterLoading.value = true
  chapterTitle.value = title
  chapterText.value = ''
  try {
    const cf = zipRef.value.file(href)
    if (!cf) { chapterText.value = '(找不到此章節檔案)'; return }
    chapterText.value = htmlToText(await cf.async('string')) || '(本章無文字內容)'
  } catch {
    chapterText.value = '(讀取失敗)'
  } finally {
    chapterLoading.value = false
  }
}

const meta = computed(() => opf.value?.meta)
function fmtCount(n: number): string {
  if (n >= 10000) return `約 ${(n / 10000).toFixed(1)} 萬字`
  return `約 ${n.toLocaleString('en-US')} 字`
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-3">
      <label class="field-label">開啟 .epub 電子書</label>
      <input type="file" accept=".epub,application/epub+zip" class="block w-full text-sm" @change="onFile" />
      <p class="field-hint">全程在你瀏覽器解析,電子書<strong>不上傳</strong>、不連網。章節以純文字呈現,不載入遠端追蹤圖片。</p>
    </div>

    <div v-if="loading" class="card p-6 text-center text-ink-500">📖 解析中…</div>
    <div v-if="error" class="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-sm text-rose-700">⚠️ {{ error }}</div>

    <!-- 書籍資訊 -->
    <div v-if="meta && !loading" class="card p-5">
      <div class="flex flex-col gap-4 sm:flex-row">
        <img v-if="coverUrl" :src="coverUrl" alt="封面" class="h-48 w-auto self-center rounded-lg border border-ink-100 object-contain sm:self-start" />
        <div class="flex-1 space-y-2">
          <div class="flex items-center gap-2">
            <h2 class="text-lg font-semibold text-ink-900 break-all">{{ meta.title || '(無書名)' }}</h2>
            <span v-if="meta.version" class="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700">EPUB {{ meta.version }}</span>
          </div>
          <dl class="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            <div v-if="meta.creators.length"><dt class="text-ink-500">作者</dt><dd class="font-medium text-ink-900 break-all">{{ meta.creators.join('、') }}</dd></div>
            <div v-if="meta.publisher"><dt class="text-ink-500">出版社</dt><dd class="font-medium text-ink-900 break-all">{{ meta.publisher }}</dd></div>
            <div v-if="meta.date"><dt class="text-ink-500">出版日期</dt><dd class="font-medium text-ink-900">{{ meta.date }}</dd></div>
            <div v-if="meta.language"><dt class="text-ink-500">語言</dt><dd class="font-medium text-ink-900">{{ meta.language }}</dd></div>
            <div v-if="meta.identifiers.length"><dt class="text-ink-500">識別碼 / ISBN</dt><dd class="font-medium text-ink-900 break-all">{{ meta.identifiers.join('、') }}</dd></div>
            <div><dt class="text-ink-500">篇幅</dt><dd class="font-medium text-ink-900">{{ fmtCount(totalChars) }} · {{ spineList.length }} 章</dd></div>
          </dl>
          <div v-if="meta.subjects.length" class="flex flex-wrap gap-1.5 pt-1">
            <span v-for="(s, i) in meta.subjects" :key="i" class="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] text-ink-600">{{ s }}</span>
          </div>
          <p v-if="meta.description" class="pt-1 text-sm text-ink-600 whitespace-pre-line">{{ meta.description }}</p>
        </div>
      </div>
    </div>

    <!-- 目錄 / 閱讀 -->
    <div v-if="opf && !loading" class="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <div class="card p-4 space-y-2 self-start">
        <h3 class="text-sm font-semibold text-ink-700">{{ toc.length ? '目錄' : '章節' }}</h3>
        <ul class="max-h-[28rem] space-y-0.5 overflow-y-auto text-sm">
          <li v-for="(t, i) in (toc.length ? toc : spineList.map((s) => ({ label: s.title, href: s.href, depth: 0 })))" :key="i">
            <button
              type="button"
              class="w-full rounded px-2 py-1 text-left text-ink-700 hover:bg-brand-50 hover:text-brand-700"
              :style="{ paddingLeft: 8 + t.depth * 14 + 'px' }"
              @click="readChapter(t.href, t.label)"
            >{{ t.label }}</button>
          </li>
        </ul>
      </div>

      <div class="card p-5 min-h-[16rem]">
        <div v-if="chapterLoading" class="text-ink-500">讀取中…</div>
        <template v-else-if="chapterText">
          <h3 class="mb-3 text-base font-semibold text-ink-900">{{ chapterTitle }}</h3>
          <div class="prose-reader whitespace-pre-line text-[15px] leading-relaxed text-ink-800">{{ chapterText }}</div>
        </template>
        <p v-else class="text-ink-400">← 從左側點選章節,即可在此離線閱讀純文字內容。</p>
      </div>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>打開 <strong>.epub 電子書</strong>,不必裝閱讀軟體就能看書名、作者、出版社、出版日期、ISBN、分類與封面 —— 整理書庫、確認買到的檔案內容時很方便。</li>
        <li>列出完整<strong>目錄</strong>與閱讀順序,點章節即可把內文轉成<strong>乾淨純文字</strong>離線閱讀,並估算全書字數。</li>
        <li>為保護隱私,內文以純文字呈現,<strong>不載入電子書內嵌的遠端圖片 / 追蹤連結</strong>。</li>
        <li><strong>全程在你瀏覽器解析,電子書不上傳</strong>、不連網。線上 EPUB 檢視器多半要你上傳整本書,這支不會。</li>
      </ul>
    </LegalNote>
  </div>
</template>
