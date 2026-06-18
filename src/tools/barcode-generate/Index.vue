<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { validateBarcode, type BarcodeFormat } from '@/features/barcode'

/*
  條碼產生器 —— 把文字/數字/商品編號做成一維條碼(CODE128 / EAN-13 / EAN-8 / UPC / CODE39 / ITF-14),
  全程在你瀏覽器用 JsBarcode 產生,不上傳、不追蹤。
  線上條碼產生器常滿是廣告、限制數量或偷塞追蹤;本工具直接編碼你的原始內容,
  可下載清晰向量 SVG 或 PNG 直接印標籤。與 QR Code 產生器互補(QR 是二維、條碼是一維)。
*/

interface FormatDef {
  id: BarcodeFormat
  name: string
  hint: string
}
const formats: FormatDef[] = [
  { id: 'CODE128', name: 'CODE128(通用)', hint: '英數+符號皆可,最常用於內部料號、資產標籤、出貨單' },
  { id: 'EAN13', name: 'EAN-13(商品)', hint: '市售商品條碼,輸入 12 碼自動補檢查碼;ISBN 書號(978/979 開頭)也是這種' },
  { id: 'EAN8', name: 'EAN-8(小商品)', hint: '版面小的商品,輸入 7 碼自動補檢查碼' },
  { id: 'UPC', name: 'UPC-A(美規)', hint: '北美零售商品,輸入 11 碼自動補檢查碼' },
  { id: 'CODE39', name: 'CODE39(英數)', hint: '僅大寫英數與少數符號,常見於工廠、軍規、車牌管理' },
  { id: 'ITF14', name: 'ITF-14(外箱)', hint: '物流外箱/紙箱條碼,輸入 13 碼自動補檢查碼' },
]

const format = ref<BarcodeFormat>('CODE128')
const input = ref('')
const opts = reactive({
  width: 2, // 最細線寬(px)
  height: 80,
  displayValue: true,
  lineColor: '#1c1a17',
})

const currentDef = computed(() => formats.find((f) => f.id === format.value)!)

// 換格式時給個合適的範例,讓使用者一看就懂
const samples: Record<BarcodeFormat, string> = {
  CODE128: 'TOOLHUB-2026',
  EAN13: '471000000001',
  EAN8: '1234567',
  UPC: '03600029145',
  CODE39: 'ABC-1234',
  ITF14: '0001234567890',
}
watch(format, (f) => {
  if (!input.value.trim()) input.value = samples[f]
})

const svgEl = ref<SVGSVGElement | null>(null)
const error = ref('')
const notice = ref('')
const ok = ref(false)

async function render() {
  error.value = ''
  notice.value = ''
  ok.value = false
  const res = validateBarcode(format.value, input.value)
  if (!res.ok) {
    error.value = res.message || '無法產生條碼'
    clearSvg()
    return
  }
  notice.value = res.message || ''
  await nextTick()
  const target = svgEl.value
  if (!target) return
  try {
    const JsBarcode = (await import('jsbarcode')).default
    let valid = true
    JsBarcode(target, res.value, {
      format: format.value,
      width: opts.width,
      height: opts.height,
      displayValue: opts.displayValue,
      lineColor: opts.lineColor,
      background: '#ffffff',
      margin: 10,
      fontSize: 18,
      valid: (v: boolean) => {
        valid = v
      },
    })
    if (!valid) {
      error.value = '這組內容無法編成此格式的條碼,請檢查長度或字元'
      clearSvg()
      return
    }
    ok.value = true
  } catch {
    error.value = '產生條碼時發生錯誤,請確認輸入內容'
    clearSvg()
  }
}

function clearSvg() {
  if (svgEl.value) while (svgEl.value.firstChild) svgEl.value.removeChild(svgEl.value.firstChild)
}

watch([format, input, opts], render, { immediate: true, deep: true })

const fileBase = computed(() => `barcode-${format.value.toLowerCase()}`)

function downloadSvg() {
  if (!svgEl.value || !ok.value) return
  const xml = new XMLSerializer().serializeToString(svgEl.value)
  const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
  triggerDownload(URL.createObjectURL(blob), `${fileBase.value}.svg`, true)
}

