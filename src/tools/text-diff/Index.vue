<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { diffText } from '@/features/textDiff'

/*
  文字差異比對 —— 零相依、全程在瀏覽器處理,不上傳任何文字。
  比對合約改版、條款、規格、貼文兩個版本的差異,逐行 + 行內逐字標出
  到底改了哪裡。線上 diff 工具往往要把(可能機密的)文字貼上他人伺服器,
  這支工具在你自己的瀏覽器裡算完,什麼都不外傳。
*/
const oldText = ref('')
const newText = ref('')

const opt = reactive({
  ignoreCase: false,
  ignoreWhitespace: false,
})

// 行數上限保護:LCS 為 O(n×m),超大檔避免卡住瀏覽器
const MAX_LINES = 5000
const tooBig = computed(() => {
  const a = oldText.value.split('\n').length
  const b = newText.value.split('\n').length
  return a > MAX_LINES || b > MAX_LINES
})

const hasInput = computed(() => oldText.value !== '' || newText.value !== '')

const result = computed(() => {
  if (!hasInput.value || tooBig.value) return null
  return diffText(oldText.value, newText.value, opt)
})

const identical = computed(
  () => result.value !== null && result.value.added === 0 && result.value.removed === 0,
)

function swap() {
  const t = oldText.value
  oldText.value = newText.value
  newText.value = t
}

function clearAll() {
  oldText.value = ''
  newText.value = ''
}

function loadExample() {
  oldText.value = '本合約自民國 114 年 1 月 1 日起生效。\n月租金為新臺幣 12000 元整。\n押金為兩個月租金。\n甲方應於每月 5 日前繳納。'
  newText.value = '本合約自民國 114 年 2 月 1 日起生效。\n月租金為新臺幣 13000 元整。\n押金為兩個月租金。\n乙方應於每月 5 日前繳納。\n租期屆滿得續約一年。'
}

const copied = ref(false)
async function copyDiff() {
  if (!result.value) return
  const text = result.value.lines
    .map((l) => {
      const sign = l.op === '+' ? '+ ' : l.op === '-' ? '- ' : '  '
      return sign + l.tokens.map((t) => t.text).join('')
    })
    .join('\n')
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try { document.execCommand('copy') } catch { /* 忽略 */ }
    document.body.removeChild(ta)
  }
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div class="grid gap-4 md:grid-cols-2">
        <div>
          <label class="field-label">舊版本(原文)</label>
          <textarea
            v-model="oldText"
            rows="8"
            placeholder="貼上修改前的文字…例如合約、條款、規格的舊版。"
            class="field-input font-mono text-sm leading-relaxed"
          ></textarea>
        </div>
        <div>
          <label class="field-label">新版本(對照)</label>
          <textarea
            v-model="newText"
            rows="8"
            placeholder="貼上修改後的文字…馬上看出兩版到底差在哪。"
            class="field-input font-mono text-sm leading-relaxed"
          ></textarea>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-x-5 gap-y-2">
        <label class="flex items-center gap-2 text-sm text-ink-700"><input v-model="opt.ignoreCase" type="checkbox" class="accent-brand-600" />忽略大小寫</label>
        <label class="flex items-center gap-2 text-sm text-ink-700"><input v-model="opt.ignoreWhitespace" type="checkbox" class="accent-brand-600" />忽略空白差異</label>
        <div class="flex flex-wrap gap-2 ml-auto">
          <button class="text-sm text-ink-500 underline hover:text-brand-700" @click="loadExample">載入範例</button>
          <button class="text-sm text-ink-500 underline hover:text-brand-700" @click="swap">對調兩邊</button>
          <button class="text-sm text-ink-500 underline hover:text-brand-700" @click="clearAll">清空</button>
        </div>
      </div>
    </div>

    <!-- 過大提示 -->
    <div v-if="tooBig" class="card p-6 text-center text-ink-600">
      文字太長(超過 {{ MAX_LINES }} 行),為避免瀏覽器卡住暫不比對。請分段貼上。
    </div>

    <!-- 結果 -->
    <div v-else-if="result" class="card p-6 space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span class="font-medium text-emerald-700">＋ 新增 {{ result.added }} 行</span>
          <span class="font-medium text-rose-700">－ 刪除 {{ result.removed }} 行</span>
          <span class="text-ink-500">未變 {{ result.unchanged }} 行</span>
        </div>
        <button class="btn-primary !py-1.5 text-sm" :disabled="identical" @click="copyDiff">
          {{ copied ? '已複製 ✓' : '複製差異' }}
        </button>
      </div>

      <div
        v-if="identical"
        class="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800"
      >
        ✓ 兩個版本完全相同<span v-if="opt.ignoreCase || opt.ignoreWhitespace">(在目前忽略設定下)</span>。
      </div>

      <div v-else class="overflow-x-auto rounded-xl border border-line">
        <table class="w-full border-collapse font-mono text-sm leading-relaxed">
          <tbody>
            <tr
              v-for="(line, i) in result.lines"
              :key="i"
              :class="line.op === '+' ? 'bg-emerald-50' : line.op === '-' ? 'bg-rose-50' : ''"
            >
              <td class="select-none px-2 py-0.5 text-right text-ink-400 align-top w-10 tabular-nums">{{ line.oldNo ?? '' }}</td>
              <td class="select-none px-2 py-0.5 text-right text-ink-400 align-top w-10 tabular-nums border-r border-line">{{ line.newNo ?? '' }}</td>
              <td
                class="select-none px-2 py-0.5 align-top w-6 font-semibold"
                :class="line.op === '+' ? 'text-emerald-700' : line.op === '-' ? 'text-rose-700' : 'text-ink-300'"
              >{{ line.op === '=' ? '' : line.op }}</td>
              <td class="px-2 py-0.5 align-top whitespace-pre-wrap break-words">
                <template v-for="(tk, j) in line.tokens" :key="j">
                  <span
                    v-if="tk.op === '-'"
                    class="rounded bg-rose-200/70 text-rose-900"
                  >{{ tk.text }}</span>
                  <span
                    v-else-if="tk.op === '+'"
                    class="rounded bg-emerald-200/70 text-emerald-900"
                  >{{ tk.text }}</span>
                  <span v-else :class="line.op !== '=' ? 'text-ink-700' : 'text-ink-800'">{{ tk.text }}</span>
                </template>
                <span v-if="line.tokens.length === 1 && line.tokens[0].text === ''" class="text-ink-300">(空行)</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 空狀態 -->
    <div v-else class="card p-6 text-center text-ink-500">
      在上方貼入兩個版本的文字,即時逐行 + 逐字標出差異。
    </div>

    <LegalNote title="為什麼用這個比對?">
      <ul class="list-disc pl-5 space-y-1">
        <li>比對<strong>合約改版、條款、規格、公告</strong>的新舊兩版,逐行還會用顏色標出「行內到底改了哪幾個字」,不必逐字盯。</li>
        <li>多數線上 diff 工具會把你貼上的文字送到他人伺服器 —— 機密合約、個資這樣外流很危險。<strong>這支全程在你瀏覽器計算、不上傳</strong>。</li>
        <li>可<strong>忽略大小寫或空白差異</strong>,排除無意義的格式變動,只看真正的內容改動。</li>
        <li>綠色 ＋ 為新版多出的、紅色 － 為舊版被刪的;同一處修改會配成上下兩行對照。</li>
      </ul>
    </LegalNote>
  </div>
</template>
