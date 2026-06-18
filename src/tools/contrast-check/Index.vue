<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parseColor, toHex, grade } from '@/features/contrast'

/*
  顏色可讀性(對比)檢測 —— 輸入「文字色」與「背景色」,依 WCAG 2.1 算出對比比值,
  判斷在一般字 / 大字下是否達 AA / AAA。做簡報、海報、網頁、長輩友善文件選色時,
  人腦很難一眼判斷夠不夠清楚;這支幫你算出來,全程在你瀏覽器、不上傳。
  與「色彩工坊」(色碼互轉 / 取主色)互補。
*/
const fg = ref('#3D3A34')
const bg = ref('#FAF8F3')

const fgRgb = computed(() => parseColor(fg.value))
const bgRgb = computed(() => parseColor(bg.value))

const result = computed(() => {
  if (!fgRgb.value || !bgRgb.value) return null
  return grade(fgRgb.value, bgRgb.value)
})

// 給 <input type=color> 的合法 #RRGGBB(解析失敗時退回黑/白)
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

interface Row {
  label: string
  hint: string
  aa: boolean
  aaa: boolean
}
const rows = computed<Row[]>(() => {
  const g = result.value
  if (!g) return []
  return [
    { label: '一般內文', hint: '小於 18pt(約 24px)的一般文字', aa: g.normalAA, aaa: g.normalAAA },
    { label: '大字 / 標題', hint: '18pt 以上,或 14pt 以上粗體', aa: g.largeAA, aaa: g.largeAAA },
    { label: '圖示 / 按鈕邊界', hint: '介面元件、圖形的可辨識邊界', aa: g.uiAA, aaa: g.uiAA },
  ]
})

// 整體評語(以一般內文 AA 為主要門檻)
const verdict = computed(() => {
  const g = result.value
  if (!g) return null
  if (g.normalAAA) return { text: '非常清楚 —— 一般文字都達最高 AAA 標準', cls: 'text-brand-700' }
  if (g.normalAA) return { text: '清楚 —— 一般文字達 AA 標準,放心使用', cls: 'text-brand-700' }
  if (g.largeAA) return { text: '只適合大字 —— 一般內文偏吃力,建議加深對比或只用於標題', cls: 'text-amber-600' }
  return { text: '太相近、難以辨識 —— 長輩或弱視者會看不清,請加大明暗差距', cls: 'text-red-600' }
})
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-5">
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label" for="fg">文字顏色</label>
          <div class="flex items-center gap-3">
            <input v-model="fgPicker" type="color" class="h-11 w-14 shrink-0 rounded-xl border border-line" aria-label="文字顏色選擇器" />
            <input id="fg" v-model="fg" type="text" class="field-input font-mono" placeholder="#333333" />
          </div>
          <p v-if="!fgRgb" class="mt-1 text-sm text-red-600">看不懂這個色碼,請用 #RRGGBB 或 rgb(r,g,b)。</p>
        </div>
        <div>
          <label class="field-label" for="bg">背景顏色</label>
          <div class="flex items-center gap-3">
            <input v-model="bgPicker" type="color" class="h-11 w-14 shrink-0 rounded-xl border border-line" aria-label="背景顏色選擇器" />
            <input id="bg" v-model="bg" type="text" class="field-input font-mono" placeholder="#FFFFFF" />
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

    <div v-if="result" class="card overflow-hidden">
      <!-- 實際預覽:同樣的文字色 + 背景色 -->
      <div class="px-6 py-8" :style="previewStyle">
        <p class="text-base">這是一般內文的大小,確認在這個背景上看不看得清楚。</p>
        <p class="mt-2 text-2xl font-bold">這是大字 / 標題的大小</p>
      </div>

      <div class="border-t border-line p-6 space-y-4">
        <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span class="text-3xl font-black text-ink-900">{{ result.ratio.toFixed(2) }}</span>
          <span class="text-ink-500">: 1 對比比值(最高 21:1)</span>
        </div>
        <p v-if="verdict" class="text-lg font-semibold" :class="verdict.cls">{{ verdict.text }}</p>

        <div class="overflow-hidden rounded-xl border border-line">
          <table class="w-full text-sm">
            <thead class="bg-brand-50 text-ink-700">
              <tr>
                <th class="px-4 py-2 text-left font-semibold">使用情境</th>
                <th class="px-3 py-2 text-center font-semibold">AA(基本)</th>
                <th class="px-3 py-2 text-center font-semibold">AAA(最佳)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in rows" :key="r.label" class="border-t border-line align-top">
                <td class="px-4 py-3">
                  <div class="font-medium text-ink-900">{{ r.label }}</div>
                  <div class="text-xs text-ink-500">{{ r.hint }}</div>
                </td>
                <td class="px-3 py-3 text-center">
                  <span :class="r.aa ? 'text-brand-700 font-semibold' : 'text-red-600'">{{ r.aa ? '✓ 通過' : '✗ 未過' }}</span>
                </td>
                <td class="px-3 py-3 text-center">
                  <span :class="r.aaa ? 'text-brand-700 font-semibold' : 'text-ink-300'">{{ r.aaa ? '✓ 通過' : '—' }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <LegalNote title="這些標準是什麼意思?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>對比比值</strong>是文字與背景明暗差距的量化指標,1:1 表示完全看不見、21:1 是純黑配純白。</li>
        <li><strong>AA</strong> 是國際無障礙(WCAG 2.1)的基本門檻:一般內文需 ≥ 4.5、大字需 ≥ 3;<strong>AAA</strong> 是更友善的最佳標準(一般 ≥ 7、大字 ≥ 4.5)。</li>
        <li>做給<strong>長輩或弱視者</strong>看的文件、招牌、簡報,建議至少達一般內文 AA;能到 AAA 更好。</li>
        <li>計算全程在你瀏覽器完成,<strong>不上傳</strong>任何資料。需要色碼互轉或從圖片取色,可用「色彩工坊」。</li>
        <li>提醒:對比只是可讀性的一環,字級、字體與行距同樣重要。</li>
      </ul>
    </LegalNote>
  </div>
</template>
