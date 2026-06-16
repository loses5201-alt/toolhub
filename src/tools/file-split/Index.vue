<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  planChunks,
  partName,
  baseNameOf,
  orderParts,
  fmtSize,
  type ChunkPlan,
} from '@/features/fileSplit'

/*
  檔案分割 / 合併 —— 大檔寄不出去(email/LINE/雲端有大小限制)時,先切成小份分批傳,
  收到後再合併還原。全程在你瀏覽器以 Blob.slice / new Blob 處理,不上傳。
  命名用 .001 .002…,與 7-Zip/HJSplit 一致,對方也能用 cat / copy 指令合併,不一定要本工具。
*/
type Mode = 'split' | 'join'
const mode = ref<Mode>('split')

// ── 分割 ──
const srcFile = ref<File | null>(null)
const unit = ref<1 | 1048576>(1048576) // 自訂大小單位:MB(預設)或 B
const sizeInput = ref(20) // 每份大小(以 unit 計)
const presetMB = [10, 20, 25, 100] // 常見上限:Gmail 25MB、LINE 檔案、燒光碟等
const parts = ref<{ name: string; url: string; size: number }[]>([])
const splitError = ref('')

const partSize = computed(() => Math.floor(sizeInput.value * unit.value))
const plan = computed<ChunkPlan[]>(() => {
  splitError.value = ''
  if (!srcFile.value || partSize.value <= 0) return []
  try {
    return planChunks(srcFile.value.size, partSize.value)
  } catch (e) {
    splitError.value = (e as Error).message
    return []
  }
})

function onSrc(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  clearParts()
  srcFile.value = f ?? null
  ;(e.target as HTMLInputElement).value = ''
}

function clearParts() {
  for (const p of parts.value) URL.revokeObjectURL(p.url)
  parts.value = []
}

function doSplit() {
  if (!srcFile.value || !plan.value.length) return
  clearParts()
  const file = srcFile.value
  const total = plan.value.length
  parts.value = plan.value.map((c) => {
    const blob = file.slice(c.start, c.end)
    return { name: partName(file.name, c.index, total), url: URL.createObjectURL(blob), size: c.size }
  })
}

function downloadAll() {
  // 逐一觸發下載;部分瀏覽器會詢問是否允許多檔下載
  parts.value.forEach((p, i) => {
    setTimeout(() => {
      const a = document.createElement('a')
      a.href = p.url
      a.download = p.name
      a.click()
    }, i * 250)
  })
}

const rejoinName = computed(() => srcFile.value?.name ?? 'output')
const cmdWin = computed(() => `copy /b "${rejoinName.value}.*" "${rejoinName.value}"`)
const cmdNix = computed(() => `cat "${rejoinName.value}".* > "${rejoinName.value}"`)

// ── 合併 ──
const joinFiles = ref<File[]>([])
const joinResult = ref<{ url: string; name: string; size: number } | null>(null)

const ordered = computed(() => orderParts(joinFiles.value, (f) => f.name))
const joinName = computed(() => {
  const first = ordered.value.ordered[0]
  return first ? baseNameOf(first.name) : 'merged.bin'
})

function onJoinFiles(e: Event) {
  const list = (e.target as HTMLInputElement).files
  clearJoin()
  joinFiles.value = list ? Array.from(list) : []
  ;(e.target as HTMLInputElement).value = ''
}

function clearJoin() {
  if (joinResult.value) URL.revokeObjectURL(joinResult.value.url)
  joinResult.value = null
}

