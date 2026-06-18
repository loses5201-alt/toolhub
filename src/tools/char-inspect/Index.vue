<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { inspect, clean, type CharRisk } from '@/features/charInspect'

/*
  隱形字元 / Unicode 檢視器 —— 貼上文字,揪出看不見的零寬字元、奇怪空白、方向控制字元,
  以及長得像 ASCII 的形近字(釣魚/假冒常用)。可一鍵清乾淨。
  全程在你的瀏覽器,不連網、不上傳。
*/
const SAMPLE = 'аpple​.com　test'

const input = ref(SAMPLE)
const result = computed(() => inspect(input.value))

// 只顯示有風險的字元(避免一長串正常字洗版),但保留可切換看全部
const showAll = ref(false)
const visibleChars = computed(() =>
  result.value.chars
    .map((c, i) => ({ ...c, i }))
    .filter((c) => showAll.value || c.risk !== 'normal'),
)

const RISK_LABEL: Record<CharRisk, string> = {
  normal: '正常',
  invisible: '看不見的字元',
  'odd-space': '非半形空白',
  bidi: '方向控制字元',
  confusable: '形近字',
  control: '控制字元',
}
const RISK_STYLE: Record<CharRisk, string> = {
  normal: 'text-ink-400',
  invisible: 'text-red-600',
  'odd-space': 'text-amber-600',
  bidi: 'text-red-600',
  confusable: 'text-orange-600',
  control: 'text-red-600',
}

// 把字元顯示成可見:看不見的用「␣ ▯」等替身,一般字直接顯示
function glyph(c: { char: string; risk: CharRisk }): string {
  if (c.risk === 'invisible' || c.risk === 'control' || c.risk === 'bidi') return '▯'
  if (c.risk === 'odd-space') return '␣'
  return c.char
}

const issueSummary = computed(() => {
  const c = result.value.counts
  const out: string[] = []
  if (c.invisible) out.push(`${c.invisible} 個看不見的字元`)
  if (c['odd-space']) out.push(`${c['odd-space']} 個非半形空白`)
  if (c.bidi) out.push(`${c.bidi} 個方向控制字元`)
  if (c.confusable) out.push(`${c.confusable} 個形近字`)
  if (c.control) out.push(`${c.control} 個控制字元`)
  return out
})

