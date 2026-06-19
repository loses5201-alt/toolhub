<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parseSnowflake, PLATFORMS, platformMap, type SnowflakeResult } from '@/features/snowflake'

/*
  Snowflake ID 解析器 —— 貼上 Discord / Twitter(X)等服務的 ID,
  反推出內嵌的建立時間,以及 worker / 序號等欄位。可自訂 epoch。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

const platformId = ref('discord')
const idInput = ref('175928847299117063')
const customEpoch = ref(0)

const platform = computed(() => platformMap[platformId.value])
const epoch = computed(() =>
  platformId.value === 'custom' ? customEpoch.value : platform.value?.epoch ?? 0,
)
const labels = computed(() =>
  platformId.value === 'custom'
    ? { f1: '欄位 1 (5 位元)', f2: '欄位 2 (5 位元)', f3: '序號 (12 位元)' }
    : { f1: platform.value.field1, f2: platform.value.field2, f3: platform.value.field3 },
)

const result = computed<SnowflakeResult | null>(() => parseSnowflake(idInput.value, epoch.value))

const localTime = computed(() => {
  if (!result.value) return ''
  try {
    return new Date(result.value.timestampMs).toLocaleString('zh-TW', { hour12: false })
  } catch {
    return ''
  }
})

// 相對時間(多久以前)
const relative = computed(() => {
  if (!result.value) return ''
  const diff = Date.now() - result.value.timestampMs
  const abs = Math.abs(diff)
  const units: [number, string][] = [
    [31536000000, '年'],
    [2592000000, '個月'],
    [86400000, '天'],
    [3600000, '小時'],
    [60000, '分鐘'],
    [1000, '秒'],
  ]
  for (const [ms, name] of units) {
    if (abs >= ms) {
      const n = Math.floor(abs / ms)
      return diff >= 0 ? `${n} ${name}前` : `${n} ${name}後`
    }
  }
  return '剛剛'
})

// 二進位分欄(42 / 5 / 5 / 12)
const bitParts = computed(() => {
  if (!result.value) return null
  const b = result.value.binary
  return {
    ts: b.slice(0, 42),
    f1: b.slice(42, 47),
    f2: b.slice(47, 52),
    seq: b.slice(52, 64),
  }
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
    <div class="card p-5 space-y-4">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="p in PLATFORMS"
          :key="p.id"
          type="button"
          class="rounded-lg border px-3 py-1.5 text-sm"
          :class="platformId === p.id ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600 hover:bg-ink-50'"
          @click="platformId = p.id"
        >
          {{ p.name }}
        </button>
        <button
          type="button"
          class="rounded-lg border px-3 py-1.5 text-sm"
          :class="platformId === 'custom' ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600 hover:bg-ink-50'"
          @click="platformId = 'custom'"
        >
          自訂 epoch
        </button>
      </div>

      <label v-if="platformId === 'custom'" class="block text-sm">
        <span class="text-ink-500">自訂 epoch(毫秒,Unix 時間)</span>
        <input v-model.number="customEpoch" type="number" class="sf-input font-mono" />
      </label>
      <p v-else class="text-xs text-ink-400">
        {{ platform.name }} epoch:{{ epoch }}({{ new Date(epoch).toISOString() }})
      </p>

      <label class="block text-sm">
        <span class="text-ink-500">Snowflake ID</span>
        <input
          v-model="idInput"
          type="text"
          inputmode="numeric"
          placeholder="例如 175928847299117063"
          class="sf-input font-mono"
        />
      </label>
    </div>

    <template v-if="result">
      <div class="card p-5 space-y-3">
        <div class="flex items-center gap-3">
          <span class="text-sm font-semibold text-ink-700">建立時間</span>
          <button
            type="button"
            class="ml-auto rounded-lg border border-ink-200 px-3 py-1 text-xs text-ink-600 hover:bg-ink-50 hover:border-brand-300"
            @click="copy(result.iso, 'iso')"
          >
            {{ copied === 'iso' ? '已複製' : '複製 ISO' }}
          </button>
        </div>
        <div class="text-2xl font-semibold text-ink-800">{{ localTime }}</div>
        <div class="grid gap-1 text-sm text-ink-600">
          <div>UTC:<code class="font-mono">{{ result.iso }}</code></div>
          <div>Unix 毫秒:<code class="font-mono">{{ result.timestampMs }}</code></div>
          <div>距今:{{ relative }}</div>
        </div>
      </div>

      <div class="card p-5 grid gap-3 sm:grid-cols-3 text-sm">
        <div>
          <span class="text-ink-500">{{ labels.f1 }}</span>
          <div class="font-mono text-lg text-ink-800">{{ result.field1 }}</div>
        </div>
        <div>
          <span class="text-ink-500">{{ labels.f2 }}</span>
          <div class="font-mono text-lg text-ink-800">{{ result.field2 }}</div>
        </div>
        <div>
          <span class="text-ink-500">{{ labels.f3 }}</span>
          <div class="font-mono text-lg text-ink-800">{{ result.sequence }}</div>
        </div>
      </div>

      <div v-if="bitParts" class="card p-5 space-y-2 overflow-x-auto">
        <span class="text-sm font-semibold text-ink-700">64 位元拆解</span>
        <div class="flex flex-wrap gap-0.5 font-mono text-xs">
          <span class="rounded bg-emerald-100 px-1 py-1 text-emerald-700" title="時間戳 42 位元">{{ bitParts.ts }}</span>
          <span class="rounded bg-rose-100 px-1 py-1 text-rose-700" :title="labels.f1">{{ bitParts.f1 }}</span>
          <span class="rounded bg-amber-100 px-1 py-1 text-amber-700" :title="labels.f2">{{ bitParts.f2 }}</span>
          <span class="rounded bg-sky-100 px-1 py-1 text-sky-700" :title="labels.f3">{{ bitParts.seq }}</span>
        </div>
        <div class="flex flex-wrap gap-3 text-xs text-ink-500">
          <span><span class="inline-block h-3 w-3 rounded bg-emerald-200 align-middle"></span> 時間戳 42</span>
          <span><span class="inline-block h-3 w-3 rounded bg-rose-200 align-middle"></span> {{ labels.f1 }} 5</span>
          <span><span class="inline-block h-3 w-3 rounded bg-amber-200 align-middle"></span> {{ labels.f2 }} 5</span>
          <span><span class="inline-block h-3 w-3 rounded bg-sky-200 align-middle"></span> {{ labels.f3 }} 12</span>
        </div>
      </div>
    </template>
    <p v-else class="card p-5 text-sm text-ink-500">請輸入有效的 Snowflake ID(純數字、64 位元內)。</p>

    <LegalNote>
      Snowflake 是 Twitter 發明、Discord 等沿用的分散式 ID 設計:把產生時間直接編進 64 位元 ID 裡。
      時間戳 = (ID 右移 22 位) + 該平台的 epoch。本工具純做位元運算,不查詢任何帳號或內容,
      也無法得知 ID 對應的使用者/訊息。全程在你的瀏覽器計算,不連網、不上傳。
    </LegalNote>
  </div>
</template>

<style scoped>
.sf-input {
  width: 100%;
  margin-top: 0.25rem;
  border: 1px solid var(--color-ink-200, #e2e8f0);
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
  font-size: 0.95rem;
}
</style>
