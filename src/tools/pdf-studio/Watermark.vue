<script setup lang="ts">
import { ref } from 'vue'
import { watermarkPdf, downloadBlob, fmtSize, type PdfWatermarkOpts } from './lib'

/*
  PDF 浮水印 —— 在每頁斜向重複加註用途(例:僅供開戶使用),交付證件/合約 PDF 影本前防盜用。
  浮水印用 canvas 畫成圖蓋上去(支援中文),全程在瀏覽器處理、不上傳。
*/
const file = ref<File | null>(null)
const text = ref('僅供身分證明使用,不得移作他用')
const color = ref<'red' | 'gray' | 'blue'>('red')
const opacity = ref(30) // %
const sizePct = ref(5)
const density = ref<'sparse' | 'normal' | 'dense'>('normal')
const angle = ref(-30)
const busy = ref(false)
const error = ref('')

const presets = [
  '僅供身分證明使用,不得移作他用',
  '僅供○○銀行開戶使用',
  '僅供申辦門號使用',
  '僅供租屋簽約使用',
  '僅供報名/應徵使用',
  '影本與正本相符',
]

const colorRGB: Record<string, string> = {
  red: '220,38,38',
  gray: '55,65,81',
  blue: '37,99,235',
}

function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f && (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))) {
    file.value = f
    error.value = ''
  }
  ;(e.target as HTMLInputElement).value = ''
}

async function run() {
  if (!file.value || !text.value.trim()) return
  busy.value = true
  error.value = ''
  try {
    const opts: PdfWatermarkOpts = {
      text: text.value,
      colorRGB: colorRGB[color.value],
      opacity: opacity.value / 100,
      angleDeg: angle.value,
      density: density.value,
      sizePct: sizePct.value,
    }
    const bytes = await watermarkPdf(await file.value.arrayBuffer(), opts)
    const base = file.value.name.replace(/\.[^.]+$/, '')
    downloadBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `${base}_浮水印.pdf`)
  } catch (e) {
    error.value = '處理失敗,可能檔案損毀或受密碼保護:' + (e as Error).message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="field-label">選擇要加浮水印的 PDF</label>
      <input type="file" accept="application/pdf" class="field-input" @change="onFile" />
      <p class="field-hint">
        <template v-if="file">已選:📄 {{ file.name }}（{{ fmtSize(file.size) }}）</template>
        <template v-else>檔案只在你的瀏覽器處理,不會上傳。浮水印會蓋在每一頁上。</template>
      </p>
    </div>

    <div>
      <label class="field-label">加註文字</label>
      <input v-model="text" type="text" maxlength="40" placeholder="例:僅供○○銀行開戶使用" class="field-input" />
      <div class="mt-2 flex flex-wrap gap-2">
        <button
          v-for="p in presets"
          :key="p"
          type="button"
          class="rounded-full border border-line bg-white px-3 py-1 text-xs text-ink-700 transition hover:border-brand-300 hover:text-brand-700"
          @click="text = p"
        >
          {{ p }}
        </button>
      </div>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <label class="field-label">文字顏色</label>
        <select v-model="color" class="field-input">
          <option value="red">紅色(最醒目)</option>
          <option value="gray">深灰</option>
          <option value="blue">藍色</option>
        </select>
      </div>
      <div>
        <label class="field-label">密度</label>
        <select v-model="density" class="field-input">
          <option value="sparse">疏</option>
          <option value="normal">中</option>
          <option value="dense">密(最難去除)</option>
        </select>
      </div>
      <div>
        <label class="field-label">透明度:{{ opacity }}%</label>
        <input v-model.number="opacity" type="range" min="10" max="80" class="w-full accent-brand-600" />
      </div>
      <div>
        <label class="field-label">字級:{{ sizePct }}%</label>
        <input v-model.number="sizePct" type="range" min="2" max="12" class="w-full accent-brand-600" />
      </div>
    </div>

    <div>
      <label class="field-label">傾斜角度:{{ angle }}°</label>
      <input v-model.number="angle" type="range" min="-60" max="60" step="5" class="w-full accent-brand-600" />
    </div>

    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

    <button class="btn-primary w-full sm:w-auto" :disabled="!file || !text.trim() || busy" @click="run">
      {{ busy ? '處理中…' : !file ? '請先選擇 PDF' : '加上浮水印並下載' }}
    </button>
    <p class="field-hint">提示:浮水印直接合進每頁內容,不是可單獨刪除的圖層,較難被後製去除。</p>
  </div>
</template>
