<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { wrapText, fitFontSize } from '@/features/textCard'

/*
  社群文字卡 / 語錄圖產生器 —— 把一段文字排成漂亮的圖片卡片(IG 貼文、限動、Threads、
  FB、公告、金句),自動斷行(中英混排)、自動挑字級填滿版面。
  全程在你瀏覽器用 Canvas 繪製,文字不上傳、無廣告、無浮水印;免開 Canva、免註冊。
*/
const GRADIENTS = [
  { name: '海洋', from: '#2563eb', to: '#38bdf8' },
  { name: '夕陽', from: '#f97316', to: '#ec4899' },
  { name: '薄荷', from: '#10b981', to: '#34d399' },
  { name: '葡萄', from: '#7c3aed', to: '#c084fc' },
  { name: '珊瑚', from: '#f43f5e', to: '#fb923c' },
  { name: '晴空', from: '#0ea5e9', to: '#a78bfa' },
  { name: '墨夜', from: '#0f172a', to: '#334155' },
  { name: '奶茶', from: '#d6c2a8', to: '#b08968' },
]
const RATIOS: { id: string; label: string; w: number; h: number }[] = [
  { id: '1:1', label: '1:1 貼文', w: 1080, h: 1080 },
  { id: '4:5', label: '4:5 直式', w: 1080, h: 1350 },
  { id: '9:16', label: '9:16 限動', w: 1080, h: 1920 },
  { id: '16:9', label: '16:9 橫式', w: 1920, h: 1080 },
  { id: '3:4', label: '3:4', w: 1080, h: 1440 },
]
const FONTS: { id: string; label: string; css: string }[] = [
  { id: 'sans', label: '黑體', css: '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif' },
  { id: 'serif', label: '明體', css: '"Noto Serif TC", "Songti TC", "PMingLiU", serif' },
]

const canvasRef = ref<HTMLCanvasElement | null>(null)
const error = ref('')
const copied = ref(false)

const opt = reactive({
  text: '把想說的話貼上來,\n一鍵變成漂亮的文字卡片。',
  author: '',
  ratioId: '1:1',
  bgType: 'gradient' as 'gradient' | 'solid',
  gradient: 0,
  solid: '#1e293b',
  fontId: 'sans',
  bold: true,
  align: 'center' as 'left' | 'center',
  autoColor: true,
  textColor: '#ffffff',
  padPct: 11,
})

const ratio = computed(() => RATIOS.find((r) => r.id === opt.ratioId) ?? RATIOS[0])
const fontCss = computed(() => FONTS.find((f) => f.id === opt.fontId)?.css ?? FONTS[0].css)

// 由背景亮度自動挑黑/白字,確保可讀
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return 0
  const n = parseInt(m[1], 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function pickTextColor(): string {
  if (!opt.autoColor) return opt.textColor
  if (opt.bgType === 'solid') return luminance(opt.solid) > 0.4 ? '#1f2937' : '#ffffff'
  const g = GRADIENTS[opt.gradient]
  const avg = (luminance(g.from) + luminance(g.to)) / 2
  return avg > 0.4 ? '#1f2937' : '#ffffff'
}

function render() {
  const canvas = canvasRef.value
  if (!canvas) return
  const { w: W, h: H } = ratio.value
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, W, H)

  // 背景
  if (opt.bgType === 'gradient') {
    const g = GRADIENTS[opt.gradient]
    const grad = ctx.createLinearGradient(0, 0, W, H)
    grad.addColorStop(0, g.from)
    grad.addColorStop(1, g.to)
    ctx.fillStyle = grad
  } else {
    ctx.fillStyle = opt.solid
  }
  ctx.fillRect(0, 0, W, H)

  const text = opt.text.trim() || ' '
  const color = pickTextColor()
  const weight = opt.bold ? '700' : '400'
  const pad = Math.round((Math.min(W, H) * opt.padPct) / 100)
  const boxX = pad
  const boxW = W - pad * 2
  const boxY = pad
  const boxH = H - pad * 2
  const lineHeight = 1.32

  // 署名列預留空間
  const hasAuthor = opt.author.trim().length > 0
  const authorSize = hasAuthor ? Math.max(22, Math.round(Math.min(W, H) * 0.03)) : 0
  const authorGap = hasAuthor ? Math.round(pad * 0.5) : 0
  const authorBlock = hasAuthor ? authorSize * 1.4 + authorGap : 0
  const textBoxH = boxH - authorBlock

  // 自動字級:在文字框內挑最大可填入的字級
  const measureAt = (size: number) => {
    ctx.font = `${weight} ${size}px ${fontCss.value}`
    return (s: string) => ctx.measureText(s).width
  }
  const maxFont = Math.round(Math.min(W, H) * 0.13)
  const fontSize = fitFontSize(text, boxW, textBoxH, { min: 16, max: maxFont, lineHeight }, measureAt)

  const measure = measureAt(fontSize)
  const lines = wrapText(text, boxW, measure)
  const blockH = lines.length * fontSize * lineHeight

  ctx.fillStyle = color
  ctx.textBaseline = 'middle'
  ctx.textAlign = opt.align
  const tx = opt.align === 'center' ? boxX + boxW / 2 : boxX
  let y = boxY + (textBoxH - blockH) / 2 + (fontSize * lineHeight) / 2
  for (const line of lines) {
    ctx.fillText(line, tx, y)
    y += fontSize * lineHeight
  }

  if (hasAuthor) {
    ctx.font = `400 ${authorSize}px ${fontCss.value}`
    ctx.globalAlpha = 0.82
    ctx.fillText(`— ${opt.author.trim()}`, tx, boxY + boxH - authorSize * 0.7)
    ctx.globalAlpha = 1
  }
}

