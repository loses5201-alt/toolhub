<script setup lang="ts">
import { ref, computed } from 'vue'
import { renderThumbnails, downloadBlob, type RenderedPage } from './lib'
import { buildEdited, addAngle, type PageEdit } from './edit'

// 整理頁面 —— 渲染每頁縮圖,可刪除、重排、旋轉(轉正掃描歪掉的頁)、只擷取選取頁,再匯出新 PDF
const fileName = ref('')
let buffer: ArrayBuffer | null = null
const pages = ref<RenderedPage[]>([])
// order = 目前要輸出的頁面(以原始 0-based index 表示),順序即輸出順序
const order = ref<number[]>([])
// 每頁的旋轉增量(以原始 index 為 key,值為 0/90/180/270)
const rotations = ref<Record<number, number>>({})
const loading = ref(false)
const busy = ref(false)
const error = ref('')

async function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  error.value = ''
  loading.value = true
  pages.value = []
  order.value = []
  rotations.value = {}
  fileName.value = f.name
  try {
    buffer = await f.arrayBuffer()
    pages.value = await renderThumbnails(buffer)
    order.value = pages.value.map((p) => p.index)
  } catch (err) {
    error.value = '無法讀取此 PDF,可能損毀或受密碼保護:' + (err as Error).message
  } finally {
    loading.value = false
  }
}

const thumbOf = (idx: number) => pages.value.find((p) => p.index === idx)
const rotOf = (idx: number) => rotations.value[idx] ?? 0

function removeAt(pos: number) {
  order.value.splice(pos, 1)
}
function move(pos: number, dir: -1 | 1) {
  const j = pos + dir
  if (j < 0 || j >= order.value.length) return
  const arr = order.value
  ;[arr[pos], arr[j]] = [arr[j], arr[pos]]
}
function rotate(idx: number) {
  rotations.value[idx] = addAngle(rotOf(idx), 90)
}
function reset() {
  order.value = pages.value.map((p) => p.index)
  rotations.value = {}
}

const removedCount = computed(() => pages.value.length - order.value.length)
const rotatedCount = computed(
  () => order.value.filter((idx) => rotOf(idx) % 360 !== 0).length,
)

async function run() {
  if (!buffer || !order.value.length) return
  busy.value = true
  error.value = ''
  try {
    const items: PageEdit[] = order.value.map((idx) => ({
      index: idx,
      rotate: rotOf(idx),
    }))
    const bytes = await buildEdited(buffer, items)
    const base = fileName.value.replace(/\.pdf$/i, '')
    downloadBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), base + '_整理.pdf')
  } catch (e) {
    error.value = '輸出失敗:' + (e as Error).message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="field-label">選擇一個 PDF</label>
      <input type="file" accept="application/pdf" class="field-input" @change="onFile" />
      <p class="field-hint">載入後可刪除不要的頁、調整順序、把掃描歪掉的頁轉正,最後匯出新檔。原檔不會被改動,也不會上傳。</p>
    </div>

    <p v-if="loading" class="text-ink-500">正在渲染頁面預覽…</p>
    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

    <template v-if="order.length || removedCount">
      <div class="flex flex-wrap items-center gap-3 text-sm">
        <span class="text-ink-600">
          輸出 {{ order.length }} 頁<span v-if="removedCount" class="text-red-500">(已移除 {{ removedCount }} 頁)</span><span v-if="rotatedCount" class="text-brand-700">(已旋轉 {{ rotatedCount }} 頁)</span>
        </span>
        <button class="text-brand-700 underline" @click="reset">復原全部</button>
      </div>

      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        <div
          v-for="(idx, pos) in order"
          :key="pos + '-' + idx"
          class="group relative rounded-xl border border-line bg-white p-2"
        >
          <div class="flex h-44 items-center justify-center overflow-hidden">
            <img
              v-if="thumbOf(idx)"
              :src="thumbOf(idx)!.dataUrl"
              alt=""
              class="max-h-44 w-auto transition-transform duration-200"
              :style="{ transform: `rotate(${rotOf(idx)}deg)` }"
            />
          </div>
          <div class="mt-1 flex items-center justify-between text-xs text-ink-500">
            <span>
              第 {{ pos + 1 }} 頁<span class="text-ink-300"> (原 P{{ idx + 1 }})</span><span v-if="rotOf(idx)" class="ml-1 text-brand-600">↻{{ rotOf(idx) }}°</span>
            </span>
            <span class="flex gap-1">
              <button class="px-1 hover:text-brand-700 disabled:opacity-30" :disabled="pos === 0" aria-label="前移" @click="move(pos, -1)">◀</button>
              <button class="px-1 hover:text-brand-700 disabled:opacity-30" :disabled="pos === order.length - 1" aria-label="後移" @click="move(pos, 1)">▶</button>
              <button class="px-1 hover:text-brand-700" aria-label="向右旋轉 90 度" title="向右旋轉 90°" @click="rotate(idx)">↻</button>
              <button class="px-1 text-red-400 hover:text-red-600" aria-label="刪除此頁" @click="removeAt(pos)">✕</button>
            </span>
          </div>
        </div>
      </div>

      <button class="btn-primary w-full sm:w-auto" :disabled="!order.length || busy" @click="run">
        {{ busy ? '輸出中…' : `匯出 ${order.length} 頁的新 PDF` }}
      </button>
    </template>
  </div>
</template>
