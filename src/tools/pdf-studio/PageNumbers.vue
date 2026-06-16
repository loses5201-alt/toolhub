<script setup lang="ts">
import { ref } from 'vue'
import { addPageNumbers, downloadBlob, fmtSize, type PageNumberOpts } from './lib'

/*
  PDF 頁碼 —— 在每頁加上「第 X 頁」「X / Y」等頁碼,交付合約/報告前自動編號。
  頁碼用 canvas 畫成圖蓋上去(支援中文),全程在瀏覽器處理、不上傳。
*/
const file = ref<File | null>(null)
const template = ref('{n} / {total}')
const position = ref<PageNumberOpts['position']>('bottom-center')
const color = ref<'gray' | 'black' | 'blue'>('gray')
const sizePct = ref(2.5)
const startAt = ref(1)
const skipFirst = ref(false)
const busy = ref(false)
const error = ref('')

const presets: { label: string; value: string }[] = [
  { label: '1 / 10', value: '{n} / {total}' },
  { label: '1', value: '{n}' },
  { label: '第 1 頁', value: '第 {n} 頁' },
  { label: '第 1 頁,共 10 頁', value: '第 {n} 頁,共 {total} 頁' },
  { label: '- 1 -', value: '- {n} -' },
  { label: 'Page 1', value: 'Page {n}' },
]

const positions: { label: string; value: PageNumberOpts['position'] }[] = [
  { label: '左上', value: 'top-left' },
  { label: '中上', value: 'top-center' },
  { label: '右上', value: 'top-right' },
  { label: '左下', value: 'bottom-left' },
  { label: '中下', value: 'bottom-center' },
  { label: '右下', value: 'bottom-right' },
]

const colorRGB: Record<string, string> = {
  gray: '55,65,81',
  black: '17,24,39',
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
  if (!file.value || !template.value.trim()) return
  busy.value = true
  error.value = ''
  try {
    const opts: PageNumberOpts = {
      template: template.value,
      position: position.value,
      startAt: Math.max(0, startAt.value || 1),
      skipFirst: skipFirst.value,
      sizePct: sizePct.value,
      colorRGB: colorRGB[color.value],
      marginPt: 28,
    }
    const bytes = await addPageNumbers(await file.value.arrayBuffer(), opts)
    const base = file.value.name.replace(/\.[^.]+$/, '')
    downloadBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `${base}_頁碼.pdf`)
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
      <label class="field-label">選擇要加頁碼的 PDF</label>
      <input type="file" accept="application/pdf" class="field-input" @change="onFile" />
      <p class="field-hint">
        <template v-if="file">已選:📄 {{ file.name }}（{{ fmtSize(file.size) }}）</template>
        <template v-else>檔案只在你的瀏覽器處理,不會上傳。頁碼會加在每一頁上。</template>
      </p>
    </div>

    <div>
      <label class="field-label">頁碼格式</label>
      <input
        v-model="template"
        type="text"
        maxlength="40"
        placeholder="可用 {n} 代表頁碼、{total} 代表總頁數"
        class="field-input"
      />
      <div class="mt-2 flex flex-wrap gap-2">
        <button
          v-for="p in presets"
          :key="p.value"
          type="button"
          class="rounded-full border border-line bg-white px-3 py-1 text-xs text-ink-700 transition hover:border-brand-300 hover:text-brand-700"
          @click="template = p.value"
        >
          {{ p.label }}
        </button>
      </div>
      <p class="field-hint">輸入框可自訂,例:<code>{n} / {total}</code>。{total} 會等於最後一頁印出的號碼。</p>
    </div>

    <div>
      <label class="field-label">位置</label>
      <div class="grid grid-cols-3 gap-2">
        <button
          v-for="p in positions"
          :key="p.value"
          type="button"
          class="rounded-lg border px-3 py-2 text-sm transition"
          :class="position === p.value
            ? 'border-brand-500 bg-brand-50 text-brand-700'
            : 'border-line bg-white text-ink-700 hover:bg-stone-50'"
          @click="position = p.value"
        >
          {{ p.label }}
        </button>
      </div>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <label class="field-label">文字顏色</label>
        <select v-model="color" class="field-input">
          <option value="gray">深灰(柔和)</option>
          <option value="black">黑色</option>
          <option value="blue">藍色</option>
        </select>
      </div>
      <div>
        <label class="field-label">起始頁碼</label>
        <input v-model.number="startAt" type="number" min="0" max="9999" class="field-input" />
      </div>
      <div>
        <label class="field-label">字級:{{ sizePct }}%</label>
        <input v-model.number="sizePct" type="range" min="1.5" max="5" step="0.5" class="w-full accent-brand-600" />
      </div>
      <div class="flex items-end">
        <label class="flex items-center gap-2 text-sm text-ink-700">
          <input v-model="skipFirst" type="checkbox" class="h-4 w-4 accent-brand-600" />
          第一頁不標(封面)
        </label>
      </div>
    </div>

    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

    <button class="btn-primary w-full sm:w-auto" :disabled="!file || !template.trim() || busy" @click="run">
      {{ busy ? '處理中…' : !file ? '請先選擇 PDF' : '加上頁碼並下載' }}
    </button>
    <p class="field-hint">提示:頁碼直接合進每頁內容;若你的內容延伸到頁緣,頁碼可能與文字重疊,可改放其他角落。</p>
  </div>
</template>
