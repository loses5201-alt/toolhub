<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { generate, type IdKind } from '@/features/idGen'

/*
  隨機 ID 產生器 —— UUID v4 / ULID / Nano ID,可一次大量產生。
  用 crypto 安全亂數,全程在本機產生,不連網、不上傳(線上產生器可能偷記你的 ID)。
*/

const kind = ref<IdKind>('uuid')
const count = ref(5)
const nanoSize = ref(21)
const upper = ref(false)
const results = ref<string[]>([])

const kinds: { id: IdKind; label: string; desc: string }[] = [
  { id: 'uuid', label: 'UUID v4', desc: '最通用的隨機識別碼,36 字元含連字號' },
  { id: 'ulid', label: 'ULID', desc: '含時間、可依產生先後排序,26 字元' },
  { id: 'nanoid', label: 'Nano ID', desc: '短小 URL-safe,長度可調,適合短連結' },
]

const currentDesc = computed(() => kinds.find((k) => k.id === kind.value)?.desc ?? '')

function run() {
  const list = generate(kind.value, count.value, { size: nanoSize.value })
  results.value = kind.value === 'uuid' && upper.value ? list.map((s) => s.toUpperCase()) : list
}
run()

const joined = computed(() => results.value.join('\n'))

async function copyAll() {
  try {
    await navigator.clipboard.writeText(joined.value)
  } catch {
    /* 忽略 */
  }
}
async function copyOne(s: string) {
  try {
    await navigator.clipboard.writeText(s)
  } catch {
    /* 忽略 */
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <!-- 類型 -->
      <div class="flex flex-wrap gap-2">
        <button
          v-for="k in kinds"
          :key="k.id"
          type="button"
          class="rounded-lg border px-3 py-1.5 text-sm transition"
          :class="
            kind === k.id
              ? 'border-brand-500 bg-brand-600 text-white'
              : 'border-ink-200 text-ink-600 hover:bg-ink-50'
          "
          @click="kind = k.id; run()"
        >
          {{ k.label }}
        </button>
      </div>
      <p class="text-sm text-ink-500">{{ currentDesc }}</p>

      <!-- 選項 -->
      <div class="flex flex-wrap items-end gap-4">
        <label class="text-sm text-ink-600">
          數量
          <input
            v-model.number="count"
            type="number"
            min="1"
            max="10000"
            class="mt-1 block w-24 rounded-lg border border-ink-200 px-2 py-1.5"
          />
        </label>
        <label v-if="kind === 'nanoid'" class="text-sm text-ink-600">
          長度
          <input
            v-model.number="nanoSize"
            type="number"
            min="1"
            max="256"
            class="mt-1 block w-24 rounded-lg border border-ink-200 px-2 py-1.5"
          />
        </label>
        <label v-if="kind === 'uuid'" class="flex items-center gap-2 text-sm text-ink-600">
          <input v-model="upper" type="checkbox" class="h-4 w-4" />
          大寫
        </label>
        <button
          type="button"
          class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
          @click="run"
        >
          重新產生
        </button>
      </div>

      <div>
        <div class="mb-1 flex items-center justify-between">
          <label class="field-label !mb-0">結果（{{ results.length }} 個）</label>
          <button
            type="button"
            class="rounded-lg border border-ink-200 px-2.5 py-1 text-xs text-ink-600 transition hover:bg-ink-50"
            @click="copyAll"
          >
            全部複製
          </button>
        </div>
        <div class="max-h-80 space-y-1 overflow-auto rounded-lg bg-ink-50 p-2">
          <button
            v-for="(r, i) in results"
            :key="i"
            type="button"
            class="block w-full break-all rounded px-2 py-1 text-left font-mono text-sm text-ink-800 transition hover:bg-ink-100"
            title="點一下複製"
            @click="copyOne(r)"
          >
            {{ r }}
          </button>
        </div>
        <p class="mt-1 text-xs text-ink-400">點任一筆可複製;用安全亂數產生,絕不連網。</p>
      </div>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>UUID v4</strong>:資料庫主鍵、訂單編號、檔名最常用的隨機識別碼。</li>
        <li><strong>ULID</strong>:前段內含產生時間,字典序就等於時間序,適合需要排序的場景。</li>
        <li><strong>Nano ID</strong>:更短、URL-safe,適合短連結、邀請碼;長度可自訂。</li>
        <li>全部用 <code>crypto</code> <strong>密碼學等級亂數</strong>產生,Nano ID 以拒絕取樣避免分布偏差。</li>
        <li>本工具<strong>不連網、不上傳、不記錄</strong>,全部在你的裝置上產生。</li>
      </ul>
    </LegalNote>
  </div>
</template>
