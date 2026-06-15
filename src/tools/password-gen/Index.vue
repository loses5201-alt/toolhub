<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import LegalNote from '@/components/LegalNote.vue'

/*
  本機密碼產生器 —— 用瀏覽器內建的密碼學亂數(crypto.getRandomValues),
  全程在你電腦產生,不上傳、不連網、不記錄。線上密碼產生器最大的風險就是
  「它可能偷偷記下幫你產的密碼」,所以這種工具就該在本機、可檢視原始碼地跑。
*/
const len = ref(16)
const count = ref(5)
const opt = reactive({
  lower: true,
  upper: true,
  digit: true,
  symbol: true,
  excludeAmbiguous: true, // 排除易混淆:0 O o 1 l I |
})

const SETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digit: '0123456789',
  symbol: '!@#$%^&*()-_=+[]{};:,.?',
}
const AMBIGUOUS = new Set('0Oo1lI|'.split(''))

const passwords = ref<string[]>([])
const copiedIdx = ref<number | null>(null)

// 無偏差的 [0, n) 亂數:用拒絕取樣避免取模偏差(modulo bias)
function randIndex(n: number): number {
  const max = Math.floor(0x100000000 / n) * n
  const buf = new Uint32Array(1)
  let x = 0
  do {
    crypto.getRandomValues(buf)
    x = buf[0]
  } while (x >= max)
  return x % n
}

// 選用的字元類別(套用排除易混淆後)
const activeSets = computed(() => {
  const sets: string[] = []
  for (const key of ['lower', 'upper', 'digit', 'symbol'] as const) {
    if (!opt[key]) continue
    let chars = SETS[key]
    if (opt.excludeAmbiguous) {
      chars = chars.split('').filter((c) => !AMBIGUOUS.has(c)).join('')
    }
    if (chars) sets.push(chars)
  }
  return sets
})

const pool = computed(() => activeSets.value.join(''))

// 密碼熵(位元)= 長度 × log2(字元池大小);用來標示強度
const entropy = computed(() => {
  const size = pool.value.length
  if (size <= 1 || len.value <= 0) return 0
  return Math.round(len.value * Math.log2(size))
})
const strength = computed(() => {
  const b = entropy.value
  if (b < 50) return { label: '偏弱', cls: 'text-red-600' }
  if (b < 70) return { label: '尚可', cls: 'text-amber-600' }
  if (b < 100) return { label: '強', cls: 'text-brand-700' }
  return { label: '非常強', cls: 'text-emerald-600' }
})

function genOne(): string {
  const sets = activeSets.value
  const all = pool.value
  const chars: string[] = []
  // 先保證每個選用類別至少各出現一個,再用整體字元池補滿
  for (const s of sets) {
    if (chars.length < len.value) chars.push(s[randIndex(s.length)])
  }
  while (chars.length < len.value) {
    chars.push(all[randIndex(all.length)])
  }
  // Fisher–Yates 洗牌,讓「保證字元」的位置也隨機
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randIndex(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

function generate() {
  if (!pool.value) {
    passwords.value = []
    return
  }
  const n = Math.min(Math.max(count.value, 1), 50)
  const out: string[] = []
  for (let i = 0; i < n; i++) out.push(genOne())
  passwords.value = out
  copiedIdx.value = null
}

async function copy(text: string, idx: number) {
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
  copiedIdx.value = idx
  setTimeout(() => { if (copiedIdx.value === idx) copiedIdx.value = null }, 1500)
}

onMounted(generate)
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-5">
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label">密碼長度:{{ len }}</label>
          <input v-model.number="len" type="range" min="6" max="64" class="w-full accent-brand-600" />
        </div>
        <div>
          <label class="field-label">一次產生幾組:{{ count }}</label>
          <input v-model.number="count" type="range" min="1" max="20" class="w-full accent-brand-600" />
        </div>
      </div>

      <div>
        <div class="field-label">包含字元</div>
        <div class="grid gap-2 sm:grid-cols-2">
          <label class="flex items-center gap-2 text-sm text-ink-700"><input v-model="opt.lower" type="checkbox" class="accent-brand-600" />小寫字母 a–z</label>
          <label class="flex items-center gap-2 text-sm text-ink-700"><input v-model="opt.upper" type="checkbox" class="accent-brand-600" />大寫字母 A–Z</label>
          <label class="flex items-center gap-2 text-sm text-ink-700"><input v-model="opt.digit" type="checkbox" class="accent-brand-600" />數字 0–9</label>
          <label class="flex items-center gap-2 text-sm text-ink-700"><input v-model="opt.symbol" type="checkbox" class="accent-brand-600" />符號 !@#$…</label>
          <label class="flex items-center gap-2 text-sm text-ink-700 sm:col-span-2"><input v-model="opt.excludeAmbiguous" type="checkbox" class="accent-brand-600" />排除易混淆字元(0 O o 1 l I |)</label>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-4">
        <button class="btn-primary" :disabled="!pool" @click="generate">重新產生</button>
        <p v-if="pool" class="text-sm text-ink-500">
          強度:<span class="font-semibold" :class="strength.cls">{{ strength.label }}</span>
          <span class="text-ink-400">(約 {{ entropy }} 位元亂度)</span>
        </p>
        <p v-else class="text-sm text-red-600">請至少勾選一種字元類別。</p>
      </div>
    </div>

    <div v-if="passwords.length" class="card p-3 sm:p-4">
      <ul class="divide-y divide-line">
        <li v-for="(p, i) in passwords" :key="i" class="flex items-center gap-3 px-1 py-2.5">
          <code class="min-w-0 flex-1 break-all font-mono text-sm text-ink-900 sm:text-base">{{ p }}</code>
          <button
            class="shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm text-ink-700 transition hover:border-brand-300 hover:text-brand-700"
            @click="copy(p, i)"
          >
            {{ copiedIdx === i ? '已複製 ✓' : '複製' }}
          </button>
        </li>
      </ul>
    </div>

    <LegalNote title="為什麼用本機產生器,而不是隨便一個線上網站?">
      <ul class="list-disc pl-5 space-y-1">
        <li>線上密碼產生器最大的疑慮是:<strong>它可能在伺服器端偷偷記下幫你產的密碼</strong>。本工具完全在你瀏覽器執行、不連網、不上傳。</li>
        <li>用的是瀏覽器內建的密碼學等級亂數 <code>crypto.getRandomValues</code>,並以拒絕取樣避免偏差,夠隨機。</li>
        <li>建議:重要帳號用 <strong>16 碼以上</strong>、每個網站<strong>不同密碼</strong>,並搭配密碼管理員與兩步驟驗證。</li>
        <li>本頁產生的密碼不會被儲存,重新整理就消失。請自行複製到安全的地方保管。</li>
      </ul>
    </LegalNote>
  </div>
</template>
