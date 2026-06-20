<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parseUlid } from '@/features/ulid'

/*
  ULID 解析器 —— 貼上 ULID,還原內嵌的建立時間與亂數欄位。
  與 id-gen(產生 ID)互補。全程在你的瀏覽器計算,不連網、不上傳。
*/

const input = ref('01ARZ3NDEKTSV4RRFFQ69G5FAV')
const info = computed(() => parseUlid(input.value))

const localTime = computed(() => {
  if (!info.value.valid) return ''
  try {
    return new Date(info.value.timestampMs).toLocaleString('zh-TW', { hour12: false })
  } catch {
    return ''
  }
})

const relative = computed(() => {
  if (!info.value.valid) return ''
  const diff = info.value.timestampMs - Date.now()
  const abs = Math.abs(diff)
  const day = 86400000
  const units: [number, string][] = [
    [365 * day, '年'],
    [30 * day, '個月'],
    [day, '天'],
    [3600000, '小時'],
    [60000, '分鐘'],
  ]
  for (const [ms, label] of units) {
    if (abs >= ms) {
      const n = Math.round(abs / ms)
      return diff < 0 ? `${n} ${label}前` : `${n} ${label}後`
    }
  }
  return '剛剛'
})

const EXAMPLES = [
  { label: '規範範例', v: '01ARZ3NDEKTSV4RRFFQ69G5FAV' },
  { label: '全零(時間 0)', v: '00000000000000000000000000' },
  { label: '最大時間', v: '7ZZZZZZZZZZZZZZZZZZZZZZZZZ' },
]
</script>

<template>
  <div class="space-y-6">
    <div class="card p-5 space-y-3">
      <label class="block text-sm">
        <span class="text-ink-500">輸入 ULID(26 碼,大小寫皆可)</span>
        <input
          v-model="input"
          type="text"
          class="ul-input font-mono uppercase"
          placeholder="01ARZ3NDEKTSV4RRFFQ69G5FAV"
        />
      </label>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="ex in EXAMPLES"
          :key="ex.label"
          type="button"
          class="rounded-lg border border-ink-200 px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
          @click="input = ex.v"
        >
          {{ ex.label }}
        </button>
      </div>
    </div>

    <template v-if="info.valid">
      <div class="card p-5 space-y-2">
        <span class="text-sm font-semibold text-ink-700">內嵌建立時間</span>
        <div class="text-2xl font-semibold text-ink-800">{{ localTime }}</div>
        <div class="text-sm text-ink-500">{{ relative }}</div>
        <div class="grid gap-1 text-sm text-ink-600 pt-1">
          <div>UTC:<code class="font-mono">{{ info.iso }}</code></div>
          <div>Unix 毫秒:<code class="font-mono">{{ info.timestampMs }}</code></div>
        </div>
      </div>

      <div class="card p-5 space-y-2">
        <span class="text-sm font-semibold text-ink-700">欄位拆解(128 位元)</span>
        <div class="font-mono text-lg break-all">
          <span class="text-brand-600" title="48 位元時間戳(前 10 碼)">{{ info.normalized.slice(0, 10) }}</span><span class="text-ink-400" title="80 位元亂數(後 16 碼)">{{ info.normalized.slice(10) }}</span>
        </div>
        <div class="flex gap-4 text-xs text-ink-500">
          <span><span class="inline-block w-2 h-2 rounded-full bg-brand-500 align-middle mr-1"></span>時間戳 48 位元</span>
          <span><span class="inline-block w-2 h-2 rounded-full bg-ink-300 align-middle mr-1"></span>亂數 80 位元</span>
        </div>
      </div>
    </template>
    <div v-else class="card p-5">
      <ul class="text-sm text-rose-600 space-y-0.5">
        <li v-for="(e, i) in info.errors" :key="i">• {{ e }}</li>
      </ul>
    </div>

    <LegalNote>
      <strong>ULID</strong>(Universally Unique Lexicographically Sortable Identifier)是 26 個字元的識別碼,
      用 <strong>Crockford Base32</strong>(排除易混淆的 I L O U)編碼 128 位元 =
      <strong>前 48 位元毫秒時間戳 + 後 80 位元亂數</strong>。因為時間戳放在最前面,直接用字串排序就等於依時間排序。
      本工具反推內嵌時間並拆解欄位,純位元解析,<strong>不查詢任何資料</strong>。與 uuid-inspect、snowflake-id 互補。
      全程在你的瀏覽器計算,不連網、不上傳。
    </LegalNote>
  </div>
</template>

<style scoped>
.ul-input {
  width: 100%;
  margin-top: 0.25rem;
  border: 1px solid var(--color-ink-200, #e2e8f0);
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
  font-size: 0.95rem;
  letter-spacing: 0.03em;
}
</style>
