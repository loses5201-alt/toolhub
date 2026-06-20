<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { PAPERS, dimensions, round, type Orientation } from '@/features/paperSize'

/*
  紙張尺寸與列印像素 —— ISO A/B 系列與美規,給 mm/cm/inch 與指定 DPI 的像素尺寸。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

const paperId = ref('a4')
const dpi = ref<number | null>(300)
const orientation = ref<Orientation>('portrait')

const dim = computed(() => dimensions(paperId.value, Number(dpi.value), orientation.value))

const DPI_PRESETS = [
  { label: '網頁/螢幕 72', v: 72 },
  { label: '一般列印 150', v: 150 },
  { label: '高品質印刷 300', v: 300 },
  { label: '商業印刷 600', v: 600 },
]

const seriesGroups = computed(() => ({
  A: PAPERS.filter((p) => p.series === 'A'),
  B: PAPERS.filter((p) => p.series === 'B'),
  US: PAPERS.filter((p) => p.series === 'US'),
}))

const copied = ref(false)
async function copyPx() {
  if (!dim.value) return
  try {
    await navigator.clipboard.writeText(`${dim.value.widthPx}×${dim.value.heightPx}`)
    copied.value = true
    setTimeout(() => (copied.value = false), 1200)
  } catch {
    /* ignore */
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-5 space-y-4">
      <label class="block text-sm">
        <span class="text-ink-500">紙張尺寸</span>
        <select v-model="paperId" class="ps-input w-full mt-1">
          <optgroup label="ISO A 系列(常用)">
            <option v-for="p in seriesGroups.A" :key="p.id" :value="p.id">{{ p.name }}({{ p.widthMm }}×{{ p.heightMm }} mm)</option>
          </optgroup>
          <optgroup label="ISO B 系列">
            <option v-for="p in seriesGroups.B" :key="p.id" :value="p.id">{{ p.name }}({{ p.widthMm }}×{{ p.heightMm }} mm)</option>
          </optgroup>
          <optgroup label="美規">
            <option v-for="p in seriesGroups.US" :key="p.id" :value="p.id">{{ p.name }}({{ p.widthMm }}×{{ p.heightMm }} mm)</option>
          </optgroup>
        </select>
      </label>

      <div class="flex flex-wrap items-end gap-3">
        <label class="text-sm">
          <span class="text-ink-500">DPI(每英吋點數)</span>
          <input v-model.number="dpi" type="number" min="1" class="ps-input w-28 block mt-1" />
        </label>
        <div class="flex gap-1.5">
          <label class="inline-flex items-center gap-1 text-sm text-ink-600">
            <input v-model="orientation" type="radio" value="portrait" /> 直式
          </label>
          <label class="inline-flex items-center gap-1 text-sm text-ink-600 ml-2">
            <input v-model="orientation" type="radio" value="landscape" /> 橫式
          </label>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="d in DPI_PRESETS"
          :key="d.v"
          type="button"
          class="rounded-lg border border-ink-200 px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          @click="dpi = d.v"
        >
          {{ d.label }}
        </button>
      </div>
    </div>

    <template v-if="dim">
      <div class="card p-5 space-y-1">
        <div class="flex items-center justify-between">
          <span class="text-sm text-ink-500">在 {{ dpi }} DPI 下需製作</span>
          <button type="button" class="rounded-lg border border-ink-200 px-3 py-1 text-xs text-ink-600 hover:bg-ink-50" @click="copyPx">
            {{ copied ? '已複製' : '複製' }}
          </button>
        </div>
        <div class="text-3xl font-bold text-brand-600">{{ dim.widthPx }} × {{ dim.heightPx }} <span class="text-lg text-ink-500">px</span></div>
      </div>
      <div class="card p-5 grid gap-2 text-sm sm:grid-cols-3">
        <div class="flex justify-between border-b border-ink-100 py-1 sm:border-0"><span class="text-ink-500">公釐</span><span class="font-mono text-ink-800">{{ round(dim.widthMm, 1) }} × {{ round(dim.heightMm, 1) }} mm</span></div>
        <div class="flex justify-between border-b border-ink-100 py-1 sm:border-0"><span class="text-ink-500">公分</span><span class="font-mono text-ink-800">{{ round(dim.widthCm, 2) }} × {{ round(dim.heightCm, 2) }} cm</span></div>
        <div class="flex justify-between border-b border-ink-100 py-1 sm:border-0"><span class="text-ink-500">英吋</span><span class="font-mono text-ink-800">{{ round(dim.widthIn, 2) }} × {{ round(dim.heightIn, 2) }} ″</span></div>
      </div>
    </template>
    <p v-else class="card p-5 text-sm text-rose-600">請選擇紙張並輸入大於 0 的 DPI。</p>

    <LegalNote>
      <strong>ISO 216</strong> 的 A/B 系列每縮一號面積減半、長寬比固定為 √2(所以放大縮小不變形);
      A 系列以 <strong>A0 = 841×1189 mm</strong>(面積約 1 m²)為基準。像素數 = 公釐 ÷ 25.4 × DPI,
      例如 <strong>A4(210×297mm)在 300 DPI</strong> 需 <strong>2480×3508 px</strong>。
      印刷常用 300 DPI,螢幕/網頁用 72 DPI。實際輸出還需考量出血(bleed)與印刷機規格。
      純查表計算,<strong>不上傳任何資料</strong>。與長寬比、PPI、照片壓到指定大小等工具互補。
    </LegalNote>
  </div>
</template>

<style scoped>
.ps-input {
  border: 1px solid var(--color-ink-200, #e2e8f0);
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
  font-size: 0.95rem;
}
</style>
