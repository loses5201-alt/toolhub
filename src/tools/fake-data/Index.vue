<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  FIELDS,
  generate,
  rowsToCsv,
  seedFromString,
  type FakeRow,
} from '@/features/fakeData'

/*
  測試假資料產生器 —— 產生「擬真但完全虛構」的台灣個資樣本,給開發/測試/教學/示範填表單用。
  身分證字號與統一編號都帶正確檢查碼(能通過一般系統格式驗證),但不對應任何真實個人或公司。
  全程在你瀏覽器產生、不上傳、不連網。
*/

const fields = FIELDS
// 預設勾選常用欄位
const selected = reactive<Record<string, boolean>>(
  Object.fromEntries(fields.map((f) => [f.key, ['name', 'gender', 'twId', 'mobile', 'email'].includes(f.key)])),
)
const count = ref(20)
const seedText = ref('')

const chosenKeys = computed(() => fields.filter((f) => selected[f.key]).map((f) => f.key))

const rows = ref<FakeRow[]>([])
const usedKeys = ref<string[]>([])
const usedSeed = ref<number | null>(null)

function run() {
  const keys = chosenKeys.value
  if (keys.length === 0) {
    rows.value = []
    usedKeys.value = []
    return
  }
  const n = Math.max(1, Math.min(Math.floor(count.value) || 1, 5000))
  count.value = n
  const seed = seedText.value.trim()
    ? seedFromString(seedText.value.trim())
    : (Math.random() * 0xffffffff) >>> 0
  usedSeed.value = seed
  usedKeys.value = keys
  rows.value = generate({ count: n, seed, fields: keys })
}

const labelOf = (k: string) => fields.find((f) => f.key === k)?.label ?? k
const previewRows = computed(() => rows.value.slice(0, 50))

const copied = ref(false)
function copyCsv() {
  if (!rows.value.length) return
  navigator.clipboard?.writeText(rowsToCsv(rows.value, usedKeys.value))
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

function download(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function downloadCsv() {
  if (!rows.value.length) return
  // 加 BOM 讓 Excel 正確辨識 UTF-8 中文
  download('﻿' + rowsToCsv(rows.value, usedKeys.value), 'fake-data.csv', 'text/csv;charset=utf-8')
}

function downloadJson() {
  if (!rows.value.length) return
  const arr = rows.value.map((r) => {
    const o: Record<string, string> = {}
    for (const k of usedKeys.value) o[labelOf(k)] = r[k]
    return o
  })
  download(JSON.stringify(arr, null, 2), 'fake-data.json', 'application/json')
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-5">
      <!-- 欄位勾選 -->
      <div>
        <label class="field-label">要產生哪些欄位?</label>
        <div class="mt-2 flex flex-wrap gap-2">
          <label
            v-for="f in fields"
            :key="f.key"
            class="inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-1.5 text-sm transition"
            :class="selected[f.key] ? 'border-brand-500 bg-brand-50 text-brand-800 font-semibold' : 'border-line bg-ink-50 text-ink-600 hover:bg-ink-100'"
          >
            <input v-model="selected[f.key]" type="checkbox" class="accent-brand-600" />
            {{ f.label }}
          </label>
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label" for="fd-count">產生筆數(1–5000)</label>
          <input id="fd-count" v-model.number="count" type="number" min="1" max="5000" class="field-input" />
        </div>
        <div>
          <label class="field-label" for="fd-seed">種子(選填)</label>
          <input id="fd-seed" v-model="seedText" type="text" placeholder="留空=每次隨機;填字可重現同一批" class="field-input" />
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <button class="rounded-xl bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700" @click="run">
          產生假資料
        </button>
        <span v-if="chosenKeys.length === 0" class="text-sm text-amber-700">⚠️ 請至少勾選一個欄位</span>
      </div>
    </div>

    <!-- 結果 -->
    <div v-if="rows.length" class="card p-6 space-y-4">
      <div class="flex flex-wrap items-center gap-3">
        <button class="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700" @click="downloadCsv">
          下載 CSV
        </button>
        <button class="rounded-xl bg-ink-100 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-200" @click="downloadJson">
          下載 JSON
        </button>
        <button class="text-sm text-brand-700 underline hover:text-brand-800" @click="copyCsv">
          {{ copied ? '已複製 ✓' : '複製 CSV' }}
        </button>
        <span class="text-sm text-ink-400">
          共 {{ rows.length }} 筆<template v-if="rows.length > 50">,以下預覽前 50 筆</template>
          <template v-if="usedSeed !== null"> ‧ 種子 {{ usedSeed }}</template>
        </span>
      </div>

      <div class="overflow-x-auto rounded-xl border border-line">
        <table class="w-full text-left text-sm">
          <thead class="bg-ink-50 text-ink-600">
            <tr>
              <th class="px-3 py-2 font-semibold text-ink-400">#</th>
              <th v-for="k in usedKeys" :key="k" class="px-3 py-2 font-semibold whitespace-nowrap">{{ labelOf(k) }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in previewRows" :key="i" class="border-t border-line">
              <td class="px-3 py-2 text-ink-400">{{ i + 1 }}</td>
              <td v-for="k in usedKeys" :key="k" class="px-3 py-2 whitespace-nowrap">{{ r[k] }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>開發、測試、教學、做簡報或截圖示範時,需要一堆<strong>長得像真的、卻完全虛構</strong>的台灣資料來填表單、塞資料庫 —— 用這個產生,<strong>不必、也不該</strong>拿真客戶的個資去測試系統。</li>
        <li><strong>身分證字號、統一編號都帶正確檢查碼</strong>,能通過一般系統的格式/檢查碼驗證;但它們是隨機湊出來的,<strong>不對應任何真實的人或公司</strong>(檢查碼正確 ≠ 真實存在)。</li>
        <li>填「種子」可以<strong>重現同一批資料</strong>(同種子=同結果),方便團隊對齊測試資料或回歸測試;留空則每次隨機。</li>
        <li>全程<strong>在你瀏覽器產生,不連網、不上傳</strong>。CSV 已加 BOM,用 Excel 開不會中文亂碼。</li>
        <li>請勿將產生的資料用於詐騙、偽造文書或任何冒用身分的用途。</li>
      </ul>
    </LegalNote>
  </div>
</template>
