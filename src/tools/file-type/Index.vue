<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import { checkFile, type CheckResult } from '@/features/fileType'

/*
  檔案真實類型檢測 —— 讀檔頭「魔術位元組」判斷檔案實際是什麼格式,並和副檔名比對。
  詐騙常把惡意程式改名成 .jpg / .pdf 騙人點開;副檔名能亂改,檔頭騙不了人。
  全程在你的瀏覽器讀前幾十個位元組判斷,不上傳檔案。
*/
interface Row {
  name: string
  size: number
  result: CheckResult
  headHex: string
}
const rows = ref<Row[]>([])
const dragging = ref(false)

async function handleFiles(files: FileList | File[]) {
  const list = Array.from(files)
  for (const file of list) {
    const buf = new Uint8Array(await file.slice(0, 32).arrayBuffer())
    const result = checkFile(buf, file.name)
    const headHex = Array.from(buf.slice(0, 12))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ')
    rows.value.push({ name: file.name, size: file.size, result, headHex })
  }
}

function onDrop(e: DragEvent) {
  dragging.value = false
  if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files)
}
function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) handleFiles(input.files)
  input.value = ''
}
function clearAll() {
  rows.value = []
}

const VERDICT_STYLE: Record<string, { box: string; icon: string }> = {
  ok: { box: 'border-emerald-200 bg-emerald-50/60 text-emerald-800', icon: '✅' },
  mismatch: { box: 'border-amber-200 bg-amber-50/60 text-amber-800', icon: '⚠️' },
  danger: { box: 'border-red-300 bg-red-50/70 text-red-800', icon: '🚫' },
  unknown: { box: 'border-ink-100 bg-stone-50 text-ink-600', icon: '❔' },
}

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div
        class="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition"
        :class="dragging ? 'border-brand-400 bg-brand-50/60' : 'border-line bg-stone-50/40'"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="onDrop"
      >
        <div class="text-4xl">🔬</div>
        <p class="mt-2 font-medium text-ink-700">把檔案拖進來,或</p>
        <label class="mt-2 cursor-pointer rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          選擇檔案
          <input type="file" multiple class="hidden" @change="onPick" />
        </label>
        <p class="mt-3 text-xs text-ink-400">只讀取檔案開頭判斷類型,<strong>不會上傳</strong>。可一次多選。</p>
      </div>

      <div v-if="rows.length" class="flex items-center justify-between">
        <span class="text-sm text-ink-500">已檢查 {{ rows.length }} 個檔案</span>
        <button class="text-sm text-brand-700 underline hover:text-brand-800" @click="clearAll">清除</button>
      </div>

      <div v-for="(row, i) in rows" :key="i" class="rounded-2xl border p-4" :class="VERDICT_STYLE[row.result.verdict].box">
        <div class="flex items-start gap-3">
          <span class="text-xl">{{ VERDICT_STYLE[row.result.verdict].icon }}</span>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-baseline gap-x-2">
              <span class="font-semibold break-all">{{ row.name }}</span>
              <span class="text-xs opacity-70">{{ fmtSize(row.size) }}</span>
            </div>
            <p class="mt-1 text-sm">{{ row.result.message }}</p>
            <p class="mt-1 font-mono text-xs opacity-60">檔頭:{{ row.headHex }}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="text-sm text-ink-500">
      確認檔案沒被掉包?也可用
      <RouterLink to="/tools/file-checksum" class="font-semibold text-brand-700 underline hover:text-brand-800">
        檔案校驗碼工具
      </RouterLink>
      比對官方 SHA-256。
    </div>

    <LegalNote title="這個檢測能、不能做什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>能</strong>:看出「副檔名造假」—— 例如名字叫 <code>照片.jpg</code> 但其實是 Windows 執行檔(詐騙常見手法),會標成🚫高度可疑。</li>
        <li><strong>能</strong>:辨識常見格式(圖片、PDF、Office、壓縮檔、影音、執行檔)的真實類型。</li>
        <li><strong>不能</strong>:這不是防毒掃描 —— 「類型相符」不代表檔案安全;可疑來源的檔案仍請勿開啟。</li>
        <li>Office 新檔(docx/xlsx)與 APK 等本來就是用 ZIP 封裝,偵測成「ZIP」屬正常。</li>
        <li>本工具<strong>只在你的瀏覽器讀取檔案開頭位元組,不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