// 清理選項
const optInvisible = ref(true)
const optSpaces = ref(true)
const optConfusable = ref(false) // 形近字還原較激進,預設關
const cleaned = computed(() =>
  clean(input.value, {
    removeInvisible: optInvisible.value,
    normalizeSpaces: optSpaces.value,
    fixConfusables: optConfusable.value,
  }),
)
const copied = ref(false)
function copyCleaned() {
  navigator.clipboard?.writeText(cleaned.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
function applyCleaned() {
  input.value = cleaned.value
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-3">
      <div class="flex items-center gap-3">
        <label class="field-label mb-0">貼上文字</label>
        <button type="button" class="ml-auto text-xs text-ink-400 underline hover:text-ink-600" @click="input = SAMPLE">
          載入範例
        </button>
        <button type="button" class="text-xs text-ink-400 underline hover:text-ink-600" @click="input = ''">清空</button>
      </div>
      <textarea v-model="input" rows="4" class="field-input text-sm leading-relaxed" spellcheck="false" />
      <p class="field-hint">
        全程在你的瀏覽器分析,<strong>不連網、不上傳</strong>。常用於:為什麼兩個字串「看起來一樣卻不相等」、
        揪出複製貼上夾帶的隱形字元、辨識釣魚網址/假冒帳號用的形近字。
      </p>
    </div>

    <!-- 摘要 -->
    <div class="grid grid-cols-3 gap-3 text-center">
      <div class="card p-3">
        <div class="text-2xl font-bold text-ink-800">{{ result.charCount }}</div>
        <div class="text-xs text-ink-400">字元數(碼位)</div>
      </div>
      <div class="card p-3">
        <div class="text-2xl font-bold text-ink-800">{{ result.codeUnitCount }}</div>
        <div class="text-xs text-ink-400">UTF-16 長度</div>
      </div>
      <div class="card p-3">
        <div class="text-2xl font-bold text-ink-800">{{ result.byteCount }}</div>
        <div class="text-xs text-ink-400">UTF-8 位元組</div>
      </div>
    </div>

    <div
      v-if="result.hasIssues"
      class="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-800"
    >
      ⚠️ 發現:{{ issueSummary.join('、') }}。下方逐字列出,可在最底下一鍵清理。
    </div>
    <div
      v-else-if="result.charCount"
      class="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-800"
    >
      ✅ 沒有偵測到隱形字元、異常空白或形近字。
    </div>

    <!-- 逐字表 -->
    <div v-if="result.charCount" class="card p-5 space-y-3">
      <div class="flex items-center gap-2">
        <span class="text-sm font-semibold text-ink-700">逐字分析</span>
        <label class="ml-auto flex items-center gap-1.5 text-xs text-ink-500">
          <input v-model="showAll" type="checkbox" class="accent-brand-600" />
          顯示全部字元(含正常)
        </label>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs text-ink-400">
              <th class="py-1.5 pr-3 font-medium">#</th>
              <th class="py-1.5 pr-3 font-medium">字元</th>
              <th class="py-1.5 pr-3 font-medium">碼位</th>
              <th class="py-1.5 pr-3 font-medium">類別</th>
              <th class="py-1.5 font-medium">說明</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in visibleChars" :key="c.i" class="border-t border-ink-100 align-top">
              <td class="py-1.5 pr-3 text-xs text-ink-400">{{ c.i + 1 }}</td>
              <td class="py-1.5 pr-3 font-mono text-base">{{ glyph(c) }}</td>
              <td class="py-1.5 pr-3 font-mono text-xs text-ink-500">{{ c.hex }}</td>
              <td class="py-1.5 pr-3 whitespace-nowrap text-xs font-semibold" :class="RISK_STYLE[c.risk]">
                {{ RISK_LABEL[c.risk] }}
              </td>
              <td class="py-1.5 text-xs text-ink-500">{{ c.note || c.name }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="!visibleChars.length" class="text-sm text-ink-400">沒有可疑字元;勾選上方可看全部字元。</p>
    </div>

    <!-- 清理 -->
    <div v-if="result.charCount" class="card p-5 space-y-3">
      <span class="text-sm font-semibold text-ink-700">清理</span>
      <div class="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-600">
        <label class="flex items-center gap-1.5">
          <input v-model="optInvisible" type="checkbox" class="accent-brand-600" />
          刪除看不見的字元(零寬/控制/方向)
        </label>
        <label class="flex items-center gap-1.5">
          <input v-model="optSpaces" type="checkbox" class="accent-brand-600" />
          異常空白 → 一般空格
        </label>
        <label class="flex items-center gap-1.5">
          <input v-model="optConfusable" type="checkbox" class="accent-brand-600" />
          形近字還原成 ASCII
        </label>
      </div>
      <textarea :value="cleaned" rows="3" readonly class="field-input text-sm leading-relaxed bg-ink-50" spellcheck="false" />
      <div class="flex gap-2">
        <button type="button" class="btn-primary" @click="copyCleaned">{{ copied ? '已複製 ✓' : '複製清理結果' }}</button>
        <button type="button" class="rounded-lg border border-ink-200 px-4 py-2 text-sm text-ink-600 hover:bg-ink-50" @click="applyCleaned">
          套用回上方
        </button>
      </div>
      <p class="text-xs text-ink-400">「形近字還原」較激進(會把西里爾/希臘字母換成相像的 ASCII),非英數內容請斟酌使用。</p>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>除錯</strong>:兩個字串「看起來一模一樣卻不相等」、密碼/帳號貼上後登不進去,常是夾帶了<strong>零寬字元或非半形空白</strong>——這裡逐字攤開來看。</li>
        <li><strong>防詐/防冒名</strong>:釣魚網址、假冒帳號常用<strong>形近字</strong>(把拉丁 a 換成西里爾 а),肉眼幾乎分不出來,這裡會標出來並指出它在模仿哪個字元。</li>
        <li><strong>防偽造</strong>:<strong>文字方向控制字元</strong>能把字串視覺倒置(例如讓 <code>...exe</code> 看起來像 <code>...txt</code>),也會被揪出。</li>
        <li>可一鍵清理後複製。本工具<strong>不連網、不上傳</strong>,文字只留在你的瀏覽器。與「文字清理工坊」(批次清理)互補,這支著重<strong>逐字檢視與辨識</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
