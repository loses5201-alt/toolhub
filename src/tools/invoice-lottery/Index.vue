<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import ResultStat from '@/components/ResultStat.vue'
import LegalNote from '@/components/LegalNote.vue'
import { ntd } from '@/utils/format'

interface InvoiceData {
  period: string
  deadline: string
  isSample: boolean
  special: string
  grand: string
  first: string[]
  additional6: string[]
}

const data = ref<InvoiceData | null>(null)
const status = ref<'loading' | 'ready' | 'error'>('loading')
const input = ref('')

onMounted(async () => {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/invoice.json`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    data.value = await res.json()
    status.value = 'ready'
  } catch {
    data.value = null
    status.value = 'error'
  }
})

// 比對末幾碼相同
function matchLen(winning: string, user: string): number {
  let len = 0
  for (let i = 1; i <= Math.min(winning.length, user.length); i++) {
    if (winning[winning.length - i] === user[user.length - i]) len++
    else break
  }
  return len
}

const PRIZE: Record<number, { amount: number; name: string }> = {
  8: { amount: 200000, name: '頭獎' },
  7: { amount: 40000, name: '二獎' },
  6: { amount: 10000, name: '三獎' },
  5: { amount: 4000, name: '四獎' },
  4: { amount: 1000, name: '五獎' },
  3: { amount: 200, name: '六獎' },
}

const cleaned = computed(() => input.value.replace(/\D/g, ''))

const result = computed(() => {
  const d = data.value
  const u = cleaned.value
  if (!d || u.length < 3) return null

  // 特別獎 / 特獎:末 8 碼全中
  if (u.length >= 8) {
    if (u.slice(-8) === d.special) return { amount: 10_000_000, name: '特別獎' }
    if (u.slice(-8) === d.grand) return { amount: 2_000_000, name: '特獎' }
  }

  let best: { amount: number; name: string } | null = null
  for (const w of d.first) {
    const len = matchLen(w, u)
    const prize = PRIZE[Math.min(len, 8)]
    if (prize && len >= 3 && (!best || prize.amount > best.amount)) best = prize
  }
  for (const a of d.additional6) {
    if (u.slice(-3) === a && (!best || best.amount < 200)) best = { amount: 200, name: '增開六獎' }
  }
  return best ?? { amount: 0, name: '沒中獎' }
})
</script>

<template>
  <div class="space-y-6">
    <div v-if="status === 'loading'" class="card p-6 text-center text-ink-500">載入中獎號碼…</div>

    <div
      v-else-if="status === 'error'"
      class="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800"
    >
      📡 中獎號碼暫時載入不到,請稍後重新整理,或改用
      <a href="https://www.etax.nat.gov.tw/" target="_blank" rel="noopener noreferrer" class="underline">財政部官方對獎</a>。
    </div>

    <div
      v-if="data?.isSample"
      class="rounded-2xl border border-accent/40 bg-accent/5 p-4 text-sm text-ink-700"
    >
      ⚠️ 目前是<strong>範例號碼</strong>,尚未填入真實中獎號碼。請更新
      <code class="rounded bg-white px-1">public/data/invoice.json</code>,或改用
      <a href="https://www.etax.nat.gov.tw/" target="_blank" rel="noopener noreferrer" class="text-brand-700 underline">財政部官方對獎</a>。
    </div>

    <div class="card p-6 space-y-3">
      <div>
        <label class="field-label">輸入發票號碼(末 8 碼)</label>
        <input
          v-model="input"
          inputmode="numeric"
          maxlength="12"
          placeholder="例:22222222"
          class="field-input tracking-widest text-center text-2xl"
        />
        <p class="field-hint">只需輸入發票號碼右邊的數字,系統自動比對末幾碼。</p>
      </div>
      <p v-if="data" class="text-sm text-ink-500">對獎期別:{{ data.period }}</p>
    </div>

    <div v-if="result" class="space-y-4">
      <ResultStat
        v-if="result.amount > 0"
        :label="`恭喜中了 ${result.name}`"
        :value="ntd(result.amount)"
        highlight
      />
      <div v-else class="card p-8 text-center">
        <div class="text-4xl">🍀</div>
        <div class="mt-2 text-lg font-semibold text-ink-700">這張沒中,下次再來</div>
      </div>
    </div>

    <LegalNote title="獎別對照(統一發票)">
      <ul class="list-disc pl-5 space-y-0.5">
        <li>特別獎:末 8 碼相同 → 1,000 萬</li>
        <li>特獎:末 8 碼相同 → 200 萬</li>
        <li>頭獎:末 8 碼相同 → 20 萬;末 7~3 碼相同 → 4 萬 / 1 萬 / 4,000 / 1,000 / 200</li>
        <li>增開六獎:末 3 碼相同 → 200 元</li>
      </ul>
      <p class="text-ink-500">中獎號碼每期更新,請以財政部公告為準。本工具僅協助比對,不代表實際兌獎資格。</p>
    </LegalNote>
  </div>
</template>
