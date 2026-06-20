<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { computePpi, retinaThreshold, isRetina, round } from '@/features/ppi'

/*
  螢幕像素密度(PPI)計算 —— 解析度 + 對角線英吋,算出 PPI、點距、實體尺寸與視網膜判定。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

const wPx = ref<number | null>(2560)
const hPx = ref<number | null>(1440)
const diag = ref<number | null>(27)
const distanceCm = ref<number | null>(50)

const r = computed(() => computePpi(Number(wPx.value), Number(hPx.value), Number(diag.value)))
const retina = computed(() => {
  if (!r.value.valid || !(Number(distanceCm.value) > 0)) return null
  return {
    threshold: retinaThreshold(Number(distanceCm.value)),
    ok: isRetina(r.value.ppi, Number(distanceCm.value)),
  }
})

const PRESETS = [
  { label: '27" 2K 螢幕', w: 2560, h: 1440, d: 27 },
  { label: '24" FHD 螢幕', w: 1920, h: 1080, d: 24 },
  { label: '15.6" 筆電 FHD', w: 1920, h: 1080, d: 15.6 },
  { label: '13" MacBook 視網膜', w: 2560, h: 1600, d: 13.3 },
  { label: '手機 6.1" FHD+', w: 1170, h: 2532, d: 6.1 },
]
</script>

<template>
  <div class="space-y-6">
    <div class="card p-5 space-y-4">
      <div class="flex flex-wrap items-end gap-3">
        <label class="text-sm">
          <span class="text-ink-500">水平解析度(px)</span>
          <input v-model.number="wPx" type="number" min="1" class="ppi-input" />
        </label>
        <span class="pb-2 text-xl text-ink-400">×</span>
        <label class="text-sm">
          <span class="text-ink-500">垂直解析度(px)</span>
          <input v-model.number="hPx" type="number" min="1" class="ppi-input" />
        </label>
        <label class="text-sm">
          <span class="text-ink-500">對角線(英吋)</span>
          <input v-model.number="diag" type="number" min="0.1" step="any" class="ppi-input" />
        </label>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="p in PRESETS"
          :key="p.label"
          type="button"
          class="rounded-lg border border-ink-200 px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          @click="wPx = p.w; hPx = p.h; diag = p.d"
        >
          {{ p.label }}
        </button>
      </div>
    </div>

    <template v-if="r.valid">
      <div class="card p-5 space-y-1">
        <div class="text-3xl font-bold text-brand-600">{{ round(r.ppi, 1) }} <span class="text-lg text-ink-500">PPI</span></div>
        <div class="text-sm text-ink-500">每公分 {{ round(r.ppcm, 1) }} 像素 · 點距 {{ round(r.dotPitchMm, 4) }} mm</div>
      </div>
      <div class="card p-5 grid gap-2 text-sm sm:grid-cols-2">
        <div class="flex justify-between border-b border-ink-100 py-1"><span class="text-ink-500">對角線像素</span><span class="font-mono text-ink-800">{{ round(r.diagonalPixels, 1) }}</span></div>
        <div class="flex justify-between border-b border-ink-100 py-1"><span class="text-ink-500">總像素</span><span class="font-mono text-ink-800">{{ r.totalPixels.toLocaleString() }}</span></div>
        <div class="flex justify-between border-b border-ink-100 py-1"><span class="text-ink-500">百萬像素</span><span class="font-mono text-ink-800">{{ round(r.megapixels, 2) }} MP</span></div>
        <div class="flex justify-between border-b border-ink-100 py-1"><span class="text-ink-500">實體尺寸</span><span class="font-mono text-ink-800">{{ round(r.widthInch, 1) }}″ × {{ round(r.heightInch, 1) }}″</span></div>
      </div>

      <div class="card p-5 space-y-3">
        <h2 class="text-sm font-semibold text-ink-700">視網膜清晰度判定</h2>
        <label class="text-sm">
          <span class="text-ink-500">觀看距離(公分)—— 手機約 25~30、電腦約 50~60、電視更遠</span>
          <input v-model.number="distanceCm" type="number" min="1" step="any" class="ppi-input mt-1 w-32 block" />
        </label>
        <div v-if="retina" class="rounded-xl p-4" :class="retina.ok ? 'bg-emerald-50' : 'bg-amber-50'">
          <div class="text-lg font-semibold" :class="retina.ok ? 'text-emerald-700' : 'text-amber-700'">
            {{ retina.ok ? '✓ 達視網膜清晰度' : '— 未達視網膜清晰度' }}
          </div>
          <div class="text-sm text-ink-600">
            在 {{ distanceCm }} cm 觀看,需約 <strong>{{ round(retina.threshold, 0) }} PPI</strong> 才看不出單一像素;
            本螢幕為 {{ round(r.ppi, 0) }} PPI。
          </div>
        </div>
      </div>
    </template>
    <p v-else class="card p-5 text-sm text-rose-600">{{ r.error }}</p>

    <LegalNote>
      <strong>PPI</strong>(Pixels Per Inch,每英吋像素)= 對角線像素 ÷ 對角線英吋,
      其中對角線像素 = √(寬² + 高²)(畢氏定理)。<strong>點距</strong>(相鄰像素間距)= 25.4 ÷ PPI(mm)。
      <strong>視網膜門檻</strong>依人眼約 1 弧分的分辨極限推算,與<strong>觀看距離</strong>有關——
      距離越遠、所需 PPI 越低,所以手機要 ~300+ PPI,電視幾百 PPI 也不需要。
      此為理論估算,實際感受還受內容、視力、面板技術影響。純數學計算,<strong>不上傳任何資料</strong>。
      與長寬比與尺寸計算互補。
    </LegalNote>
  </div>
</template>

<style scoped>
.ppi-input {
  display: block;
  width: 8rem;
  margin-top: 0.25rem;
  border: 1px solid var(--color-ink-200, #e2e8f0);
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
  font-size: 0.95rem;
}
</style>
