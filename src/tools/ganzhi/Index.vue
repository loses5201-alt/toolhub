<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { ganzhiOfYear, rocToAd, type GanzhiInfo } from '@/features/ganzhi'

/*
  干支 / 生肖 / 納音 換算 —— 由西曆或民國年算出天干地支、生肖、納音五行。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

type Era = 'ad' | 'roc'
const era = ref<Era>('ad')
const yearInput = ref<number | null>(new Date().getFullYear())

const adYear = computed<number | null>(() => {
  const y = yearInput.value
  if (y === null || !Number.isFinite(y)) return null
  return era.value === 'ad' ? Math.trunc(y) : rocToAd(Math.trunc(y))
})

const info = computed<GanzhiInfo | null>(() => {
  const y = adYear.value
  if (y === null || y === 0) return null
  return ganzhiOfYear(y)
})

const copied = ref(false)
async function copyAll() {
  if (!info.value) return
  const i = info.value
  const text = `${i.year} 年(民國 ${i.rocYear} 年):${i.ganzhi}年・生肖${i.zodiac}・納音${i.nayin}`
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    setTimeout(() => (copied.value = false), 1200)
  } catch {
    /* 忽略 */
  }
}

const QUICK = [
  { label: '今年', y: new Date().getFullYear(), era: 'ad' as Era },
  { label: '2000(千禧)', y: 2000, era: 'ad' as Era },
  { label: '1984', y: 1984, era: 'ad' as Era },
  { label: '民國 100', y: 100, era: 'roc' as Era },
]
function setQuick(q: (typeof QUICK)[number]) {
  era.value = q.era
  yearInput.value = q.y
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-5 space-y-4">
      <div class="flex gap-2">
        <button
          type="button"
          class="flex-1 rounded-lg border px-3 py-2 text-sm font-medium"
          :class="
            era === 'ad'
              ? 'border-brand-400 bg-brand-50 text-brand-700'
              : 'border-ink-200 text-ink-600 hover:bg-ink-50'
          "
          @click="era = 'ad'"
        >
          西元年
        </button>
        <button
          type="button"
          class="flex-1 rounded-lg border px-3 py-2 text-sm font-medium"
          :class="
            era === 'roc'
              ? 'border-brand-400 bg-brand-50 text-brand-700'
              : 'border-ink-200 text-ink-600 hover:bg-ink-50'
          "
          @click="era = 'roc'"
        >
          民國年
        </button>
      </div>

      <label class="block text-sm">
        <span class="text-ink-500">{{ era === 'ad' ? '輸入西元年(如 2024)' : '輸入民國年(如 113)' }}</span>
        <input
          v-model.number="yearInput"
          type="number"
          class="gz-input font-mono"
          :placeholder="era === 'ad' ? '2024' : '113'"
        />
      </label>

      <div class="flex flex-wrap gap-2">
        <button
          v-for="q in QUICK"
          :key="q.label"
          type="button"
          class="rounded-lg border border-ink-200 px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          @click="setQuick(q)"
        >
          {{ q.label }}
        </button>
      </div>
    </div>

    <template v-if="info">
      <div class="card p-5 space-y-3 text-center">
        <div class="text-sm text-ink-500">
          西元 {{ info.year }} 年・民國 {{ info.rocYear > 0 ? info.rocYear : `前 ${1 - info.rocYear}` }} 年
        </div>
        <div class="text-5xl font-bold text-ink-800 tracking-wide">{{ info.ganzhi }}年</div>
        <div class="text-2xl text-brand-700">生肖屬<strong>{{ info.zodiac }}</strong></div>
        <button
          type="button"
          class="mx-auto rounded-lg border border-ink-200 px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          @click="copyAll"
        >
          {{ copied ? '已複製' : '複製結果' }}
        </button>
      </div>

      <div class="card p-0 overflow-hidden">
        <table class="w-full text-sm">
          <tbody>
            <tr class="border-b border-ink-100">
              <td class="px-4 py-3 text-ink-500 w-32">天干</td>
              <td class="px-4 py-3 text-ink-800">
                {{ info.stem }}(五行屬{{ info.stemElement }})
              </td>
            </tr>
            <tr class="border-b border-ink-100">
              <td class="px-4 py-3 text-ink-500">地支</td>
              <td class="px-4 py-3 text-ink-800">{{ info.branch }}(生肖{{ info.zodiac }})</td>
            </tr>
            <tr class="border-b border-ink-100">
              <td class="px-4 py-3 text-ink-500">納音五行</td>
              <td class="px-4 py-3 text-ink-800 font-medium">{{ info.nayin }}</td>
            </tr>
            <tr class="border-b border-ink-100">
              <td class="px-4 py-3 text-ink-500">六十甲子序</td>
              <td class="px-4 py-3 text-ink-800">第 {{ info.sexagenaryIndex + 1 }} / 60</td>
            </tr>
            <tr>
              <td class="px-4 py-3 text-ink-500">{{ info.branch }}時(時辰)</td>
              <td class="px-4 py-3 text-ink-800 font-mono">{{ info.hour }} 時</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        class="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-800"
      >
        ⚠️ 本工具以<strong>西曆年(1/1 起)</strong>為準。傳統民俗生肖多以<strong>農曆春節</strong>換年、
        八字以<strong>立春</strong>換年;若出生在年初(春節 / 立春之前),干支與生肖請以<strong>前一年</strong>判讀。
      </div>
    </template>
    <div v-else-if="yearInput !== null" class="card p-5">
      <p class="text-sm text-rose-600">請輸入有效年份(西元年不可為 0)。</p>
    </div>

    <LegalNote>
      <p>
        <strong>干支</strong>由 10 個<strong>天干</strong>(甲乙丙丁戊己庚辛壬癸)與 12 個<strong>地支</strong>
        (子丑寅卯辰巳午未申酉戌亥)依序兩兩相配,組成 <strong>60 年一循環</strong>的「六十甲子」;
        地支同時對應<strong>十二生肖</strong>。計算式:天干序 =(西元年−4)÷10 的餘數、地支序 =(西元年−4)÷12 的餘數,
        公元 4 年為甲子年。
      </p>
      <p>
        <strong>納音五行</strong>是六十甲子各配一個五行意象(如海中金、爐中火),每兩個甲子共用一個,共 30 種,
        命理常用。本工具一併列出。
      </p>
      <p>純數學換算、<strong>不連網、不上傳</strong>;與民國/西元年、年齡計算等工具互補。命理內容僅供參考。</p>
    </LegalNote>
  </div>
</template>

<style scoped>
.gz-input {
  width: 100%;
  margin-top: 0.25rem;
  border: 1px solid var(--color-ink-200, #e2e8f0);
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
  font-size: 1rem;
}
</style>
