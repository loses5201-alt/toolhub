<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parseColor } from '@/features/colorMix'
import { compareColors, interpretDeltaE } from '@/features/deltaE'

/*
  色差(Delta E)計算 —— 輸入兩個顏色,告訴你「人眼覺得差多少」。
  螢幕的 RGB 距離不等於人眼感受,必須換到感知均勻的 CIE L*a*b* 空間再算。
  ΔE00(CIEDE2000)是目前業界標準,但公式出了名的難正確實作,一般免費網站常算錯;
  本工具以 Sharma 等人(2005)發表的標準測試資料驗證過(回歸測試 34 對全數吻合)。
  品牌色把關、印刷打樣對色、配色微調都用得到。全程在你瀏覽器計算,不連網、不上傳。
  與色彩工坊、色彩混合器、顏色可讀性檢測互補。
*/

const c1 = ref('#2563EB')
const c2 = ref('#1D4ED8')

const rgb1 = computed(() => parseColor(c1.value))
const rgb2 = computed(() => parseColor(c2.value))

const toHex = (rgb: { r: number; g: number; b: number }) =>
  '#' + [rgb.r, rgb.g, rgb.b].map((n) => Math.round(n).toString(16).padStart(2, '0')).join('').toUpperCase()

const picker1 = computed({
  get: () => (rgb1.value ? toHex(rgb1.value) : '#000000'),
  set: (v: string) => (c1.value = v.toUpperCase()),
})
const picker2 = computed({
  get: () => (rgb2.value ? toHex(rgb2.value) : '#FFFFFF'),
  set: (v: string) => (c2.value = v.toUpperCase()),
})

const result = computed(() => {
  if (!rgb1.value || !rgb2.value) return null
  return compareColors(rgb1.value, rgb2.value)
})

const verdict = computed(() => (result.value ? interpretDeltaE(result.value.de2000) : null))

const fmt = (n: number) => n.toFixed(2)
const fmtLab = (lab: { L: number; a: number; b: number }) =>
  `L* ${lab.L.toFixed(2)}  a* ${lab.a.toFixed(2)}  b* ${lab.b.toFixed(2)}`

function swap() {
  const t = c1.value
  c1.value = c2.value
  c2.value = t
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-5">
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label" for="c1">顏色 A</label>
          <div class="flex items-center gap-3">
            <input v-model="picker1" type="color" class="h-11 w-14 shrink-0 rounded-xl border border-line" aria-label="顏色 A 選擇器" />
            <input id="c1" v-model="c1" type="text" class="field-input font-mono" placeholder="#2563EB" />
          </div>
          <p v-if="!rgb1" class="mt-1 text-sm text-red-600">看不懂這個色碼,請用 #RRGGBB 或 rgb(r,g,b)。</p>
        </div>
        <div>
          <label class="field-label" for="c2">顏色 B</label>
          <div class="flex items-center gap-3">
            <input v-model="picker2" type="color" class="h-11 w-14 shrink-0 rounded-xl border border-line" aria-label="顏色 B 選擇器" />
            <input id="c2" v-model="c2" type="text" class="field-input font-mono" placeholder="#1D4ED8" />
          </div>
          <p v-if="!rgb2" class="mt-1 text-sm text-red-600">看不懂這個色碼,請用 #RRGGBB 或 rgb(r,g,b)。</p>
        </div>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm text-ink-700 transition hover:border-brand-300"
        @click="swap"
      >
        ⇅ 對調兩色
      </button>
    </div>

    <div v-if="result" class="card overflow-hidden">
      <!-- 兩色並排預覽 -->
      <div class="flex h-24">
        <div class="flex-1" :style="{ backgroundColor: toHex(rgb1!) }" />
        <div class="flex-1" :style="{ backgroundColor: toHex(rgb2!) }" />
      </div>

      <div class="border-t border-line p-6 space-y-5">
        <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span class="text-4xl font-black text-ink-900">ΔE₀₀ {{ fmt(result.de2000) }}</span>
          <span v-if="verdict" class="text-lg font-semibold text-brand-700">{{ verdict.label }}</span>
        </div>
        <p v-if="verdict" class="text-ink-600">{{ verdict.note }}</p>

        <div class="grid gap-3 sm:grid-cols-3">
          <div class="rounded-xl border border-line p-4">
            <div class="text-xs text-ink-500">ΔE00(CIEDE2000)</div>
            <div class="mt-1 text-2xl font-bold text-ink-900">{{ fmt(result.de2000) }}</div>
            <div class="mt-1 text-xs text-ink-500">業界標準,最貼近人眼</div>
          </div>
          <div class="rounded-xl border border-line p-4">
            <div class="text-xs text-ink-500">ΔE94(CIE94)</div>
            <div class="mt-1 text-2xl font-bold text-ink-700">{{ fmt(result.de94) }}</div>
            <div class="mt-1 text-xs text-ink-500">圖形業參數,以 A 為參考色</div>
          </div>
          <div class="rounded-xl border border-line p-4">
            <div class="text-xs text-ink-500">ΔE*ab(CIE76)</div>
            <div class="mt-1 text-2xl font-bold text-ink-700">{{ fmt(result.de76) }}</div>
            <div class="mt-1 text-xs text-ink-500">最早的 Lab 直線距離</div>
          </div>
        </div>

        <div class="overflow-hidden rounded-xl border border-line">
          <table class="w-full text-sm">
            <tbody>
              <tr class="border-b border-line">
                <td class="bg-brand-50 px-4 py-3 font-medium text-ink-700">顏色 A 的 Lab</td>
                <td class="px-4 py-3 font-mono text-ink-900">{{ fmtLab(result.lab1) }}</td>
              </tr>
              <tr>
                <td class="bg-brand-50 px-4 py-3 font-medium text-ink-700">顏色 B 的 Lab</td>
                <td class="px-4 py-3 font-mono text-ink-900">{{ fmtLab(result.lab2) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <LegalNote title="色差 Delta E 是什麼?怎麼解讀?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>ΔE(Delta E)</strong>是量化「兩個顏色人眼覺得差多少」的指標。螢幕的 RGB 數值差距不等於人眼感受,所以要先換算到感知均勻的 <strong>CIE L*a*b*</strong> 空間再算距離。</li>
        <li>常見的解讀門檻(以 ΔE00 為準):<strong>&lt; 1</strong> 肉眼幾乎分不出、<strong>1–2</strong> 仔細看才看得出、<strong>2–3.5</strong> 一般人可察覺、<strong>3.5–5</strong> 明顯差異、<strong>&gt; 5</strong> 屬不同顏色。</li>
        <li><strong>三種公式</strong>:ΔE*ab(CIE76)最單純但較不準;ΔE94 加入彩度/色相權重;<strong>ΔE00(CIEDE2000)</strong>最貼近人眼、是目前業界標準(印刷、面板、品牌色管理都用它),但公式複雜、很多工具會算錯。</li>
        <li>本工具的 CIEDE2000 已用 <strong>Sharma 等人(2005)發表的 34 對標準測試資料</strong>驗證,逐筆吻合到小數第 4 位。</li>
        <li>色彩空間假設為 <strong>sRGB</strong>、光源 <strong>D65</strong>;ΔE94 公式本身不對稱(以「顏色 A」為參考色),ΔE76/ΔE00 則對稱。</li>
        <li>全程在你瀏覽器計算,<strong>不連網、不上傳</strong>。需要色碼互轉、取主色或混色,可用色彩工坊、色彩混合器。</li>
      </ul>
    </LegalNote>
  </div>
</template>
