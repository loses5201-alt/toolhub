<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  simplifyRatio,
  commonName,
  orientation,
  solveDimension,
  fit,
  megapixels,
  round,
} from '@/features/aspectRatio'

/*
  長寬比與尺寸縮放計算機 —— 算比例、維持比例放大縮小、塞進外框。
  做設計/剪片/印刷/響應式圖片常用。全程在你的瀏覽器計算,不連網、不上傳。
*/

// ── 區塊一:算長寬比 ──
const aw = ref<number | null>(1920)
const ah = ref<number | null>(1080)
const ratio = computed(() => simplifyRatio(Number(aw.value), Number(ah.value)))
const ratioName = computed(() =>
  ratio.value.valid ? commonName(Number(aw.value), Number(ah.value)) : '',
)
const orient = computed(() => {
  if (!ratio.value.valid) return ''
  const o = orientation(Number(aw.value), Number(ah.value))
  return o === 'landscape' ? '橫式' : o === 'portrait' ? '直式' : '正方形'
})
const mp = computed(() =>
  ratio.value.valid ? round(megapixels(Number(aw.value), Number(ah.value)), 2) : 0,
)

// ── 區塊二:維持比例求另一邊 ──
const lockW = ref<number | null>(16)
const lockH = ref<number | null>(9)
const targetW = ref<number | null>(2560)
const targetH = ref<number | null>(null)
const solveByWidth = ref(true)

const solved = computed(() => {
  const rw = Number(lockW.value)
  const rh = Number(lockH.value)
  if (!(rw > 0) || !(rh > 0)) return null
  if (solveByWidth.value) {
    const w = Number(targetW.value)
    if (!(w > 0)) return null
    return solveDimension(rw, rh, { width: w })
  }
  const h = Number(targetH.value)
  if (!(h > 0)) return null
  return solveDimension(rw, rh, { height: h })
})

// ── 區塊三:塞進外框 contain / cover ──
const srcW = ref<number | null>(4000)
const srcH = ref<number | null>(3000)
const boxW = ref<number | null>(1200)
const boxH = ref<number | null>(1200)
const fitMode = ref<'contain' | 'cover'>('contain')
const fitted = computed(() =>
  fit(Number(srcW.value), Number(srcH.value), Number(boxW.value), Number(boxH.value), fitMode.value),
)

const PRESETS = [
  { label: 'Full HD 1920×1080', w: 1920, h: 1080 },
  { label: '4K 3840×2160', w: 3840, h: 2160 },
  { label: 'IG 正方 1080×1080', w: 1080, h: 1080 },
  { label: '直式 1080×1920', w: 1080, h: 1920 },
  { label: '相機 4:3 4000×3000', w: 4000, h: 3000 },
]
</script>

