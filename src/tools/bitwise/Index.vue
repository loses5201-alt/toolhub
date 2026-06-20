<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  parseIntInput,
  compute,
  views,
  toHex,
  groupBin,
  WIDTHS,
  type Width,
  type OpRow,
} from '@/features/bitwise'

/*
  位元運算計算機 —— AND / OR / XOR / NOT / NAND / NOR / XNOR、左右移,
  支援 8 / 16 / 32 / 64 位元固定寬度與二補數(負數、有號/無號對照)。
  以 BigInt 運算,64 位元也不失真。全程在你的瀏覽器計算,不連網、不上傳。
*/

const inputA = ref('')
const inputB = ref('')
const bits = ref<Width>(8)
const shift = ref(1)

const parsedA = computed(() => parseIntInput(inputA.value))
const parsedB = computed(() => parseIntInput(inputB.value))

const viewA = computed(() =>
  parsedA.value.ok ? views(parsedA.value.value!, bits.value) : null,
)
const viewB = computed(() =>
  parsedB.value.ok ? views(parsedB.value.value!, bits.value) : null,
)

// 邏輯(雙運算元)需要 A、B 皆有效;位移與 NOT A 只需 A
const rows = computed<OpRow[]>(() => {
  if (!parsedA.value.ok) return []
  const b = parsedB.value.ok ? parsedB.value.value! : 0n
  return compute(parsedA.value.value!, b, bits.value, shift.value)
})

const binaryOps = new Set(['and', 'or', 'xor', 'nand', 'nor', 'xnor', 'notb'])
const visibleRows = computed(() =>
  rows.value.filter((r) => {
    if (binaryOps.has(r.key) && !parsedB.value.ok) return false
    if (r.key === 'notb' && !parsedB.value.ok) return false
    return true
  }),
)

function rowViews(v: bigint) {
  return views(v, bits.value)
}

const copied = ref<string | null>(null)
async function copy(text: string, tag: string) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = tag
    setTimeout(() => (copied.value = null), 1200)
  } catch {
    /* 某些瀏覽器需 HTTPS 或權限,忽略 */
  }
}

function loadExample() {
  inputA.value = '0xCC'
  inputB.value = '0xAA'
  bits.value = 8
  shift.value = 1
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-5">
      <!-- 位元寬度 -->
      <div>
        <label class="field-label">位元寬度</label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="w in WIDTHS"
            :key="w"
            type="button"
            class="rounded-lg border px-3 py-1.5 text-sm transition"
            :class="
              bits === w
                ? 'border-brand-500 bg-brand-600 text-white'
                : 'border-ink-200 text-ink-600 hover:bg-ink-50'
            "
            @click="bits = w"
          >
            {{ w }}-bit
          </button>
        </div>
      </div>

      <!-- 運算元 A -->
      <div>
        <label class="field-label">運算元 A</label>
        <input
          v-model="inputA"
          class="field-input font-mono text-lg"
          placeholder="例如 0xCC、11001100、204"
          spellcheck="false"
          autocomplete="off"
        />
        <p
          v-if="inputA.trim() && !parsedA.ok"
          class="mt-1 text-sm text-amber-700"
        >
          ⚠️ {{ parsedA.error }}
        </p>
        <div v-else-if="viewA" class="mt-1.5 font-mono text-xs text-ink-500">
          {{ viewA.binGrouped }} · 無號 {{ viewA.unsigned }} · 有號
          {{ viewA.signed }} · {{ viewA.bits }} 個 1
        </div>
      </div>

      <!-- 運算元 B -->
      <div>
        <label class="field-label">運算元 B<span class="text-ink-400">(位移、NOT A 可留空)</span></label>
        <input
          v-model="inputB"
          class="field-input font-mono text-lg"
          placeholder="例如 0xAA、10101010、170"
          spellcheck="false"
          autocomplete="off"
        />
        <p
          v-if="inputB.trim() && !parsedB.ok"
          class="mt-1 text-sm text-amber-700"
        >
          ⚠️ {{ parsedB.error }}
        </p>
        <div v-else-if="viewB" class="mt-1.5 font-mono text-xs text-ink-500">
          {{ viewB.binGrouped }} · 無號 {{ viewB.unsigned }} · 有號
          {{ viewB.signed }} · {{ viewB.bits }} 個 1
        </div>
      </div>

      <!-- 位移量 -->
      <div>
        <label class="field-label">位移量(用於 &lt;&lt; 與 &gt;&gt;)</label>
        <input
          v-model.number="shift"
          type="number"
          min="0"
          :max="bits"
          class="w-24 rounded-lg border border-ink-200 px-3 py-1.5 text-center"
        />
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-lg border border-ink-200 px-3 py-1.5 text-sm text-ink-600 hover:bg-ink-50"
          @click="loadExample"
        >
          載入範例(0xCC、0xAA)
        </button>
      </div>

      <p
        v-if="!inputA.trim()"
        class="rounded-xl border border-ink-200 bg-ink-50/60 p-3 text-sm text-ink-500"
      >
        輸入運算元 A 後,即時顯示各種位元運算結果。輸入支援
        <code>0x</code>/<code>0b</code>/<code>0o</code> 前綴與底線分組。
      </p>

      <!-- 結果 -->
      <div v-else-if="visibleRows.length" class="grid gap-2">
        <button
          v-for="row in visibleRows"
          :key="row.key"
          type="button"
          class="group rounded-lg bg-ink-50 px-3 py-2 text-left transition hover:bg-ink-100"
          title="點一下複製十六進位"
          @click="copy('0x' + toHex(row.value, bits), row.key)"
        >
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-ink-500">{{ row.label }}</span>
            <span
              class="text-xs"
              :class="copied === row.key ? 'text-emerald-600' : 'text-ink-300'"
            >
              {{ copied === row.key ? '已複製!' : '點一下複製' }}
            </span>
          </div>
          <div class="mt-0.5 break-all font-mono text-ink-800">
            {{ groupBin(rowViews(row.value).bin) }}
          </div>
          <div class="mt-0.5 font-mono text-xs text-ink-500">
            0x{{ toHex(row.value, bits) }} · 無號 {{ rowViews(row.value).unsigned }} · 有號
            {{ rowViews(row.value).signed }}
          </div>
        </button>
      </div>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>
          做韌體 / 嵌入式 / 通訊協定 / 旗標(flag)位元遮罩時,
          <strong>AND、OR、XOR、NOT、左右移</strong>一次算清楚並對照二進位。
        </li>
        <li>
          可選 <strong>8 / 16 / 32 / 64 位元</strong>固定寬度,
          自動處理<strong>二補數</strong>,有號 / 無號值並列,負數也算得對。
        </li>
        <li>
          右移分「<strong>邏輯右移</strong> &gt;&gt;&gt;(補 0)」與「<strong>算術右移</strong> &gt;&gt;(補符號位)」,看清楚差別。
        </li>
        <li>
          輸入支援 <code>0x</code> / <code>0b</code> / <code>0o</code> 前綴與底線分組,
          以 <strong>BigInt</strong> 運算,64 位元也不像 JS 原生位元運算只到 32 位元而失真。
        </li>
        <li>本工具<strong>不連網、不上傳</strong>,全部在你的裝置上計算。</li>
      </ul>
    </LegalNote>
  </div>
</template>
