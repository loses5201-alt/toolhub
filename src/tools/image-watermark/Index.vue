<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'

/*
  證件浮水印加註 —— 全程在瀏覽器用 Canvas 處理,不上傳任何檔案。
  影印/拍照證件給人前,在上面斜向重複加註用途(例:僅供○○開戶使用),
  萬一外流也較難被拿去他用,是內政部宣導的防盜用作法。
  純前端、可批次、無廣告、無第三方浮水印。
*/
interface Item {
  id: number
  name: string
  srcUrl: string
  origSize: number
  origW: number
  origH: number
  outUrl?: string
  outName?: string
}

const items = ref<Item[]>([])
const text = ref('僅供身分證明使用,不得移作他用')
const color = ref<'red' | 'gray' | 'white'>('red')
const opacity = ref(35) // %
const sizePct = ref(5) // 字級 = 圖片短邊 * sizePct%
const density = ref<'sparse' | 'normal' | 'dense'>('normal')
const angle = ref(-30) // 度
const format = ref<'image/jpeg' | 'image/png'>('image/jpeg')
const busy = ref(false)
let uid = 0

// 常見用途一鍵帶入(台灣最常被要求附證件影本的情境)
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
  white: '255,255,255',
}
const extOf: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png' }
const gapFactor: Record<string, number> = { sparse: 2.4, normal: 1.5, dense: 0.9 }

function fmtSize(n: number): string {
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB'
  return (n / 1024 / 1024).toFixed(2) + ' MB'
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

async function onFiles(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (!files) return
  for (const f of Array.from(files)) {
    if (!f.type.startsWith('image/')) continue
    const url = URL.createObjectURL(f)
    const img = await loadImage(url)
    items.value.push({
      id: ++uid,
      name: f.name,
      srcUrl: url,
      origSize: f.size,
      origW: img.naturalWidth,
      origH: img.naturalHeight,
    })
  }
  ;(e.target as HTMLInputElement).value = ''
}

async function processOne(it: Item) {
  const img = await loadImage(it.srcUrl)
  const w = img.naturalWidth
  const h = img.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  if (format.value === 'image/jpeg') {
    ctx.fillStyle = '#fff' // JPG 無透明,底色填白避免變黑
    ctx.fillRect(0, 0, w, h)
  }
  ctx.drawImage(img, 0, 0, w, h)

  const label = text.value.trim()
  if (label) {
    const fontPx = Math.max(12, Math.round(Math.min(w, h) * (sizePct.value / 100)))
    ctx.font = `bold ${fontPx}px "Noto Sans TC", "Microsoft JhengHei", sans-serif`
    ctx.fillStyle = `rgba(${colorRGB[color.value]},${opacity.value / 100})`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const textW = ctx.measureText(label).width
    const stepX = (textW + fontPx) * gapFactor[density.value]
    const stepY = fontPx * 2 * gapFactor[density.value]
    // 旋轉後在足以覆蓋整張圖的範圍(對角線)平鋪重複文字
    const diag = Math.sqrt(w * w + h * h)
    ctx.save()
    ctx.translate(w / 2, h / 2)
    ctx.rotate((angle.value * Math.PI) / 180)
    for (let y = -diag; y <= diag; y += stepY) {
      for (let x = -diag; x <= diag; x += stepX) {
        ctx.fillText(label, x, y)
      }
    }
    ctx.restore()
  }

  const blob: Blob = await new Promise((res) =>
    canvas.toBlob((b) => res(b!), format.value, 0.92),
  )
  if (it.outUrl) URL.revokeObjectURL(it.outUrl)
  it.outUrl = URL.createObjectURL(blob)
  it.outName = it.name.replace(/\.[^.]+$/, '') + '_浮水印.' + extOf[format.value]
}

async function processAll() {
  busy.value = true
  try {
    for (const it of items.value) await processOne(it)
  } finally {
    busy.value = false
  }
}

function remove(id: number) {
  const i = items.value.findIndex((x) => x.id === id)
  if (i >= 0) {
    const it = items.value[i]
    URL.revokeObjectURL(it.srcUrl)
    if (it.outUrl) URL.revokeObjectURL(it.outUrl)
    items.value.splice(i, 1)
  }
}

const done = computed(() => items.value.filter((it) => it.outUrl).length)
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-5">
      <div>
        <label class="field-label">選擇圖片(可多選)</label>
        <input type="file" accept="image/*" multiple class="field-input" @change="onFiles" />
        <p class="field-hint">檔案只在你的瀏覽器處理,不會上傳到任何伺服器。</p>
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
            <option value="white">白色(深色底用)</option>
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

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label">傾斜角度:{{ angle }}°</label>
          <input v-model.number="angle" type="range" min="-60" max="60" step="5" class="w-full accent-brand-600" />
        </div>
        <div>
          <label class="field-label">輸出格式</label>
          <select v-model="format" class="field-input">
            <option value="image/jpeg">JPG(相片,檔小)</option>
            <option value="image/png">PNG(較清晰)</option>
          </select>
        </div>
      </div>

      <button class="btn-primary w-full sm:w-auto" :disabled="!items.length || busy" @click="processAll">
        {{ busy ? '處理中…' : `加上浮水印(${items.length} 張)` }}
      </button>
      <p v-if="done" class="text-sm text-brand-700">✅ 已完成 {{ done }} / {{ items.length }} 張,逐一點「下載」存檔。</p>
    </div>

    <div v-if="items.length" class="space-y-3">
      <div v-for="it in items" :key="it.id" class="card flex items-center gap-4 p-4">
        <img :src="it.outUrl || it.srcUrl" alt="" class="h-20 w-20 shrink-0 rounded-lg border border-line object-cover" />
        <div class="min-w-0 flex-1">
          <div class="truncate font-medium text-ink-900">{{ it.outName || it.name }}</div>
          <div class="text-sm text-ink-500">{{ it.origW }}×{{ it.origH }} · {{ fmtSize(it.origSize) }}</div>
        </div>
        <a v-if="it.outUrl" :href="it.outUrl" :download="it.outName" class="btn-primary !py-2 text-sm shrink-0">下載</a>
        <button class="shrink-0 text-ink-400 hover:text-red-500" aria-label="移除" @click="remove(it.id)">✕</button>
      </div>
    </div>

    <LegalNote title="為什麼證件影本要加註用途?">
      <ul class="list-disc pl-5 space-y-1">
        <li>內政部宣導:提供證件影本時,應<strong>加註用途並劃線</strong>(如「僅供○○使用」),萬一外流也較難被冒用去辦門號、開戶、貸款。</li>
        <li>本工具把文字<strong>直接燒進像素</strong>並可調高密度,不像可移除的圖層浮水印,較難被後製去除。</li>
        <li><strong>全程在你瀏覽器處理、不上傳</strong>,無廣告、無第三方浮水印、可批次。重要證件交付前先加註,保護自己。</li>
        <li>若還要遮住部分號碼,可搭配「圖片遮蔽」工具一起用。本結果僅供自我保護參考。</li>
      </ul>
    </LegalNote>
  </div>
</template>
