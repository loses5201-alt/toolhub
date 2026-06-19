<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  parseInBase,
  toBase,
  convertViews,
  groupBinary,
  bitLength,
  MIN_BASE,
  MAX_BASE,
} from '@/features/baseConvert'

/*
  進位轉換器 —— 2–36 進位互轉,用 BigInt 處理超大整數。
  常用四種(二/八/十/十六)一次列出,另可指定任意進位。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

const fromBase = ref(10)
const input = ref('')
const customBase = ref(36)

const parsed = computed(() => parseInBase(input.value, fromBase.value))

const views = computed(() => (parsed.value.ok ? convertViews(parsed.value.value!) : null))

const customOut = computed(() => {
  if (!parsed.value.ok) return ''
  if (customBase.value < MIN_BASE || customBase.value > MAX_BASE) return ''
  return toBase(parsed.value.value!, customBase.value).toUpperCase()
})

const meta = computed(() => {
  if (!parsed.value.ok) return null
  const v = parsed.value.value!
  return {
    bits: bitLength(v),
    sign: v < 0n ? '負數' : v === 0n ? '零' : '正數',
  }
})

interface Row {
  k: string
  v: string
  mono?: string
}

const rows = computed<Row[]>(() => {
  if (!views.value) return []
  return [
    { k: '二進位 (BIN, base 2)', v: views.value.bin, mono: groupBinary(views.value.bin) },
    { k: '八進位 (OCT, base 8)', v: views.value.oct },
    { k: '十進位 (DEC, base 10)', v: views.value.dec },
    { k: '十六進位 (HEX, base 16)', v: views.value.hex },
  ]
})

const baseOptions = [2, 8, 10, 16]

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* 忽略:某些瀏覽器需 HTTPS 或權限 */
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <!-- 來源進位 -->
      <div>
        <label class="field-label">輸入的數字是幾進位?</label>
        <div class="flex flex-wrap items-center gap-2">
          <button
            v-for="b in baseOptions"
            :key="b"
            type="button"
            class="rounded-lg border px-3 py-1.5 text-sm transition"
            :class="
              fromBase === b
                ? 'border-brand-500 bg-brand-600 text-white'
                : 'border-ink-200 text-ink-600 hover:bg-ink-50'
            "
            @click="fromBase = b"
          >
            {{ b }} 進位
          </button>
          <label class="flex items-center gap-1.5 text-sm text-ink-600">
            其他
            <input
              v-model.number="fromBase"
              type="number"
              :min="MIN_BASE"
              :max="MAX_BASE"
              class="w-16 rounded-lg border border-ink-200 px-2 py-1 text-center"
            />
          </label>
        </div>
      </div>

      <div>
        <label class="field-label">數字</label>
        <input
          v-model="input"
          class="field-input font-mono text-lg"
          placeholder="例如 255、FF、1111 1111"
          spellcheck="false"
          autocomplete="off"
        />
        <p class="field-hint">
          可貼上含<strong>空白或底線</strong>分組的數字(如 <code>1010_1100</code>);二/八/十六進位也接受
          <code>0b</code>/<code>0o</code>/<code>0x</code> 前綴。用 BigInt 運算,<strong>再大的整數也不會失真</strong>。
        </p>
      </div>

      <div
        v-if="input.trim() !== '' && !parsed.ok"
        class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800"
      >
        ⚠️ {{ parsed.error }}
      </div>

      <template v-else-if="views">
        <div
          v-if="meta"
          class="rounded-xl border border-brand-200 bg-brand-50/60 p-3 text-sm text-brand-800"
        >
          {{ meta.sign }} · 二進位 <strong>{{ meta.bits }}</strong> 位元
        </div>

        <div class="grid gap-2">
          <button
            v-for="row in rows"
            :key="row.k"
            type="button"
            class="group rounded-lg bg-ink-50 px-3 py-2 text-left transition hover:bg-ink-100"
            title="點一下複製"
            @click="copy(row.v)"
          >
            <div class="text-xs font-semibold text-ink-400">{{ row.k }}</div>
            <div class="break-all font-mono text-ink-800">{{ row.mono || row.v }}</div>
          </button>
        </div>

        <!-- 任意進位 -->
        <div class="rounded-lg border border-ink-200 p-3">
          <label class="flex flex-wrap items-center gap-2 text-sm text-ink-600">
            轉成
            <input
              v-model.number="customBase"
              type="number"
              :min="MIN_BASE"
              :max="MAX_BASE"
              class="w-16 rounded-lg border border-ink-200 px-2 py-1 text-center"
            />
            進位
          </label>
          <button
            v-if="customOut"
            type="button"
            class="mt-2 block w-full rounded-lg bg-ink-50 px-3 py-2 text-left font-mono text-ink-800 transition hover:bg-ink-100"
            title="點一下複製"
            @click="copy(customOut)"
          >
            {{ customOut }}
          </button>
          <p v-else class="mt-2 text-sm text-amber-700">進位須在 {{ MIN_BASE }}–{{ MAX_BASE }} 之間。</p>
        </div>

        <p class="text-xs text-ink-400">點任一格可複製內容。十六進位以大寫顯示。</p>
      </template>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>看程式、記憶體位址、權限碼、顏色值時,把<strong>十六進位、二進位、十進位</strong>一次對照清楚。</li>
        <li>支援 <strong>2 到 36 進位</strong>任意互轉,連 base32/base36 短碼也行。</li>
        <li>用 <strong>BigInt</strong> 運算,64 位元以上的超大整數也不會像 <code>parseInt</code> 那樣失準。</li>
        <li>二進位自動每 4 位分組、顯示位元長度,讀起來更輕鬆。</li>
        <li>本工具<strong>不連網、不上傳</strong>,全部在你的裝置上計算。</li>
      </ul>
    </LegalNote>
  </div>
</template>