<template>
  <div class="space-y-6">
    <!-- 算長寬比 -->
    <div class="card p-5 space-y-3">
      <h2 class="text-base font-semibold text-ink-700">① 這是幾比幾?</h2>
      <div class="flex flex-wrap items-end gap-3">
        <label class="text-sm">
          <span class="text-ink-500">寬(px)</span>
          <input v-model.number="aw" type="number" min="1" class="ar-input" />
        </label>
        <span class="pb-2 text-xl text-ink-400">×</span>
        <label class="text-sm">
          <span class="text-ink-500">高(px)</span>
          <input v-model.number="ah" type="number" min="1" class="ar-input" />
        </label>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="p in PRESETS"
          :key="p.label"
          type="button"
          class="rounded-lg border border-ink-200 px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          @click="aw = p.w; ah = p.h"
        >
          {{ p.label }}
        </button>
      </div>
      <div v-if="ratio.valid" class="rounded-xl bg-ink-50 p-4 space-y-1">
        <div class="text-3xl font-bold text-brand-600">{{ ratio.text }}</div>
        <div class="text-sm text-ink-600">
          比值 {{ round(ratio.decimal, 4) }} ·
          {{ orient }} ·
          約 {{ mp }} 百萬像素
          <span v-if="ratioName" class="text-ink-500">· {{ ratioName }}</span>
        </div>
      </div>
      <p v-else class="text-sm text-rose-600">{{ ratio.error }}</p>
    </div>

    <!-- 維持比例求另一邊 -->
    <div class="card p-5 space-y-3">
      <h2 class="text-base font-semibold text-ink-700">② 維持比例,放大/縮小</h2>
      <div class="flex flex-wrap items-end gap-3">
        <label class="text-sm">
          <span class="text-ink-500">比例(寬)</span>
          <input v-model.number="lockW" type="number" min="1" class="ar-input w-20" />
        </label>
        <span class="pb-2 text-xl text-ink-400">:</span>
        <label class="text-sm">
          <span class="text-ink-500">比例(高)</span>
          <input v-model.number="lockH" type="number" min="1" class="ar-input w-20" />
        </label>
      </div>
      <div class="flex flex-wrap items-end gap-3">
        <label class="inline-flex items-center gap-1 text-sm text-ink-600">
          <input v-model="solveByWidth" type="radio" :value="true" /> 給寬求高
        </label>
        <label class="inline-flex items-center gap-1 text-sm text-ink-600">
          <input v-model="solveByWidth" type="radio" :value="false" /> 給高求寬
        </label>
      </div>
      <div class="flex flex-wrap items-end gap-3">
        <label v-if="solveByWidth" class="text-sm">
          <span class="text-ink-500">目標寬(px)</span>
          <input v-model.number="targetW" type="number" min="1" class="ar-input" />
        </label>
        <label v-else class="text-sm">
          <span class="text-ink-500">目標高(px)</span>
          <input v-model.number="targetH" type="number" min="1" class="ar-input" />
        </label>
      </div>
      <div v-if="solved" class="rounded-xl bg-ink-50 p-4 text-lg text-ink-800">
        結果尺寸:<strong class="text-brand-600">{{ round(solved.width, 2) }} × {{ round(solved.height, 2) }}</strong> px
      </div>
      <p v-else class="text-sm text-ink-400">請填入有效的比例與目標尺寸</p>
    </div>

    <!-- 塞進外框 -->
    <div class="card p-5 space-y-3">
      <h2 class="text-base font-semibold text-ink-700">③ 塞進外框(contain / cover)</h2>
      <div class="flex flex-wrap items-end gap-3">
        <label class="text-sm">
          <span class="text-ink-500">原圖寬</span>
          <input v-model.number="srcW" type="number" min="1" class="ar-input w-24" />
        </label>
        <label class="text-sm">
          <span class="text-ink-500">原圖高</span>
          <input v-model.number="srcH" type="number" min="1" class="ar-input w-24" />
        </label>
        <label class="text-sm">
          <span class="text-ink-500">外框寬</span>
          <input v-model.number="boxW" type="number" min="1" class="ar-input w-24" />
        </label>
        <label class="text-sm">
          <span class="text-ink-500">外框高</span>
          <input v-model.number="boxH" type="number" min="1" class="ar-input w-24" />
        </label>
      </div>
      <div class="flex flex-wrap items-end gap-3">
        <label class="inline-flex items-center gap-1 text-sm text-ink-600">
          <input v-model="fitMode" type="radio" value="contain" /> contain(完整塞進、可能留白)
        </label>
        <label class="inline-flex items-center gap-1 text-sm text-ink-600">
          <input v-model="fitMode" type="radio" value="cover" /> cover(填滿、可能裁切)
        </label>
      </div>
      <div v-if="fitted" class="rounded-xl bg-ink-50 p-4 text-lg text-ink-800">
        縮放後:<strong class="text-brand-600">{{ round(fitted.width, 2) }} × {{ round(fitted.height, 2) }}</strong> px
        <span class="text-sm text-ink-500">(縮放比 {{ round(fitted.scale * 100, 1) }}%)</span>
      </div>
      <p v-else class="text-sm text-ink-400">請填入有效的原圖與外框尺寸</p>
    </div>

    <LegalNote>
      <strong>長寬比</strong>由寬高的最大公因數約分而來(例 1920×1080 的 gcd=120 → 16:9)。
      <strong>維持比例縮放</strong>用 目標邊 × 比例 求另一邊;<strong>contain</strong> 取較小縮放比讓圖完整塞進外框(可能留白),
      <strong>cover</strong> 取較大縮放比讓圖填滿外框(可能裁切)。百萬像素 = 寬×高÷1,000,000。
      純數學計算,<strong>不上傳任何資料</strong>。與「照片壓到指定大小」「圖片工坊」互補。
    </LegalNote>
  </div>
</template>

<style scoped>
.ar-input {
  display: block;
  width: 7rem;
  margin-top: 0.25rem;
  border: 1px solid var(--color-ink-200, #e2e8f0);
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
  font-size: 0.95rem;
}
</style>
