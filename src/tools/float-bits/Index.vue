<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { breakdown, breakdownFromHex, type FloatWidth } from '@/features/floatBits'

/*
  IEEE 754 浮點數位元檢視器 —— 輸入十進位數字(或反過來貼 16 進位),
  拆解成電腦實際儲存的符號 / 指數 / 尾數位元,並算出「真正存進去的精確十進位值」,
  解釋為何 0.1 + 0.2 ≠ 0.3。可切 64 位元(double)/ 32 位元(float)。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

const width = ref<FloatWidth>(64)
const mode = ref<'dec' | 'hex'>('dec')
const decInput = ref('0.1')
const hexInput = ref('')

const result = computed(() => {
  if (mode.value === 'hex') {
    return breakdownFromHex(hexInput.value, width.value)
  }
  const t = decInput.value.trim()
  if (t === '') return null
  if (t === 'NaN') return breakdown(NaN, width.value)
  if (t === 'Infinity' || t === '+Infinity') return breakdown(Infinity, width.value)
  if (t === '-Infinity') return breakdown(-Infinity, width.value)
  const n = Number(t)
  if (Number.isNaN(n)) return null
  return breakdown(n, width.value)
})

const expLen = computed(() => (width.value === 64 ? 11 : 8))

const classLabel: Record<string, string> = {
  zero: '零',
  subnormal: '非正規(subnormal,極小值)',
  normal: '正規數(normal)',
  infinity: '無窮大',
  nan: '非數(NaN)',
}

const lostPrecision = computed(() => {
  const r = result.value
  if (!r || mode.value === 'hex') return false
  if (r.classification === 'nan' || r.classification === 'infinity') return false
  // 輸入字串去掉正負號與科學記號後,與精確值比較是否不同
  return decInput.value.trim() !== '' && String(r.roundTrip) !== r.exactValue && r.exactValue.includes('.')
})

const copied = ref('')
function copy(text: string, tag: string) {
  navigator.clipboard?.writeText(text)
  copied.value = tag
  setTimeout(() => (copied.value = ''), 1500)
}
</script>

<template>
  <div class="space-y-6">
    <!-- 設定 -->
    <div class="card p-5 space-y-4">
      <div class="flex flex-wrap items-center gap-4">
        <div class="flex rounded-lg border border-ink-200 p-0.5 text-sm">
          <button
            type="button"
            class="rounded-md px-3 py-1"
            :class="width === 64 ? 'bg-brand-500 text-white' : 'text-ink-600'"
            @click="width = 64"
          >
            64 位元 double
          </button>
          <button
            type="button"
            class="rounded-md px-3 py-1"
            :class="width === 32 ? 'bg-brand-500 text-white' : 'text-ink-600'"
            @click="width = 32"
          >
            32 位元 float
          </button>
        </div>
        <div class="flex rounded-lg border border-ink-200 p-0.5 text-sm">
          <button
            type="button"
            class="rounded-md px-3 py-1"
            :class="mode === 'dec' ? 'bg-ink-700 text-white' : 'text-ink-600'"
            @click="mode = 'dec'"
          >
            十進位 → 位元
          </button>
          <button
            type="button"
            class="rounded-md px-3 py-1"
            :class="mode === 'hex' ? 'bg-ink-700 text-white' : 'text-ink-600'"
            @click="mode = 'hex'"
          >
            16 進位 → 反查
          </button>
        </div>
      </div>

      <label v-if="mode === 'dec'" class="block text-sm">
        <span class="text-ink-500">輸入數字(可填 NaN、Infinity、-Infinity)</span>
        <input
          v-model="decInput"
          type="text"
          inputmode="decimal"
          placeholder="例如 0.1、3.14159、1e-10"
          class="fb-input font-mono"
        />
      </label>
      <label v-else class="block text-sm">
        <span class="text-ink-500">輸入 16 進位({{ width / 4 }} 位)</span>
        <input
          v-model="hexInput"
          type="text"
          :placeholder="width === 64 ? '3FF0000000000000' : '3F800000'"
          class="fb-input font-mono"
        />
      </label>
    </div>

    <template v-if="result">
      <!-- 位元視覺 -->
      <div class="card p-5 space-y-3 overflow-x-auto">
        <div class="flex items-center gap-3">
          <span class="text-sm font-semibold text-ink-700">位元排列</span>
          <button
            type="button"
            class="ml-auto rounded-lg border border-ink-200 px-3 py-1 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
            @click="copy(result.bits, 'bits')"
          >
            {{ copied === 'bits' ? '已複製' : '複製位元' }}
          </button>
        </div>
        <div class="flex flex-wrap gap-0.5 font-mono text-sm">
          <span
            class="rounded bg-rose-100 px-1.5 py-1 text-rose-700"
            title="符號 sign"
          >{{ result.signBit }}</span>
          <span
            v-for="(b, i) in result.exponentBits.split('')"
            :key="'e' + i"
            class="rounded bg-amber-100 px-1.5 py-1 text-amber-700"
            title="指數 exponent"
          >{{ b }}</span>
          <span
            v-for="(b, i) in result.fractionBits.split('')"
            :key="'f' + i"
            class="rounded bg-sky-100 px-1.5 py-1 text-sky-700"
            title="尾數 fraction"
          >{{ b }}</span>
        </div>
        <div class="flex flex-wrap gap-4 text-xs text-ink-500">
          <span><span class="inline-block h-3 w-3 rounded bg-rose-200 align-middle"></span> 符號 1 位</span>
          <span><span class="inline-block h-3 w-3 rounded bg-amber-200 align-middle"></span> 指數 {{ expLen }} 位</span>
          <span><span class="inline-block h-3 w-3 rounded bg-sky-200 align-middle"></span> 尾數 {{ result.fractionBits.length }} 位</span>
        </div>
      </div>

      <!-- 數值摘要 -->
      <div class="card p-5 grid gap-3 sm:grid-cols-2 text-sm">
        <div>
          <span class="text-ink-500">16 進位</span>
          <div class="flex items-center gap-2">
            <code class="font-mono text-ink-800">0x{{ result.hex }}</code>
            <button
              type="button"
              class="text-xs text-ink-400 underline hover:text-ink-600"
              @click="copy('0x' + result.hex, 'hex')"
            >{{ copied === 'hex' ? '已複製' : '複製' }}</button>
          </div>
        </div>
        <div>
          <span class="text-ink-500">分類</span>
          <div class="text-ink-800">{{ classLabel[result.classification] }}</div>
        </div>
        <div>
          <span class="text-ink-500">符號</span>
          <div class="text-ink-800">{{ result.signValue === -1 ? '負 (−)' : '正 (+)' }}</div>
        </div>
        <div>
          <span class="text-ink-500">指數(去偏移)</span>
          <div class="text-ink-800">
            <template v-if="result.unbiasedExponent === null">—</template>
            <template v-else>
              2<sup>{{ result.unbiasedExponent }}</sup>(原始 {{ result.rawExponent }})
            </template>
          </div>
        </div>
      </div>

      <!-- 精確值 -->
      <div class="card p-5 space-y-2">
        <div class="flex items-center gap-3">
          <span class="text-sm font-semibold text-ink-700">實際存進去的精確值</span>
          <button
            type="button"
            class="ml-auto rounded-lg border border-ink-200 px-3 py-1 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
            @click="copy(result.exactValue, 'exact')"
          >
            {{ copied === 'exact' ? '已複製' : '複製' }}
          </button>
        </div>
        <pre class="whitespace-pre-wrap break-all font-mono text-sm text-ink-800">{{ result.exactValue }}</pre>
        <p v-if="lostPrecision" class="text-xs text-amber-600">
          ⚠️ 你輸入的數字無法用二進位精確表示,實際儲存值如上(與顯示的
          <code>{{ result.roundTrip }}</code> 是同一個 double,只是這裡展開到完整位數)。
        </p>
      </div>
    </template>
    <p v-else class="card p-5 text-sm text-ink-500">
      請輸入有效的{{ mode === 'hex' ? ` ${width / 4} 位 16 進位` : '數字' }}。
    </p>

    <LegalNote>
      IEEE 754 把浮點數存成「符號 × 1.尾數 × 2<sup>指數</sup>」。許多十進位小數(如 0.1)在二進位是無限循環,
      只能取最接近的可表示值 —— 這就是浮點誤差的根源。「精確值」是把實際儲存的位元用 BigInt 完整展開的十進位
      (分母為 2 的次方,必為有限位)。全程在你的瀏覽器計算,不連網、不上傳。
    </LegalNote>
  </div>
</template>

<style scoped>
.fb-input {
  width: 100%;
  margin-top: 0.25rem;
  border: 1px solid var(--color-ink-200, #e2e8f0);
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
  font-size: 0.95rem;
}
</style>
