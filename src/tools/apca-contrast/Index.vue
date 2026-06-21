<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { toHex } from '@/features/contrast'
import { parseColor, apcaContrast, describeLc } from '@/features/apca'

/*
  APCA 對比檢測 —— 輸入「文字色」與「背景色」,依 WCAG 3 草案採用的 APCA 模型
  算出 Lc 值(比 WCAG 2 對比比值更貼近人眼)。全程在你瀏覽器、不上傳。
  與「顏色可讀性檢測(WCAG 2)」互補。
*/
const fg = ref('#5B5B5B')
const bg = ref('#FFFFFF')

const fgRgb = computed(() => parseColor(fg.value))
const bgRgb = computed(() => parseColor(bg.value))

const lc = computed(() => {
  if (!fgRgb.value || !bgRgb.value) return null
  return apcaContrast(fgRgb.value, bgRgb.value)
})
const info = computed(() => (lc.value === null ? null : describeLc(lc.value)))

const fgPicker = computed({
  get: () => (fgRgb.value ? toHex(fgRgb.value) : '#000000'),
  set: (v: string) => (fg.value = v.toUpperCase()),
})
const bgPicker = computed({
  get: () => (bgRgb.value ? toHex(bgRgb.value) : '#FFFFFF'),
  set: (v: string) => (bg.value = v.toUpperCase()),
})

function swap() {
  const t = fg.value
  fg.value = bg.value
  bg.value = t
}

const previewStyle = computed(() => ({
  color: fgRgb.value ? toHex(fgRgb.value) : '#000',
  backgroundColor: bgRgb.value ? toHex(bgRgb.value) : '#fff',
}))

const verdictCls = computed(() => {
  const i = info.value
  if (!i) return ''
  if (i.abs >= 75) return 'text-brand-700'
  if (i.abs >= 60) return 'text-brand-700'
  if (i.abs >= 45) return 'text-amber-600'
  return 'text-red-600'
})

// APCA 字級/字重門檻(簡化版),依絕對 Lc 給「可放多小的字」建議
const fontHints = computed(() => {
  const a = info.value?.abs ?? 0
  return [
    { use: '細小文字(14–16px 一般字重)', need: 90, pass: a >= 90 },
    { use: '一般內文(16–18px)', need: 75, pass: a >= 75 },
    { use: '較大內文 / 半粗(18–24px)', need: 60, pass: a >= 60 },
    { use: '大標題(≥ 24px 粗體)', need: 45, pass: a >= 45 },
    { use: '純裝飾 / 停用元素', need: 15, pass: a >= 15 },
  ]
})
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-5">
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label" for="afg">文字顏色</label>
          <div class="flex items-center gap-3">
            <input
              v-model="fgPicker"
              type="color"
              class="h-11 w-14 shrink-0 rounded-xl border border-line"
              aria-label="文字顏色選擇器"
            />
            <input id="afg" v-model="fg" type="text" class="field-input font-mono" placeholder="#333333" />
          </div>
          <p v-if="!fgRgb" class="mt-1 text-sm text-red-600">看不懂這個色碼,請用 #RRGGBB 或 rgb(r,g,b)。</p>
        </div>
        <div>
          <label class="field-label" for="abg">背景顏色</label>
          <div class="flex items-center gap-3">
            <input
              v-model="bgPicker"
              type="color"
              class="h-11 w-14 shrink-0 rounded-xl border border-line"
              aria-label="背景顏色選擇器"
            />
            <input id="abg" v-model="bg" type="text" class="field-input font-mono" placeholder="#FFFFFF" />
          </div>
          <p v-if="!bgRgb" class="mt-1 text-sm text-red-600">看不懂這個色碼,請用 #RRGGBB 或 rgb(r,g,b)。</p>
        </div>
      </div>
      <div>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm text-ink-700 transition hover:border-brand-300"
          @click="swap"
        >
          ⇅ 對調文字色與背景色
        </button>
      </div>
    </div>

    <div v-if="info" class="card overflow-hidden">
      <div class="px-6 py-8" :style="previewStyle">
        <p class="text-sm">細小文字 14px：確認在這個背景上看不看得清楚。</p>
        <p class="mt-2 text-base">一般內文 16px 的大小。</p>
        <p class="mt-2 text-2xl font-bold">大字 / 標題</p>
      </div>

      <div class="border-t border-line p-6 space-y-4">
        <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span class="text-3xl font-black text-ink-900">Lc {{ info.lc }}</span>
          <span class="text-ink-500">
            （{{
              info.polarity === 'normal'
                ? '深字淺底'
                : info.polarity === 'reverse'
                  ? '淺字深底'
                  : '無對比'
            }},範圍約 -108 ~ +106）
          </span>
        </div>
        <p class="text-lg font-semibold" :class="verdictCls">
          {{ info.label }} —— {{ info.usage }}
        </p>

        <div class="overflow-hidden rounded-xl border border-line">
          <table class="w-full text-sm">
            <thead class="bg-brand-50 text-ink-700">
              <tr>
                <th class="px-4 py-2 text-left font-semibold">使用情境</th>
                <th class="px-3 py-2 text-center font-semibold">需要 |Lc|</th>
                <th class="px-3 py-2 text-center font-semibold">是否達標</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in fontHints" :key="r.use" class="border-t border-line">
                <td class="px-4 py-3 text-ink-900">{{ r.use }}</td>
                <td class="px-3 py-3 text-center font-mono text-ink-600">≥ {{ r.need }}</td>
                <td class="px-3 py-3 text-center">
                  <span :class="r.pass ? 'text-brand-700 font-semibold' : 'text-red-600'">{{
                    r.pass ? '✓ 達標' : '✗ 不足'
                  }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <LegalNote title="APCA 是什麼?和 WCAG 2 對比比值差在哪?">
      <ul class="list-disc pl-5 space-y-1">
        <li>
          <strong>APCA</strong>(Accessible Perceptual Contrast Algorithm)是 WCAG 3 草案採用的新一代對比模型,
          以「<strong>Lc 值</strong>」(約 -108 ~ +106)表示可讀性。它考慮明暗極性 ——
          同樣的明暗差,<strong>深字淺底</strong>與<strong>淺字深底</strong>人眼感受不同,這是傳統對比比值算不出來的。
        </li>
        <li>
          <strong>正值</strong>代表深字配淺底、<strong>負值</strong>代表淺字配深底;絕對值越大越清楚。
          一般內文建議 <strong>|Lc| ≥ 60~75</strong>,細小文字要更高。
        </li>
        <li>
          APCA 的實際門檻會隨<strong>字級與字重</strong>變動(官方有對照表),上表為保守的通用建議,僅供快速判斷。
        </li>
        <li>WCAG 3 仍在草案階段;若你的專案需符合現行法規,請以 <strong>WCAG 2.1 對比比值(AA/AAA)</strong>為準,可用「顏色可讀性檢測」。</li>
        <li>計算採 APCA-W3 0.1.9 公式,全程在你瀏覽器完成、<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
