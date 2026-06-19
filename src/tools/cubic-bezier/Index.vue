<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  sampleCurve,
  hasOvershoot,
  toBezierString,
  buildTransitionCss,
  parseBezier,
  PRESETS,
  type BezierParams,
} from '@/features/cubicBezier'

/*
  CSS cubic-bezier 緩動曲線編輯器 —— 拖動兩個控制點即時調出動畫節奏,
  右側方塊用真實的 transition 重播預覽,一鍵複製可直接貼用的 CSS。
  全程在你的瀏覽器計算,不連網、不上傳。補齊 gradient-maker / box-shadow / color-scale 視覺工坊系列。
*/

const params = ref<BezierParams>({ x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 })

// SVG 座標:y 軸向上,版面高度允許過衝留白(-0.5 ~ 1.5)
const W = 320
const H = 320
const PAD = 40 // 上下留白,容納過衝(y 可超出 0–1)
const yMin = -0.5
const yMax = 1.5

// 把 (x:0..1, y:yMin..yMax) 映射到 SVG 像素
function px(x: number) {
  return x * W
}
function py(y: number) {
  // y=yMax → 頂(PAD/2), y=yMin → 底(H-PAD/2)
  const top = PAD / 2
  const usable = H - PAD
  return top + ((yMax - y) / (yMax - yMin)) * usable
}