function downloadPng() {
  if (!svgEl.value || !ok.value) return
  const svg = svgEl.value
  const w = svg.width.baseVal.value || svg.viewBox.baseVal.width || 300
  const h = svg.height.baseVal.value || svg.viewBox.baseVal.height || 150
  const scale = 3 // 印刷夠清晰
  const xml = new XMLSerializer().serializeToString(svg)
  const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = w * scale
    canvas.height = h * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    triggerDownload(canvas.toDataURL('image/png'), `${fileBase.value}.png`, false)
  }
  img.src = svgUrl
}

function triggerDownload(url: string, name: string, revoke: boolean) {
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  if (revoke) setTimeout(() => URL.revokeObjectURL(url), 1000)
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-5">
      <div>
        <div class="field-label">條碼格式</div>
        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <button
            v-for="f in formats"
            :key="f.id"
            type="button"
            class="rounded-xl border px-3 py-2 text-left text-sm transition"
            :class="format === f.id ? 'border-brand-400 bg-brand-50 text-brand-800 font-semibold' : 'border-line text-ink-700 hover:border-brand-300'"
            @click="format = f.id"
          >
            {{ f.name }}
          </button>
        </div>
        <p class="mt-2 text-sm text-ink-500">{{ currentDef.hint }}</p>
      </div>

      <div>
        <label class="field-label" for="bc-input">條碼內容</label>
        <input
          id="bc-input"
          v-model="input"
          type="text"
          autocomplete="off"
          placeholder="輸入要做成條碼的文字或數字"
          class="field-input font-mono"
        />
        <p v-if="notice" class="mt-1 text-sm text-brand-700">{{ notice }}</p>
        <p v-if="error" class="mt-1 text-sm text-red-600">{{ error }}</p>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label class="field-label">線條粗細:{{ opts.width }}</label>
          <input v-model.number="opts.width" type="range" min="1" max="4" step="1" class="w-full accent-brand-600" />
        </div>
        <div>
          <label class="field-label">高度:{{ opts.height }} px</label>
          <input v-model.number="opts.height" type="range" min="40" max="160" step="10" class="w-full accent-brand-600" />
        </div>
        <div>
          <label class="field-label" for="bc-color">線條顏色</label>
          <input id="bc-color" v-model="opts.lineColor" type="color" class="h-11 w-full rounded-xl border border-line" />
        </div>
        <label class="flex items-center gap-2 self-end pb-3 text-sm text-ink-700">
          <input v-model="opts.displayValue" type="checkbox" class="accent-brand-600" />條碼下方顯示文字
        </label>
      </div>
    </div>

    <div class="card p-6 text-center">
      <div v-show="ok" class="space-y-4">
        <div class="overflow-x-auto">
          <svg ref="svgEl" class="mx-auto max-w-full"></svg>
        </div>
        <div class="flex flex-wrap justify-center gap-3">
          <button type="button" class="btn-primary" @click="downloadPng">下載 PNG</button>
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-xl border border-line px-6 py-3 text-lg font-semibold text-ink-700 transition hover:border-brand-300 active:scale-[0.99]"
            @click="downloadSvg"
          >
            下載 SVG(向量)
          </button>
        </div>
      </div>
      <p v-if="!ok && !error" class="py-8 text-sm text-ink-500">在上面輸入內容,條碼會即時顯示在這裡。</p>
      <p v-if="!ok && error" class="py-8 text-sm text-ink-500">修正上方的輸入後,條碼就會出現。</p>
    </div>

    <LegalNote title="使用說明與小提醒">
      <ul class="list-disc pl-5 space-y-1">
        <li>全程在你瀏覽器產生,輸入的內容<strong>不會上傳</strong>到任何伺服器,也不像部分線上產生器偷塞追蹤。</li>
        <li><strong>EAN-13 / EAN-8 / UPC / ITF-14</strong> 只能是數字;少打最後一碼(檢查碼)會自動幫你算好補上。</li>
        <li><strong>書本 ISBN</strong> 就是 978/979 開頭的 EAN-13,輸入 13 碼即可生成書背條碼。</li>
        <li><strong>CODE128</strong> 最萬用(英數+符號都行),適合內部料號、資產標籤、出貨單號。</li>
        <li>要印製標籤建議<strong>下載 SVG</strong>(向量、放大不糊);貼到文件/網頁則用 PNG(已 3 倍解析度)。</li>
        <li>正式零售商品的 EAN/UPC 號碼需向 GS1 申請才具全球唯一性;本工具只負責把號碼畫成條碼,不配號。</li>
      </ul>
    </LegalNote>
  </div>
</template>
