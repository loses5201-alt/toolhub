<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  possibleABO,
  possibleRh,
  summarizeABO,
  aboPhenotypeDist,
  rhPhenotypeDist,
  pct,
  type ABOPheno,
  type RhPheno,
} from '@/features/bloodType'

/*
  血型遺傳計算 —— 依孟德爾遺傳法則推算子女可能的血型。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

const aboTypes: ABOPheno[] = ['A', 'B', 'AB', 'O']
const p1 = ref<ABOPheno>('A')
const p2 = ref<ABOPheno>('B')
const rh1 = ref<RhPheno | 'unknown'>('unknown')
const rh2 = ref<RhPheno | 'unknown'>('unknown')

const aboResult = computed(() => summarizeABO(p1.value, p2.value))
const possibleAboList = computed(() => possibleABO(p1.value, p2.value))

// Rh:只有兩邊都確定時才推論
const rhResult = computed(() => {
  if (rh1.value === 'unknown' || rh2.value === 'unknown') return null
  return possibleRh(rh1.value, rh2.value)
})

// 父母基因型若皆可確定(AB/O 只有一種基因型),給精確機率;否則只列可能
const exactDist = computed(() => {
  const g1s = p1.value === 'AB' ? 'AB' : p1.value === 'O' ? 'OO' : null
  const g2s = p2.value === 'AB' ? 'AB' : p2.value === 'O' ? 'OO' : null
  if (!g1s || !g2s) return null
  return aboPhenotypeDist(g1s, g2s)
})

function isPossible(t: ABOPheno) {
  return possibleAboList.value.includes(t)
}

const rhExactDist = computed(() => {
  // 只有兩邊都是 Rh− 時基因型唯一(dd×dd),機率確定
  if (rh1.value === '-' && rh2.value === '-') return rhPhenotypeDist('dd', 'dd')
  return null
})
</script>

<template>
  <div class="space-y-6">
    <!-- 父母輸入 -->
    <div class="card p-6 space-y-5">
      <div class="grid gap-5 sm:grid-cols-2">
        <div>
          <div class="field-label mb-2">父母一方的血型</div>
          <div class="flex gap-2">
            <button
              v-for="t in aboTypes"
              :key="t"
              type="button"
              class="flex-1 rounded-xl border px-3 py-2 text-lg font-bold transition"
              :class="p1 === t ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-line text-ink-600 hover:border-brand-300'"
              @click="p1 = t"
            >
              {{ t }}
            </button>
          </div>
          <div class="mt-2 flex gap-2 text-sm">
            <button type="button" class="rounded-lg border px-2 py-1" :class="rh1 === '+' ? 'border-brand-400 bg-brand-50' : 'border-line text-ink-500'" @click="rh1 = '+'">Rh+</button>
            <button type="button" class="rounded-lg border px-2 py-1" :class="rh1 === '-' ? 'border-brand-400 bg-brand-50' : 'border-line text-ink-500'" @click="rh1 = '-'">Rh−</button>
            <button type="button" class="rounded-lg border px-2 py-1" :class="rh1 === 'unknown' ? 'border-brand-400 bg-brand-50' : 'border-line text-ink-500'" @click="rh1 = 'unknown'">不確定</button>
          </div>
        </div>
        <div>
          <div class="field-label mb-2">父母另一方的血型</div>
          <div class="flex gap-2">
            <button
              v-for="t in aboTypes"
              :key="t"
              type="button"
              class="flex-1 rounded-xl border px-3 py-2 text-lg font-bold transition"
              :class="p2 === t ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-line text-ink-600 hover:border-brand-300'"
              @click="p2 = t"
            >
              {{ t }}
            </button>
          </div>
          <div class="mt-2 flex gap-2 text-sm">
            <button type="button" class="rounded-lg border px-2 py-1" :class="rh2 === '+' ? 'border-brand-400 bg-brand-50' : 'border-line text-ink-500'" @click="rh2 = '+'">Rh+</button>
            <button type="button" class="rounded-lg border px-2 py-1" :class="rh2 === '-' ? 'border-brand-400 bg-brand-50' : 'border-line text-ink-500'" @click="rh2 = '-'">Rh−</button>
            <button type="button" class="rounded-lg border px-2 py-1" :class="rh2 === 'unknown' ? 'border-brand-400 bg-brand-50' : 'border-line text-ink-500'" @click="rh2 = 'unknown'">不確定</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 結果 -->
    <div class="card p-6 space-y-5">
      <h2 class="text-lg font-bold text-ink-900">子女可能的血型(ABO)</h2>
      <div class="grid grid-cols-4 gap-3">
        <div
          v-for="t in aboTypes"
          :key="t"
          class="rounded-xl border p-4 text-center"
          :class="isPossible(t) ? 'border-green-300 bg-green-50' : 'border-line bg-ink-50/50 opacity-50'"
        >
          <div class="text-2xl font-black" :class="isPossible(t) ? 'text-green-700' : 'text-ink-400 line-through'">{{ t }}</div>
          <div class="mt-1 text-xs" :class="isPossible(t) ? 'text-green-600' : 'text-ink-400'">
            <template v-if="exactDist">{{ exactDist[t] ? pct(exactDist[t]) : '不可能' }}</template>
            <template v-else>{{ isPossible(t) ? '可能' : '不可能' }}</template>
          </div>
        </div>
      </div>
      <p v-if="exactDist" class="text-sm text-ink-500">
        父母基因型可完全確定(含 AB 或 O 型),上方為精確機率。
      </p>
      <p v-else class="text-sm text-ink-500">
        因 A、B 型可能帶有隱性 O 基因(基因型 AA 或 AO 無法從血型分辨),只能列出「可能 / 不可能」,
        確切機率需知道父母的基因型。
      </p>
      <div v-if="aboResult.impossible.length" class="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
        這對父母<strong>不可能</strong>生出 <strong>{{ aboResult.impossible.join('、') }}</strong> 型的孩子。
      </div>
    </div>

    <!-- Rh -->
    <div v-if="rhResult" class="card p-6 space-y-3">
      <h2 class="text-lg font-bold text-ink-900">子女可能的 Rh 別</h2>
      <div class="flex gap-3">
        <div
          v-for="r in (['+', '-'] as RhPheno[])"
          :key="r"
          class="flex-1 rounded-xl border p-4 text-center"
          :class="rhResult.includes(r) ? 'border-green-300 bg-green-50' : 'border-line bg-ink-50/50 opacity-50'"
        >
          <div class="text-xl font-black" :class="rhResult.includes(r) ? 'text-green-700' : 'text-ink-400 line-through'">Rh{{ r }}</div>
          <div class="mt-1 text-xs" :class="rhResult.includes(r) ? 'text-green-600' : 'text-ink-400'">
            <template v-if="rhExactDist">{{ rhExactDist[r] ? pct(rhExactDist[r]) : '不可能' }}</template>
            <template v-else>{{ rhResult.includes(r) ? '可能' : '不可能' }}</template>
          </div>
        </div>
      </div>
      <p v-if="rh1 === '-' && rh2 === '-'" class="text-sm text-ink-500">兩位都是 Rh−,孩子<strong>必為 Rh−</strong>。</p>
    </div>

    <LegalNote title="原理與限制(僅供參考)">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>ABO 血型</strong>由一組基因決定,有 A、B、O 三種等位基因:A、B 對 O 為顯性,A 與 B 之間共顯性。所以血型 A 可能是 <code>AA</code> 或 <code>AO</code>、血型 B 可能是 <code>BB</code> 或 <code>BO</code>。</li>
        <li>最有趣的例子:<strong>A 型 × B 型</strong>的父母,孩子<strong>四種血型都有可能</strong>(A、B、AB、O)。</li>
        <li><strong>Rh 血型</strong>以 D 對 d 顯性:Rh+ 可能是 <code>DD</code> 或 <code>Dd</code>,Rh− 為 <code>dd</code>。兩位 Rh− 的父母,孩子一定是 Rh−。</li>
        <li>本工具依標準遺傳法則計算,<strong>不含</strong>極罕見的 cis-AB、孟買型(Bombay phenotype)等特例。血型不符不必然代表非親生,請以正規親子鑑定(DNA)為準,切勿據此判斷家庭關係。</li>
        <li>全程在你的瀏覽器計算,<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