const curvePath = computed(() => {
  const pts = sampleCurve(params.value, 60)
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.x).toFixed(2)},${py(p.y).toFixed(2)}`).join(' ')
})

const p1 = computed(() => ({ x: px(params.value.x1), y: py(params.value.y1) }))
const p2 = computed(() => ({ x: px(params.value.x2), y: py(params.value.y2) }))
const overshoot = computed(() => hasOvershoot(params.value))

const bezierStr = computed(() => toBezierString(params.value))

// --- 拖曳控制點 ---
const svgRef = ref<SVGSVGElement | null>(null)
let dragging: 1 | 2 | null = null

function pointToParam(clientX: number, clientY: number) {
  const svg = svgRef.value
  if (!svg) return null
  const rect = svg.getBoundingClientRect()
  const x = ((clientX - rect.left) / rect.width) * W
  const y = ((clientY - rect.top) / rect.height) * H
  const top = PAD / 2
  const usable = H - PAD
  const xVal = Math.min(1, Math.max(0, x / W))
  const yVal = yMax - ((y - top) / usable) * (yMax - yMin)
  return { x: xVal, y: yVal }
}

function onMove(e: PointerEvent) {
  if (!dragging) return
  const pt = pointToParam(e.clientX, e.clientY)
  if (!pt) return
  const round3 = (n: number) => Math.round(n * 1000) / 1000
  if (dragging === 1) {
    params.value.x1 = round3(pt.x)
    params.value.y1 = round3(pt.y)
  } else {
    params.value.x2 = round3(pt.x)
    params.value.y2 = round3(pt.y)
  }
}
function startDrag(which: 1 | 2, e: PointerEvent) {
  dragging = which
  ;(e.target as Element).setPointerCapture?.(e.pointerId)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', stopDrag)
}
function stopDrag() {
  dragging = null
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', stopDrag)
}
onBeforeUnmount(stopDrag)

// --- 預覽動畫 ---
const duration = ref(800)
const prop = ref<'transform' | 'left' | 'width' | 'opacity'>('transform')
const playState = ref(false)
function replay() {
  playState.value = false
  // 強制 reflow 後再播,確保 transition 重跑
  requestAnimationFrame(() => requestAnimationFrame(() => (playState.value = true)))
}
const moveStyle = computed(() => ({
  transition: `${prop.value} ${duration.value}ms ${bezierStr.value}`,
}))

function applyPreset(p: BezierParams) {
  params.value = { ...p }
  replay()
}

// --- 貼上解析 ---
const pasteText = ref('')
const pasteErr = ref('')
function applyPaste() {
  const parsed = parseBezier(pasteText.value)
  if (!parsed) {
    pasteErr.value = '無法解析,請貼 cubic-bezier(...) 或四個數字'
    return
  }
  pasteErr.value = ''
  params.value = parsed
  replay()
}

// --- 複製 ---
const copied = ref('')
function copy(text: string, tag: string) {
  navigator.clipboard?.writeText(text)
  copied.value = tag
  setTimeout(() => (copied.value = ''), 1500)
}
const cssText = computed(() => buildTransitionCss(params.value, prop.value, duration.value))
</script>

<template>
  <div class="space-y-6">
    <div class="grid gap-6 lg:grid-cols-2">
      <!-- 曲線編輯器 -->
      <div class="card p-5 space-y-3">
        <span class="text-sm font-semibold text-ink-700">拖動控制點調整曲線</span>
        <svg
          ref="svgRef"
          :viewBox="`0 0 ${W} ${H}`"
          class="w-full touch-none select-none rounded-lg bg-ink-50"
          role="img"
          aria-label="cubic-bezier 曲線編輯區"
        >
          <!-- 0 與 1 的水平參考線 -->
          <line :x1="0" :y1="py(0)" :x2="W" :y2="py(0)" stroke="#cbd5e1" stroke-dasharray="4 4" />
          <line :x1="0" :y1="py(1)" :x2="W" :y2="py(1)" stroke="#cbd5e1" stroke-dasharray="4 4" />
          <!-- 對角線(linear 參考)-->
          <line :x1="px(0)" :y1="py(0)" :x2="px(1)" :y2="py(1)" stroke="#e2e8f0" />
          <!-- 控制把手連線 -->
          <line :x1="px(0)" :y1="py(0)" :x2="p1.x" :y2="p1.y" stroke="#f472b6" stroke-width="1.5" />
          <line :x1="px(1)" :y1="py(1)" :x2="p2.x" :y2="p2.y" stroke="#60a5fa" stroke-width="1.5" />
          <!-- 曲線 -->
          <path :d="curvePath" fill="none" stroke="#6366f1" stroke-width="2.5" />
          <!-- 端點 -->
          <circle :cx="px(0)" :cy="py(0)" r="4" fill="#64748b" />
          <circle :cx="px(1)" :cy="py(1)" r="4" fill="#64748b" />
          <!-- 控制點(可拖)-->
          <circle
            :cx="p1.x"
            :cy="p1.y"
            r="9"
            fill="#f472b6"
            class="cursor-grab"
            @pointerdown="startDrag(1, $event)"
          />
          <circle
            :cx="p2.x"
            :cy="p2.y"
            r="9"
            fill="#60a5fa"
            class="cursor-grab"
            @pointerdown="startDrag(2, $event)"
          />
        </svg>
        <!-- 數值微調 -->
        <div class="grid grid-cols-4 gap-2 text-sm">
          <label class="block">
            <span class="text-ink-500">x1</span>
            <input v-model.number="params.x1" type="number" step="0.01" min="0" max="1" class="input-sm" />
          </label>
          <label class="block">
            <span class="text-ink-500">y1</span>
            <input v-model.number="params.y1" type="number" step="0.01" class="input-sm" />
          </label>
          <label class="block">
            <span class="text-ink-500">x2</span>
            <input v-model.number="params.x2" type="number" step="0.01" min="0" max="1" class="input-sm" />
          </label>
          <label class="block">
            <span class="text-ink-500">y2</span>
            <input v-model.number="params.y2" type="number" step="0.01" class="input-sm" />
          </label>
        </div>
        <p v-if="overshoot" class="text-xs text-amber-600">
          ⚠️ 此曲線含過衝/回彈(y 超出 0–1),適合彈跳效果,但用於顏色/透明度可能會超界。
        </p>
      </div>

      <!-- 預覽 -->
      <div class="card p-5 space-y-4">
        <div class="flex items-center gap-3">
          <span class="text-sm font-semibold text-ink-700">動畫預覽</span>
          <button
            type="button"
            class="ml-auto rounded-lg border border-ink-200 px-3 py-1 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
            @click="replay"
          >
            ▶ 重播
          </button>
        </div>
        <!-- 跑道 -->
        <div class="rounded-lg bg-ink-50 p-4">
          <div class="relative h-12">
            <div
              class="absolute top-1/2 h-9 w-9 -translate-y-1/2 rounded-lg bg-brand-500 shadow"
              :style="[moveStyle, { left: playState ? 'calc(100% - 2.25rem)' : '0%' }]"
            />
          </div>
        </div>
        <div class="rounded-lg bg-ink-50 p-4 flex items-center justify-center">
          <div
            class="h-12 w-12 rounded-full bg-pink-400"
            :style="[
              { transition: `transform ${duration}ms ${bezierStr}` },
              { transform: playState ? 'scale(1.6)' : 'scale(0.6)' },
            ]"
          />
        </div>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <label class="block">
            <span class="text-ink-500">時間 {{ duration }}ms</span>
            <input v-model.number="duration" type="range" min="150" max="2000" step="50" class="w-full accent-brand-600" />
          </label>
          <label class="block">
            <span class="text-ink-500">套用屬性</span>
            <select v-model="prop" class="input-sm">
              <option value="transform">transform</option>
              <option value="left">left</option>
              <option value="width">width</option>
              <option value="opacity">opacity</option>
            </select>
          </label>
        </div>
      </div>
    </div>

    <!-- 範本 -->
    <div class="card p-5 space-y-2">
      <span class="text-sm font-semibold text-ink-700">快速套用</span>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="p in PRESETS"
          :key="p.label"
          type="button"
          class="rounded-lg border border-ink-200 px-3 py-1.5 text-sm text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          @click="applyPreset(p.params)"
        >
          {{ p.label }}
        </button>
      </div>
    </div>

    <!-- 貼上解析 -->
    <div class="card p-5 space-y-2">
      <span class="text-sm font-semibold text-ink-700">貼上既有曲線</span>
      <div class="flex flex-wrap gap-2">
        <input
          v-model="pasteText"
          type="text"
          placeholder="cubic-bezier(0.25, 0.1, 0.25, 1) 或 0.25, 0.1, 0.25, 1"
          class="input-sm flex-1 min-w-[220px]"
          @keyup.enter="applyPaste"
        />
        <button
          type="button"
          class="rounded-lg border border-ink-200 px-3 py-1.5 text-sm text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          @click="applyPaste"
        >
          載入
        </button>
      </div>
      <p v-if="pasteErr" class="text-xs text-red-500">{{ pasteErr }}</p>
    </div>

    <!-- 輸出 -->
    <div class="card p-5 space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <code class="font-mono text-sm text-ink-800">{{ bezierStr }}</code>
        <button
          type="button"
          class="ml-auto rounded-lg border border-ink-200 px-3 py-1 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          @click="copy(bezierStr, 'fn')"
        >
          {{ copied === 'fn' ? '已複製' : '複製函式' }}
        </button>
        <button
          type="button"
          class="rounded-lg border border-ink-200 px-3 py-1 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          @click="copy(cssText, 'css')"
        >
          {{ copied === 'css' ? '已複製' : '複製 CSS' }}
        </button>
      </div>
      <pre class="whitespace-pre-wrap break-all font-mono text-sm text-ink-800">{{ cssText }}</pre>
    </div>

    <LegalNote>
      cubic-bezier 以兩個控制點 (x1, y1)、(x2, y2) 定義動畫節奏:橫軸為時間進度、縱軸為動畫完成度。
      依 CSS 規範,x1、x2 必須介於 0–1(編輯器會自動夾住);y 可超出 0–1 以做出回彈/過衝效果。
      右側預覽以瀏覽器真實 transition 重播,實際呈現以你的瀏覽器為準。全程在你的瀏覽器,不連網、不上傳。
    </LegalNote>
  </div>
</template>

<style scoped>
.input-sm {
  width: 100%;
  border: 1px solid var(--color-ink-200, #e2e8f0);
  border-radius: 0.5rem;
  padding: 0.375rem 0.5rem;
  font-size: 0.875rem;
}
</style>
