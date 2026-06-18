<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { describeCron, nextRuns } from '@/features/cron'

/*
  Cron 表達式解讀 —— 輸入 5 欄位 cron(分 時 日 月 週),用白話中文說明,並列出接下來幾次執行時間。
  全程在你的瀏覽器計算,不連網、不上傳。
*/
const expr = ref('30 9 * * 1-5')

const examples: { e: string; label: string }[] = [
  { e: '*/5 * * * *', label: '每 5 分鐘' },
  { e: '0 9 * * 1-5', label: '平日早上 9 點' },
  { e: '0 0 1 * *', label: '每月 1 號半夜' },
  { e: '0 */2 * * *', label: '每 2 小時' },
  { e: '0 8 * * 0', label: '每週日 8 點' },
  { e: '@daily', label: '每天午夜' },
]

const result = computed(() => {
  const e = expr.value.trim()
  if (!e) return { ok: false as const, error: '請輸入 cron 表達式' }
  try {
    return { ok: true as const, desc: describeCron(e), runs: nextRuns(e, new Date(), 5) }
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : '無法解析' }
  }
})

const weekCN = ['日', '一', '二', '三', '四', '五', '六']
function fmt(d: Date): string {
  const p = (n: number) => (n < 10 ? '0' + n : '' + n)
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}(週${weekCN[d.getDay()]}) ${p(d.getHours())}:${p(d.getMinutes())}`
}
function relative(d: Date): string {
  const diff = d.getTime() - Date.now()
  const min = Math.round(diff / 60000)
  if (min < 60) return `約 ${min} 分鐘後`
  const hr = Math.round(min / 60)
  if (hr < 48) return `約 ${hr} 小時後`
  return `約 ${Math.round(hr / 24)} 天後`
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">Cron 表達式</label>
        <input v-model="expr" class="field-input font-mono text-lg tracking-wide" placeholder="分 時 日 月 週" spellcheck="false" />
        <p class="field-hint">
          5 個欄位:<strong>分(0-59) 時(0-23) 日(1-31) 月(1-12) 週(0-6,0=週日)</strong>。
          支援 <code>*</code> <code>,</code> <code>-</code> <code>*/n</code> 與 <code>@daily</code> 等捷徑。全程在瀏覽器計算,不上傳。
        </p>
      </div>

      <div>
        <div class="mb-1.5 text-xs font-semibold text-ink-400">常用範例</div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="ex in examples"
            :key="ex.e"
            type="button"
            class="rounded-lg border border-ink-200 px-3 py-1.5 text-sm text-ink-600 transition hover:bg-ink-50"
            @click="expr = ex.e"
          >
            <code class="text-ink-800">{{ ex.e }}</code>
            <span class="ml-1.5 text-ink-400">{{ ex.label }}</span>
          </button>
        </div>
      </div>

      <div v-if="!result.ok" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
        ⚠️ {{ result.error }}
      </div>

      <div v-else class="rounded-xl border border-brand-200 bg-brand-50/60 p-4">
        <div class="text-xs font-semibold text-brand-700">白話說明</div>
        <p class="mt-1 text-lg text-ink-800">{{ result.desc }}</p>
      </div>
    </div>

    <div v-if="result.ok" class="card p-5">
      <div class="mb-3 flex items-center gap-2">
        <span class="text-sm font-semibold text-ink-700">接下來 5 次執行</span>
        <span class="text-xs text-ink-400">(依你裝置的本機時區)</span>
      </div>
      <ol class="space-y-2">
        <li
          v-for="(d, i) in result.runs"
          :key="i"
          class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-lg bg-ink-50 px-3 py-2"
        >
          <span class="text-xs font-semibold text-ink-400">{{ i + 1 }}</span>
          <span class="font-mono text-ink-800">{{ fmt(d) }}</span>
          <span class="text-sm text-brand-700">{{ relative(d) }}</span>
        </li>
      </ol>
      <p v-if="!result.runs.length" class="text-sm text-ink-500">在可預見的範圍內找不到符合的時間(可能是不存在的日期組合,例如 2 月 30 號)。</p>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>設定 <strong>crontab</strong>、GitHub Actions、k8s CronJob、各種排程時,確認那串符號到底是「多久跑一次」。</li>
        <li>除了白話中文說明,還直接<strong>算出接下來幾次的實際執行時間</strong>,一眼看出有沒有設錯。</li>
        <li>cron 規則小提醒:當「日」與「週」<strong>同時</strong>有限定(都不是 <code>*</code>)時,是「任一符合就執行」,不是兩者都要符合。</li>
        <li>本工具<strong>不連網、不上傳</strong>,執行時間以你裝置的本機時區計算;伺服器時區若不同,實際觸發時間請以伺服器為準。</li>
      </ul>
    </LegalNote>
  </div>
</template>