watch(opt, () => render(), { deep: true })
onMounted(() => nextTick(render))

function blobFromCanvas(): Promise<Blob> {
  return new Promise((res, rej) =>
    canvasRef.value!.toBlob((b) => (b ? res(b) : rej(new Error('輸出失敗'))), 'image/png'),
  )
}

async function download() {
  try {
    const blob = await blobFromCanvas()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `文字卡_${ratio.value.id.replace(':', 'x')}.png`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  } catch {
    error.value = '輸出失敗,請再試一次。'
  }
}

async function copyImage() {
  try {
    const blob = await blobFromCanvas()
    // eslint-disable-next-line no-undef
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    copied.value = true
    setTimeout(() => (copied.value = false), 1800)
  } catch {
    error.value = '這個瀏覽器不支援複製圖片,請改用「下載 PNG」。'
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">文字內容(可換行)</label>
        <textarea v-model="opt.text" rows="4" class="field-input resize-y" placeholder="貼上想做成圖卡的文字…" />
        <p class="field-hint">字級會自動依版面大小調整、自動斷行(中英文都行)。全程在你瀏覽器繪製,文字不會上傳。</p>
      </div>
      <div>
        <label class="field-label">署名 / 出處(可留空)</label>
        <input v-model="opt.author" type="text" class="field-input" placeholder="例:某某語錄、@帳號" />
      </div>
    </div>

    <div class="card p-6 space-y-5">
      <div>
        <label class="field-label">尺寸</label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="r in RATIOS"
            :key="r.id"
            class="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-stone-50"
            :class="{ 'border-brand-500 bg-brand-50 text-brand-700': opt.ratioId === r.id }"
            @click="opt.ratioId = r.id"
          >
            {{ r.label }}
          </button>
        </div>
      </div>

      <div>
        <label class="field-label">背景</label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="(g, i) in GRADIENTS"
            :key="g.name"
            class="h-9 w-9 rounded-lg border border-line shadow-sm transition hover:scale-110"
            :class="{ 'ring-2 ring-brand-500 ring-offset-1': opt.bgType === 'gradient' && opt.gradient === i }"
            :style="{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }"
            :title="g.name"
            @click="opt.bgType = 'gradient'; opt.gradient = i"
          />
          <label
            class="flex h-9 items-center gap-1.5 rounded-lg border border-line px-2 text-sm"
            :class="{ 'ring-2 ring-brand-500': opt.bgType === 'solid' }"
            title="純色背景"
          >
            <input v-model="opt.solid" type="color" class="h-6 w-6 cursor-pointer rounded" @input="opt.bgType = 'solid'" />
            純色
          </label>
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label">字體</label>
          <select v-model="opt.fontId" class="field-input">
            <option v-for="f in FONTS" :key="f.id" :value="f.id">{{ f.label }}</option>
          </select>
        </div>
        <div>
          <label class="field-label">對齊</label>
          <select v-model="opt.align" class="field-input">
            <option value="center">置中</option>
            <option value="left">靠左</option>
          </select>
        </div>
        <div>
          <label class="field-label">留白:{{ opt.padPct }}%</label>
          <input v-model.number="opt.padPct" type="range" min="4" max="22" step="1" class="w-full accent-brand-600" />
        </div>
        <div class="flex flex-wrap items-center gap-4 pt-1">
          <label class="inline-flex items-center gap-2 text-sm">
            <input v-model="opt.bold" type="checkbox" class="h-4 w-4 accent-brand-600" /> 粗體
          </label>
          <label class="inline-flex items-center gap-2 text-sm">
            <input v-model="opt.autoColor" type="checkbox" class="h-4 w-4 accent-brand-600" /> 文字色自動
          </label>
          <label v-if="!opt.autoColor" class="inline-flex items-center gap-1.5 text-sm">
            文字色
            <input v-model="opt.textColor" type="color" class="h-6 w-6 cursor-pointer rounded" />
          </label>
        </div>
      </div>

      <div class="flex flex-wrap gap-3">
        <button class="btn-primary" @click="download">下載 PNG</button>
        <button
          class="inline-flex items-center rounded-xl border border-line bg-white px-5 py-3 font-medium text-ink-700 hover:bg-stone-50"
          @click="copyImage"
        >
          {{ copied ? '已複製 ✓' : '複製到剪貼簿' }}
        </button>
      </div>
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
    </div>

    <div class="card p-3">
      <canvas ref="canvasRef" class="mx-auto block h-auto max-w-full rounded-xl shadow-sm" style="max-height: 70vh" />
    </div>

    <LegalNote title="什麼時候用得到?">
      <ul class="list-disc pl-5 space-y-1">
        <li>把<strong>金句、語錄、公告、活動標語</strong>做成圖片,直接發 <strong>Instagram 貼文/限動、Threads、Facebook、LINE</strong>。</li>
        <li>字級會<strong>自動填滿版面</strong>、中英文<strong>自動斷行</strong>,選好尺寸(1:1、4:5、9:16…)就對應各社群版位,免裁切。</li>
        <li><strong>全程在你瀏覽器用 Canvas 繪製、不上傳</strong>;無廣告、<strong>無浮水印</strong>、免註冊、免開 Canva。</li>
      </ul>
    </LegalNote>
  </div>
</template>