function doJoin() {
  if (!ordered.value.ordered.length) return
  clearJoin()
  const blob = new Blob(ordered.value.ordered) // 依序串接,不需全部讀進記憶體
  joinResult.value = { url: URL.createObjectURL(blob), name: joinName.value, size: blob.size }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex overflow-hidden rounded-xl border border-line w-full sm:w-auto">
      <button class="flex-1 px-4 py-2 text-sm font-medium" :class="mode === 'split' ? 'bg-brand-600 text-white' : 'bg-white text-ink-600'" @click="mode = 'split'">切割大檔</button>
      <button class="flex-1 px-4 py-2 text-sm font-medium" :class="mode === 'join' ? 'bg-brand-600 text-white' : 'bg-white text-ink-600'" @click="mode = 'join'">合併分割檔</button>
    </div>

    <!-- ── 分割 ── -->
    <div v-if="mode === 'split'" class="card p-4 sm:p-6 space-y-5">
      <div>
        <label class="field-label">選擇要切割的檔案</label>
        <input type="file" class="field-input" @change="onSrc" />
        <p class="field-hint">任何檔案皆可(影片、備份、PDF…)。檔案只在你的瀏覽器切割,不會上傳。</p>
      </div>

      <template v-if="srcFile">
        <p class="text-sm text-ink-600">原始檔:<strong class="text-ink-800">{{ srcFile.name }}</strong>(共 {{ fmtSize(srcFile.size) }})</p>

        <div class="space-y-2">
          <label class="field-label">每份大小</label>
          <div class="flex flex-wrap items-center gap-2">
            <button
              v-for="m in presetMB" :key="m"
              class="rounded-lg border px-3 py-1.5 text-sm"
              :class="unit === 1048576 && sizeInput === m ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-600'"
              @click="unit = 1048576; sizeInput = m"
            >{{ m }} MB</button>
            <span class="text-ink-300">|</span>
            <input v-model.number="sizeInput" type="number" min="1" class="w-24 rounded-lg border border-line px-2 py-1.5" />
            <select v-model.number="unit" class="rounded-lg border border-line bg-white px-2 py-1.5">
              <option :value="1048576">MB</option>
              <option :value="1">Bytes</option>
            </select>
          </div>
          <p class="field-hint">Gmail 附件約 25MB、LINE 也有上限,切小一點較保險。</p>
        </div>

        <p v-if="splitError" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ splitError }}</p>
        <p v-else-if="plan.length" class="text-sm text-ink-600">將切成 <strong class="text-ink-800">{{ plan.length }}</strong> 份。</p>

        <button class="btn-primary w-full sm:w-auto" :disabled="!plan.length" @click="doSplit">產生分割檔</button>

        <div v-if="parts.length" class="rounded-xl border border-line bg-stone-50 p-4 space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-sm text-brand-700">✅ 已切成 {{ parts.length }} 份</p>
            <button class="btn-primary !py-1.5 text-sm" @click="downloadAll">逐一下載全部</button>
          </div>
          <ul class="divide-y divide-line text-sm">
            <li v-for="p in parts" :key="p.name" class="flex items-center justify-between gap-3 py-1.5">
              <span class="truncate text-ink-700">{{ p.name }}</span>
              <span class="shrink-0 text-ink-400">{{ fmtSize(p.size) }}</span>
              <a :href="p.url" :download="p.name" class="shrink-0 text-brand-700 underline">下載</a>
            </li>
          </ul>
          <div class="space-y-1 border-t border-line pt-3 text-xs text-ink-500">
            <p>對方收齊後可用本工具「合併」,或直接用指令合併(不必裝任何軟體):</p>
            <p>Windows:<code class="rounded bg-stone-200 px-1">{{ cmdWin }}</code></p>
            <p>Mac / Linux:<code class="rounded bg-stone-200 px-1">{{ cmdNix }}</code></p>
          </div>
        </div>
      </template>
    </div>

    <!-- ── 合併 ── -->
    <div v-else class="card p-4 sm:p-6 space-y-5">
      <div>
        <label class="field-label">選擇所有分割檔(.001 .002 …)</label>
        <input type="file" multiple class="field-input" @change="onJoinFiles" />
        <p class="field-hint">一次選取全部分割檔,會自動依序號排好。檔案只在你的瀏覽器合併,不會上傳。</p>
      </div>

      <template v-if="joinFiles.length">
        <ol class="list-decimal space-y-1 pl-6 text-sm text-ink-700">
          <li v-for="f in ordered.ordered" :key="f.name">{{ f.name }} <span class="text-ink-400">({{ fmtSize(f.size) }})</span></li>
        </ol>

        <p v-if="!ordered.hasIndex" class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          這些檔名沒有 .001 .002 的序號,將依你選取的順序合併;若順序不對,合併結果會損毀。
        </p>
        <p v-if="ordered.missing.length" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          ⚠️ 似乎缺少第 {{ ordered.missing.join('、') }} 份,合併後檔案會不完整。請補齊再合併。
        </p>
        <p v-if="ordered.duplicates.length" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          ⚠️ 第 {{ ordered.duplicates.join('、') }} 份重複選到了,請移除重複檔案。
        </p>

        <button class="btn-primary w-full sm:w-auto" :disabled="!ordered.ordered.length" @click="doJoin">合併並下載</button>

        <div v-if="joinResult" class="rounded-xl border border-line bg-stone-50 p-4 space-y-2">
          <p class="text-sm text-brand-700">✅ 已合併為 {{ joinResult.name }}({{ fmtSize(joinResult.size) }})</p>
          <a :href="joinResult.url" :download="joinResult.name" class="btn-primary !py-2 text-sm">下載合併後檔案</a>
        </div>
      </template>
    </div>

    <LegalNote title="為什麼用這個,而不是網路上的免費分割網站?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>不上傳</strong>:大檔(影片、備份、私密資料)全程留在你電腦,不送到陌生伺服器,也不必等漫長上傳。</li>
        <li><strong>通用格式</strong>:分割檔用標準 .001 .002 命名,對方就算沒有本工具,也能用內建的 <code>copy /b</code>(Windows)或 <code>cat</code>(Mac/Linux)指令合併。</li>
        <li>合併會驗證序號是否連續,缺份/重複會提醒,避免合出損壞的檔案。</li>
        <li>無廣告、免註冊、不限檔案大小與份數,完全免費。</li>
      </ul>
    </LegalNote>
  </div>
</template>
