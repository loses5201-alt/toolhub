<script setup lang="ts">
import { ref, reactive } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { bake, fmtSize, type Rect } from './bake'

/*
  圖片遮蔽 —— 在圖上拖曳框出要隱藏的區域(塗黑或馬賽克),全程在瀏覽器處理,不上傳。
  遮蔽框以「相對比例 0..1」儲存,與顯示尺寸無關,輸出時以原始解析度燒入。
*/
const imgUrl = ref('')
const imgName = ref('')
const mode = ref<'black' | 'mosaic'>('black')
const format = ref<'image/png' | 'image/jpeg'>('image/png')
const rects = ref<Rect[]>([])
const busy = ref(false)
const error = ref('')
const result = ref<{ url: string; size: number; name: string } | null>(null)
let uid = 0

const wrapper = ref<HTMLElement | null>(null)
// 進行中的拖曳框(以比例表示),null = 沒在拖
const draft = reactive({ active: false, x: 0, y: 0, w: 0, h: 0, startX: 0, startY: 0 })

function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f || !f.type.startsWith('image/')) return
  if (imgUrl.value) URL.revokeObjectURL(imgUrl.value)
  clearResult()
  rects.value = []
  imgUrl.value = URL.createObjectURL(f)
  imgName.value = f.name
  ;(e.target as HTMLInputElement).value = ''
}

function frac(clientX: number, clientY: number) {
  const el = wrapper.value!
  const r = el.getBoundingClientRect()
  const x = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
  const y = Math.min(1, Math.max(0, (clientY - r.top) / r.height))
  return { x, y }
}

function onDown(e: PointerEvent) {
  if (!imgUrl.value) return
  ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  const p = frac(e.clientX, e.clientY)
  draft.active = true
  draft.startX = p.x
  draft.startY = p.y
  draft.x = p.x
  draft.y = p.y
  draft.w = 0
  draft.h = 0
}

function onMove(e: PointerEvent) {
  if (!draft.active) return
  const p = frac(e.clientX, e.clientY)
  draft.x = Math.min(p.x, draft.startX)
  draft.y = Math.min(p.y, draft.startY)
  draft.w = Math.abs(p.x - draft.startX)
  draft.h = Math.abs(p.y - draft.startY)
}

function onUp() {
  if (!draft.active) return
  draft.active = false
  // 太小的框視為誤觸,忽略
  if (draft.w > 0.008 && draft.h > 0.008) {
    rects.value.push({ id: ++uid, x: draft.x, y: draft.y, w: draft.w, h: draft.h, mode: mode.value })
    clearResult()
  }
}

function removeRect(id: number) {
  rects.value = rects.value.filter((r) => r.id !== id)
  clearResult()
}
function undo() {
  rects.value.pop()
  clearResult()
}
function clearAll() {
  rects.value = []
  clearResult()
}
function clearResult() {
  if (result.value) URL.revokeObjectURL(result.value.url)
  result.value = null
}

async function run() {
  if (!imgUrl.value || !rects.value.length) return
  busy.value = true
  error.value = ''
  clearResult()
  try {
    const blob = await bake(imgUrl.value, rects.value, format.value)
    const ext = format.value === 'image/png' ? 'png' : 'jpg'
    const base = imgName.value.replace(/\.[^.]+$/, '')
    result.value = { url: URL.createObjectURL(blob), size: blob.size, name: `${base}_已遮蔽.${ext}` }
  } catch (e) {
    error.value = '處理失敗:' + (e as Error).message
  } finally {
    busy.value = false
  }
}

