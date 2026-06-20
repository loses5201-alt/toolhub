<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import { generateSamples } from '@/features/regexGen'

/*
  反向正規表示式 —— 給一個正則樣式,產生一批「符合該樣式」的範例字串。
  造測試資料、確認自己寫的 regex 到底會吃到哪些字串時最好用。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

const pattern = ref('09\\d{8}')
const count = ref(15)
const maxRepeat = ref(5)
const unique = ref(true)
const seed = ref(0) // 點「重新產生」時 +1 觸發重算

const examples: { label: string; expr: string }[] = [
  { label: '台灣手機', expr: '09\\d{8}' },
  { label: 'Email 形狀', expr: '[a-z]{3,8}@[a-z]{3,6}\\.(com|tw|net)' },
  { label: 'IPv4', expr: '\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}' },
  { label: 'Hex 色碼', expr: '#[a-fA-F0-9]{6}' },
  { label: '車牌', expr: '[A-Z]{3}-\\d{4}' },
  { label: '訂單編號', expr: 'ORD-\\d{6}-[A-Z]{2}' },
  { label: '價格', expr: '\\$\\d{1,4}\\.\\d{2}' },
  { label: '日期', expr: '20\\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])' },
]

const result = computed<{ ok: boolean; samples: string[]; error: string }>(() => {
  seed.value // 依賴,讓重新產生有效
  try {
    const samples = generateSamples(pattern.value, {
      count: count.value,
      maxRepeat: maxRepeat.value,
      unique: unique.value,
    })
    return { ok: true, samples, error: '' }
  } catch (e) {
    return { ok: false, samples: [], error: (e as Error).message }
  }
})

const joined = computed(() => result.value.samples.join('\n'))

const copied = ref(false)
function copyAll() {
  if (!joined.value) return
  navigator.clipboard?.writeText(joined.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
const copiedIdx = ref(-1)
function copyOne(s: string, i: number) {
  navigator.clipboard?.writeText(s)
  copiedIdx.value = i
  setTimeout(() => (copiedIdx.value = -1), 1000)
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label" for="rg-pat">正規表示式</label>
        <input
          id="rg-pat"
          v-model="pattern"
          class="field-input font-mono text-sm"
          spellcheck="false"
          placeholder="09\d{8}"
        />
        <p class="field-hint">
          支援 <code>\d \w \s</code>、<code>[a-z]</code> 字元類別、<code>* + ? {n,m}</code> 量詞、<code>|</code> 選擇、<code>( )</code> 群組。全程在你瀏覽器,不上傳。
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          v-for="ex in examples"
          :key="ex.expr"
          type="button"
          class="rounded-full border border-ink-200 px-3 py-1 text-xs text-ink-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
          @click="pattern = ex.expr"
        >
          {{ ex.label }}
        </button>
      </div>

      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <label class="text-sm text-ink-600">
          產生筆數
          <input v-model.number="count" type="number" min="1" max="500" class="field-input mt-1" />
        </label>
        <label class="text-sm text-ink-600">
          重複次數上限
          <input v-model.number="maxRepeat" type="number" min="0" max="50" class="field-input mt-1" />
        </label>
        <label class="flex items-end gap-1.5 pb-2 text-sm text-ink-600">
          <input v-model="unique" type="checkbox" class="rounded" />
          盡量不重複
        </label>
      </div>
    </div>

    <div v-if="!result.ok" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
      ⚠️ 無法解析:{{ result.error }}
    </div>

    <div v-else class="card p-4 space-y-3">
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-emerald-700">產生 {{ result.samples.length }} 筆</span>
        <button class="text-sm text-brand-700 underline hover:text-brand-800" @click="seed++">重新產生</button>
        <button class="ml-auto text-sm text-brand-700 underline hover:text-brand-800" @click="copyAll">
          {{ copied ? '已複製 ✓' : '全部複製' }}
        </button>
      </div>
      <ul class="divide-y divide-ink-100 rounded-lg border border-ink-100">
        <li
          v-for="(s, i) in result.samples"
          :key="i"
          class="flex items-center gap-2 px-3 py-1.5 font-mono text-sm text-ink-700"
        >
          <span class="flex-1 break-all">{{ s === '' ? '(空字串)' : s }}</span>
          <button
            class="shrink-0 text-xs text-brand-600 opacity-70 hover:opacity-100"
            @click="copyOne(s, i)"
          >
            {{ copiedIdx === i ? '✓' : '複製' }}
          </button>
        </li>
      </ul>
    </div>

    <div class="text-sm text-ink-500">
      想反過來<strong>測試</strong>一段文字是否符合某個正則?用
      <RouterLink to="/tools/regex-tester" class="font-semibold text-brand-700 underline hover:text-brand-800">正規表達式測試器</RouterLink>
      。需要假姓名、地址等<strong>測試資料</strong>?用
      <RouterLink to="/tools/fake-data" class="font-semibold text-brand-700 underline hover:text-brand-800">假資料產生器</RouterLink>
      。
    </div>

    <LegalNote title="這個工具能、不能做什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>能</strong>:把正則樣式「倒過來」生成符合的範例字串 —— 支援字面字元、<code>.</code>、字元類別 <code>[a-z0-9]</code>(含範圍與否定 <code>[^...]</code>)、<code>\d \w \s</code> 與其大寫否定、量詞 <code>* + ? {n} {n,} {n,m}</code>、選擇 <code>|</code>、群組 <code>( )</code> 與 <code>(?: )</code>。</li>
        <li><strong>做法</strong>:無上限量詞(<code>*</code>、<code>+</code>、<code>{n,}</code>)會以「重複次數上限」收斂,避免產生過長字串;錨點 <code>^ $ \b</code> 與前瞻 <code>(?=) (?!)</code> 視為零寬、生成時略過。</li>
        <li><strong>不能</strong>:反向參照 <code>\1</code>、具名群組、Unicode 屬性 <code>\p{...}</code> 等進階語法;遇到不支援的寫法會誠實報錯。</li>
        <li>全程<strong>在你的瀏覽器</strong>計算,內容<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
