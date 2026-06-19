<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { inspectUuid } from '@/features/uuidInspect'

/*
  UUID 檢視器 —— 貼上 UUID,判斷版本與變體,並對 v1 / v6 / v7 還原內嵌的建立時間。
  與 id-gen(產生 ID)互補。全程在你的瀏覽器計算,不連網、不上傳。
*/

const input = ref('018bcfe5-6800-7cc3-98c4-dc0c0c07398f')
const info = computed(() => inspectUuid(input.value))

const localTime = computed(() => {
  if (!info.value?.timestampMs && info.value?.timestampMs !== 0) return ''
  try {
    return new Date(info.value.timestampMs as number).toLocaleString('zh-TW', { hour12: false })
  } catch {
    return ''
  }
})

const EXAMPLES = [
  { label: 'v4 隨機', v: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
  { label: 'v1 時間', v: '13814000-1dd2-11b2-a567-0e02b2c3d479' },
  { label: 'v7 Unix 毫秒', v: '018bcfe5-6800-7cc3-98c4-dc0c0c07398f' },
  { label: 'Nil', v: '00000000-0000-0000-0000-000000000000' },
]
</script>

<template>
  <div class="space-y-6">
    <div class="card p-5 space-y-3">
      <label class="block text-sm">
        <span class="text-ink-500">輸入 UUID(接受連字號 / 無連字號 / urn:uuid: / 大括號)</span>
        <input v-model="input" type="text" class="uu-input font-mono" placeholder="f47ac10b-58cc-4372-a567-0e02b2c3d479" />
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

    <template v-if="info">
      <div class="card p-5 grid gap-3 sm:grid-cols-2 text-sm">
        <div>
          <span class="text-ink-500">標準格式</span>
          <div class="font-mono text-ink-800 break-all">{{ info.canonical }}</div>
        </div>
        <div>
          <span class="text-ink-500">版本</span>
          <div class="text-ink-800">{{ info.versionLabel }}</div>
        </div>
        <div>
          <span class="text-ink-500">變體</span>
          <div class="text-ink-800">{{ info.variant }}</div>
        </div>
        <div v-if="info.special">
          <span class="text-ink-500">特殊</span>
          <div class="text-ink-800">{{ info.special === 'nil' ? '全零(空值)' : '全 F(最大值)' }}</div>
        </div>
      </div>

      <div v-if="info.iso" class="card p-5 space-y-2">
        <span class="text-sm font-semibold text-ink-700">內嵌建立時間</span>
        <div class="text-2xl font-semibold text-ink-800">{{ localTime }}</div>
        <div class="grid gap-1 text-sm text-ink-600">
          <div>UTC:<code class="font-mono">{{ info.iso }}</code></div>
          <div>Unix 毫秒:<code class="font-mono">{{ info.timestampMs }}</code></div>
        </div>
      </div>
      <p v-else class="card p-5 text-sm text-ink-500">
        此版本不含時間資訊(只有 v1 / v6 / v7 內嵌可還原的時間)。
      </p>
    </template>
    <p v-else class="card p-5 text-sm text-ink-500">請輸入有效的 UUID(32 個十六進位字元)。</p>

    <LegalNote>
      UUID 的版本由第 13 個十六進位字元決定,變體由第 17 個字元的高位元決定。
      <strong>v1 / v6</strong> 內嵌 60 位元時間戳(單位 100 奈秒,自 1582-10-15 起算);
      <strong>v7</strong>(RFC 9562 新標準)前 48 位元直接是 Unix 毫秒,可排序。
      v3 / v4 / v5 不含時間。本工具純做位元解析,不查詢任何資料。全程在你的瀏覽器計算,不連網、不上傳。
    </LegalNote>
  </div>
</template>

<style scoped>
.uu-input {
  width: 100%;
  margin-top: 0.25rem;
  border: 1px solid var(--color-ink-200, #e2e8f0);
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
  font-size: 0.95rem;
}
</style>