function pct(v: number) {
  return v * 100 + '%'
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 sm:p-6 space-y-5">
      <div>
        <label class="field-label">選擇要遮蔽的圖片</label>
        <input type="file" accept="image/*" class="field-input" @change="onFile" />
        <p class="field-hint">圖片只在你的瀏覽器處理,不會上傳。適合分享截圖前先遮掉身分證、地址、帳號等個資。</p>
      </div>

      <template v-if="imgUrl">
        <div class="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <div class="flex items-center gap-2">
            <span class="text-ink-600">遮蔽方式</span>
            <div class="flex overflow-hidden rounded-lg border border-line">
              <button class="px-3 py-1.5" :class="mode === 'black' ? 'bg-brand-600 text-white' : 'bg-white text-ink-600'" @click="mode = 'black'">塗黑</button>
              <button class="px-3 py-1.5" :class="mode === 'mosaic' ? 'bg-brand-600 text-white' : 'bg-white text-ink-600'" @click="mode = 'mosaic'">馬賽克</button>
            </div>
          </div>
          <label class="flex items-center gap-2">
            <span class="text-ink-600">輸出格式</span>
            <select v-model="format" class="rounded-lg border border-line bg-white px-2 py-1.5">
              <option value="image/png">PNG</option>
              <option value="image/jpeg">JPG</option>
            </select>
          </label>
          <span class="text-ink-500">在圖片上<strong class="text-ink-700">拖曳</strong>框出要遮蔽的區域</span>
        </div>

        <!-- 編輯區 -->
        <div class="overflow-auto">
          <div
            ref="wrapper"
            class="relative inline-block max-w-full select-none touch-none"
            @pointerdown="onDown"
            @pointermove="onMove"
            @pointerup="onUp"
            @pointercancel="onUp"
          >
            <img :src="imgUrl" alt="" class="block max-w-full" draggable="false" />
            <!-- 已建立的遮蔽框 -->
            <div
              v-for="r in rects"
              :key="r.id"
              class="absolute"
              :class="r.mode === 'mosaic' ? 'bg-white/10 backdrop-blur-md ring-1 ring-white/40' : 'bg-black'"
              :style="{ left: pct(r.x), top: pct(r.y), width: pct(r.w), height: pct(r.h) }"
            >
              <button
                class="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white shadow"
                aria-label="移除此遮蔽" @pointerdown.stop @click.stop="removeRect(r.id)"
              >✕</button>
            </div>
            <!-- 拖曳中的草稿框 -->
            <div
              v-if="draft.active"
              class="absolute border-2 border-dashed border-brand-500 bg-brand-400/20"
              :style="{ left: pct(draft.x), top: pct(draft.y), width: pct(draft.w), height: pct(draft.h) }"
            ></div>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-3 text-sm">
          <span class="text-ink-600">已遮蔽 {{ rects.length }} 區</span>
          <button class="text-brand-700 underline disabled:opacity-40" :disabled="!rects.length" @click="undo">復原上一個</button>
          <button class="text-ink-400 underline hover:text-red-500 disabled:opacity-40" :disabled="!rects.length" @click="clearAll">全部清除</button>
        </div>

        <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

        <button class="btn-primary w-full sm:w-auto" :disabled="!rects.length || busy" @click="run">
          {{ busy ? '處理中…' : rects.length ? '套用遮蔽並產生圖片' : '請先框出要遮蔽的區域' }}
        </button>

        <div v-if="result" class="rounded-xl border border-line bg-stone-50 p-4 space-y-3">
          <p class="text-sm text-brand-700">✅ 已產生遮蔽後的圖片({{ fmtSize(result.size) }})</p>
          <img :src="result.url" alt="遮蔽結果" class="max-h-72 w-auto rounded-lg border border-line" />
          <a :href="result.url" :download="result.name" class="btn-primary !py-2 text-sm">下載</a>
        </div>
      </template>
    </div>

    <LegalNote title="為什麼用這個,而不是網路上的免費去碼工具?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>不上傳</strong>:含個資的截圖(身分證、存摺、地址、對話)全程留在你電腦,不送到陌生伺服器 —— 遮蔽機密資料時這點最重要。</li>
        <li><strong>真的把像素塗掉</strong>:塗黑/馬賽克會燒進輸出的圖片,不是只蓋一層可被還原的圖層。</li>
        <li>無廣告、免註冊、不限張數,完全免費。</li>
        <li>提醒:馬賽克對少量數字(如末三碼)仍可能被還原,涉及敏感資訊請優先用「塗黑」。</li>
      </ul>
    </LegalNote>
  </div>
</template>
