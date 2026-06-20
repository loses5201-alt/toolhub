<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  parseSemver,
  compareVersions,
  sortVersions,
  diffLevel,
  satisfies,
} from '@/features/semver'

/*
  語意化版本工坊 —— 解析 semver、比較先後、測試 npm 範圍(^ ~ x 連字號 ||)。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

type Mode = 'compare' | 'range' | 'sort'
const mode = ref<Mode>('range')

// 比較
const verA = ref('1.2.3')
const verB = ref('1.10.0')
const cmp = computed(() => compareVersions(verA.value, verB.value))
const cmpText = computed(() => {
  if (cmp.value === null) return null
  const a = verA.value.trim()
  const b = verB.value.trim()
  if (cmp.value < 0) return `${a} 比 ${b} 舊(<)`
  if (cmp.value > 0) return `${a} 比 ${b} 新(>)`
  return `${a} 與 ${b} 等價(=,build 中繼資料不計)`
})
const cmpDiff = computed(() => diffLevel(verA.value, verB.value))

// 範圍
const rangeVer = ref('1.4.0')
const rangeStr = ref('^1.2.3')
const rangeRes = computed(() => satisfies(rangeVer.value, rangeStr.value))

// 排序
const sortInput = ref('1.2.0\n1.0.0-rc.1\n2.0.0\n1.0.0\n0.9.9')
const sorted = computed(() => sortVersions(sortInput.value.split(/[\s,]+/).filter(Boolean)))
const parsedA = computed(() => parseSemver(verA.value))

const DIFF_LABEL: Record<string, string> = {
  major: '主版本(major)— 可能不相容',
  minor: '次版本(minor)— 新增功能、向下相容',
  patch: '修訂(patch)— 修 bug、向下相容',
  prerelease: '預先發行(prerelease)標籤不同',
}

const RANGE_EXAMPLES = ['^1.2.3', '~1.2.3', '1.2.x', '>=1.2.0 <2.0.0', '1.2.3 - 2.3.4', '1.x || 2.x']
</script>

<template>
  <div class="space-y-6">
    <div class="card p-2 flex gap-1 text-sm">
      <button
        v-for="m in (['range', 'compare', 'sort'] as Mode[])"
        :key="m"
        type="button"
        class="flex-1 rounded-lg px-3 py-2 transition"
        :class="mode === m ? 'bg-brand-500 text-white font-semibold' : 'text-ink-600 hover:bg-ink-50'"
        @click="mode = m"
      >
        {{ m === 'range' ? '範圍測試' : m === 'compare' ? '版本比較' : '版本排序' }}
      </button>
    </div>

    <!-- 範圍測試 -->
    <template v-if="mode === 'range'">
      <div class="card p-5 space-y-3">
        <label class="block text-sm">
          <span class="text-ink-500">版本</span>
          <input v-model="rangeVer" type="text" class="sv-input font-mono" placeholder="1.4.0" />
        </label>
        <label class="block text-sm">
          <span class="text-ink-500">範圍(npm / node-semver 語法)</span>
          <input v-model="rangeStr" type="text" class="sv-input font-mono" placeholder="^1.2.3" />
        </label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="ex in RANGE_EXAMPLES"
            :key="ex"
            type="button"
            class="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-mono text-ink-600 hover:bg-ink-50 hover:border-brand-300"
            @click="rangeStr = ex"
          >
            {{ ex }}
          </button>
        </div>
      </div>

      <div v-if="rangeRes.error" class="card p-5 text-sm text-rose-600">{{ rangeRes.error }}</div>
      <template v-else>
        <div
          class="card p-5 text-center"
          :class="rangeRes.satisfies ? 'bg-emerald-50' : 'bg-rose-50'"
        >
          <div class="text-3xl mb-1">{{ rangeRes.satisfies ? '✅' : '❌' }}</div>
          <div class="text-lg font-semibold" :class="rangeRes.satisfies ? 'text-emerald-700' : 'text-rose-700'">
            {{ rangeRes.satisfies ? '符合' : '不符合' }}此範圍
          </div>
          <div class="text-sm text-ink-500 mt-1 font-mono break-all">
            {{ rangeVer }} {{ rangeRes.satisfies ? '∈' : '∉' }} {{ rangeStr }}
          </div>
        </div>
        <div class="card p-5 space-y-2 text-sm">
          <span class="font-semibold text-ink-700">範圍展開(必須滿足其中任一組)</span>
          <div v-for="(set, i) in rangeRes.expanded" :key="i" class="flex flex-wrap items-center gap-1.5">
            <span v-if="rangeRes.expanded.length > 1" class="text-ink-400 text-xs">組 {{ i + 1 }}:</span>
            <code
              v-for="(c, j) in set"
              :key="j"
              class="font-mono text-xs rounded bg-ink-100 px-2 py-1 text-ink-700"
            >{{ c }}</code>
            <span v-if="set.length > 1" class="text-ink-400 text-xs">(皆需成立)</span>
          </div>
        </div>
      </template>
    </template>

    <!-- 版本比較 -->
    <template v-if="mode === 'compare'">
      <div class="card p-5 grid gap-3 sm:grid-cols-2">
        <label class="block text-sm">
          <span class="text-ink-500">版本 A</span>
          <input v-model="verA" type="text" class="sv-input font-mono" placeholder="1.2.3" />
        </label>
        <label class="block text-sm">
          <span class="text-ink-500">版本 B</span>
          <input v-model="verB" type="text" class="sv-input font-mono" placeholder="1.10.0" />
        </label>
      </div>
      <div v-if="cmpText" class="card p-5 space-y-2">
        <div class="text-xl font-semibold text-ink-800">{{ cmpText }}</div>
        <div v-if="cmpDiff" class="text-sm text-ink-600">差異層級:{{ DIFF_LABEL[cmpDiff] }}</div>
        <div v-if="parsedA && parsedA.prerelease.length" class="text-xs text-ink-500">
          注意:含 prerelease 的版本(如 1.0.0-rc.1)優先序低於對應正式版。
        </div>
      </div>
      <p v-else class="card p-5 text-sm text-rose-600">請輸入兩個有效的 semver(major.minor.patch)。</p>
    </template>

    <!-- 版本排序 -->
    <template v-if="mode === 'sort'">
      <div class="card p-5 space-y-2">
        <label class="block text-sm">
          <span class="text-ink-500">每行(或以空白/逗號分隔)一個版本</span>
          <textarea v-model="sortInput" rows="6" class="sv-input font-mono"></textarea>
        </label>
      </div>
      <div v-if="sorted.length" class="card p-5 space-y-1">
        <span class="text-sm font-semibold text-ink-700">由舊到新</span>
        <ol class="list-decimal list-inside font-mono text-sm text-ink-800 space-y-0.5">
          <li v-for="v in sorted" :key="v">{{ v }}</li>
        </ol>
      </div>
      <p v-else class="card p-5 text-sm text-ink-500">沒有可解析的有效版本。</p>
    </template>

    <LegalNote>
      <strong>語意化版本</strong>(SemVer)格式為 <code>主版本.次版本.修訂</code>,可加 <code>-prerelease</code>
      與 <code>+build</code>。比較規則依 semver.org §11:逐段數值比較,正式版優先序高於 prerelease,
      prerelease 內數字識別碼低於文字。範圍語法依 node-semver:<code>^</code> 鎖最左非零段、<code>~</code>
      鎖到次版本、<code>x</code> 萬用、<code>A - B</code> 連字號、空白為 AND、<code>||</code> 為 OR。
      帶 prerelease 的版本預設只在同一 [主.次.修訂] 且範圍也帶 prerelease 時才算符合。
      全程在你的瀏覽器計算,不連網、不上傳。
    </LegalNote>
  </div>
</template>

<style scoped>
.sv-input {
  width: 100%;
  margin-top: 0.25rem;
  border: 1px solid var(--color-ink-200, #e2e8f0);
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
  font-size: 0.95rem;
}
</style>
