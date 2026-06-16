<script setup lang="ts">
import { ref } from 'vue'
import { compressPdfViaRaster, downloadBlob, fmtSize, type CompressOpts } from './lib'

/*
  壓縮 PDF —— 把每頁渲染成 JPEG 再重組,對「手機掃描/圖片很多」的 PDF 大幅縮小,寄信不再超大。
  代價:文字會變成影像、無法再選取/搜尋。全程在瀏覽器處理、不上傳。
*/
const file = ref<File | null>(null)
const level = ref<'high' | 'medium' | 'low'>('medium')
const busy = ref(false)
const error = ref('')
const progress = ref(0)
const total = ref(0)
const result = ref<{ before: number; after: number; bytes: Uint8Array; name: string } | null>(null)

// 壓縮強度 → 渲染倍率 + JPEG 品質。越強越小越糊。
const presets: Record<string, CompressOpts & { label: string; hint: string }> = {
  high: { scale: 1.0, quality: 0.5, label: '最小檔(較糊)', hint: '寄信、上傳優先,文字仍可閱讀' },
  medium: { scale: 1.3, quality: 0.65, label: '平衡(建議)', hint: '檔案明顯變小,畫質尚清楚' },
  low: { scale: 1.6, quality: 0.8, label: '保畫質', hint: '縮得少一點,字跡較清晰' },
}

function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f && (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))) {
    file.value = f
    error.value = ''
    result.value = null
  }
  ;(e.target as HTMLInputElement).value = ''
}

async function run() {
  if (!file.value) return
  busy.value = true
  error.value = ''
  result.value = null
  progress.value = 0
  total.value = 0
  try {
    const before = file.value.size
    const p = presets[level.value]
    const bytes = await compressPdfViaRaster(
      await file.value.arrayBuffer(),
      { scale: p.scale, quality: p.quality },
      (done, tot) => {
        progress.value = done
        total.value = tot
      },
    )
    const base = file.value.name.replace(/\.[^.]+$/, '')
    result.value = { before, after: bytes.byteLength, bytes, name: `${base}_壓縮.pdf` }
  } catch (e) {
    error.value = '處理失敗,可能檔案損毀或受密碼保護:' + (e as Error).message
  } finally {
    busy.value = false
  }
}

function save() {
  if (!result.value) return
  downloadBlob(
    new Blob([result.value.bytes as BlobPart], { type: 'application/pdf' }),
    result.value.name,
  )
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="field-label">選擇要壓縮的 PDF</label>
      <input type="file" accept="application/pdf" class="field-input" @change="onFile" />
      <p class="field-hint">
        <template v-if="file">已選:📄 {{ file.name }}（{{ fmtSize(file.size) }}）</template>
        <template v-else>檔案只在你的瀏覽器處理,不會上傳。最適合手機掃描、相片很多的 PDF。</template>
      </p>
    </div>

    <div>
      <label class="field-label">壓縮強度</label>
      <div class="grid gap-2 sm:grid-cols-3">
        <button
          v-for="(p, key) in presets"
          :key="key"
          type="button"
          class="rounded-xl border px-3 py-3 text-left transition"
          :class="level === key
            ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-300'
            : 'border-line bg-white hover:bg-stone-50'"
          @click="level = key as 'high' | 'medium' | 'low'"
        >
          <div class="font-semibold text-ink-900">{{ p.label }}</div>
          <div class="mt-0.5 text-xs text-ink-500">{{ p.hint }}</div>
        </button>
      </div>
    </div>

    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

    <button class="btn-primary w-full sm:w-auto" :disabled="!file || busy" @click="run">
      {{ busy ? (total ? `壓縮中… ${progress}/${total} 頁` : '壓縮中…') : !file ? '請先選擇 PDF' : '開始壓縮' }}
    </button>

    <div v-if="result" class="rounded-xl border border-line bg-stone-50 p-4">
      <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span class="text-ink-600">原始:<strong class="text-ink-900">{{ fmtSize(result.before) }}</strong></span>
        <span class="text-ink-400">→</span>
        <span class="text-ink-600">壓縮後:<strong class="text-ink-900">{{ fmtSize(result.after) }}</strong></span>
        <span
          v-if="result.after < result.before"
          class="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700"
        >
          省下 {{ Math.round((1 - result.after / result.before) * 100) }}%
        </span>
        <span
          v-else
          class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700"
        >
          沒有變小,建議保留原檔
        </span>
      </div>
      <button class="btn-primary mt-3 w-full sm:w-auto" @click="save">下載壓縮後的 PDF</button>
      <p class="field-hint mt-2">
        若沒變小(原本就是文字 PDF),代表這份檔案不適合用此法壓縮 —— 直接用原檔即可。
      </p>
    </div>

    <p class="field-hint">
      ⚠️ 此法把每頁轉成影像重組:檔案會變小,但<strong>文字會變成圖片、無法再選取或搜尋</strong>。
      需要保留可選取文字時請勿使用。
    </p>
  </div>
</template>
