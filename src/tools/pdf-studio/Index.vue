<script setup lang="ts">
import { ref } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import Merge from './Merge.vue'
import Organize from './Organize.vue'
import ImagesToPdf from './ImagesToPdf.vue'
import PdfToImages from './PdfToImages.vue'
import ExtractText from './ExtractText.vue'
import Watermark from './Watermark.vue'
import PageNumbers from './PageNumbers.vue'

/*
  PDF 工坊 —— 合併、整理頁面、圖片↔PDF,全程在瀏覽器處理,不上傳。
  合併/整理/圖轉PDF 用 pdf-lib;PDF 轉圖片用 pdfjs-dist 渲染。
*/
const tabs = [
  { id: 'merge', label: '合併 PDF', icon: '🔗', desc: '多個 PDF 串成一份' },
  { id: 'organize', label: '整理頁面', icon: '✂️', desc: '刪頁、重排、擷取頁面' },
  { id: 'img2pdf', label: '圖片轉 PDF', icon: '🖼️', desc: '多張圖合成一份 PDF' },
  { id: 'pdf2img', label: 'PDF 轉圖片', icon: '📸', desc: '每頁存成 PNG/JPG' },
  { id: 'extract', label: '取出文字', icon: '📝', desc: '抽出可選取文字複製' },
  { id: 'watermark', label: 'PDF 浮水印', icon: '🖋️', desc: '每頁加註用途防盜用' },
  { id: 'pagenum', label: 'PDF 頁碼', icon: '🔢', desc: '每頁加上頁碼編號' },
] as const

const active = ref<(typeof tabs)[number]['id']>('merge')
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 sm:p-6 space-y-5">
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <button
          v-for="t in tabs"
          :key="t.id"
          class="rounded-xl border px-3 py-3 text-left transition"
          :class="active === t.id
            ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-300'
            : 'border-line bg-white hover:bg-stone-50'"
          @click="active = t.id"
        >
          <div class="flex items-center gap-1.5 font-semibold text-ink-900">
            <span>{{ t.icon }}</span><span>{{ t.label }}</span>
          </div>
          <div class="mt-0.5 text-xs text-ink-500">{{ t.desc }}</div>
        </button>
      </div>

      <Merge v-if="active === 'merge'" />
      <Organize v-else-if="active === 'organize'" />
      <ImagesToPdf v-else-if="active === 'img2pdf'" />
      <PdfToImages v-else-if="active === 'pdf2img'" />
      <ExtractText v-else-if="active === 'extract'" />
      <Watermark v-else-if="active === 'watermark'" />
      <PageNumbers v-else-if="active === 'pagenum'" />
    </div>

    <LegalNote title="為什麼用這個,而不是網路上的免費 PDF 工具?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>不上傳</strong>:合約、帳單、證件等機密文件全程留在你自己的電腦,不送到陌生伺服器。</li>
        <li><strong>無廣告、無浮水印、免註冊、不限檔數</strong>,完全免費。</li>
        <li>多數免費線上 PDF 站會把你的檔案上傳處理,並對免費用戶限制頁數或加浮水印。</li>
        <li>受密碼保護的 PDF 需先解鎖才能處理;本工具不會破解密碼。</li>
      </ul>
    </LegalNote>
  </div>
</template>
