<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'

/*
  檔案校驗碼 / 完整性驗證 —— 用瀏覽器內建的 Web Crypto(crypto.subtle.digest)
  算出檔案的 SHA-256 / SHA-1 / SHA-512 雜湊值,全程在你電腦計算,檔案不上傳。
  用途:下載安裝檔後比對官方公布的校驗碼,確認檔案在下載過程沒被掉包/植入惡意程式。
  線上校驗網站多半要你「上傳整個檔案」,機密檔案這樣做有外洩風險;本工具完全在本機跑。
*/
type Algo = 'SHA-256' | 'SHA-1' | 'SHA-512'
const algo = ref<Algo>('SHA-256')
const expected = ref('') // 使用者貼上的官方校驗碼(可空)

interface Item {
  id: number
  name: string
  size: number
  hash: string // 算好的 hex
  status: 'pending' | 'hashing' | 'done' | 'error'
  error?: string
}
let seq = 0
const items = reactive<Item[]>([])
const copiedId = ref<number | null>(null)

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0')
  }
  return out
}

async function hashFile(file: File, a: Algo): Promise<string> {
  const buf = await file.arrayBuffer()
  const digest = await crypto.subtle.digest(a, buf)
  return toHex(digest)
}

async function addFiles(files: FileList | File[]) {
  for (const file of Array.from(files)) {
    const item: Item = {
      id: ++seq,
      name: file.name,
      size: file.size,
      hash: '',
      status: 'hashing',
    }
    items.push(item)
    try {
      item.hash = await hashFile(file, algo.value)
      item.status = 'done'
    } catch (e) {
      item.status = 'error'
      item.error = e instanceof Error ? e.message : '計算失敗(檔案可能過大,記憶體不足)'
    }
  }
}

function onFiles(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) addFiles(input.files)
  input.value = '' // 允許重新選同一檔
}

const dragOver = ref(false)
function onDrop(e: DragEvent) {
  dragOver.value = false
  if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files)
}

// 換演算法時,重算已加入的檔案需要使用者重新選檔(File 物件已釋放),
// 故僅清空結果提示重新加入。
function clearAll() {
  items.splice(0, items.length)
}

async function copy(text: string, id: number) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try { document.execCommand('copy') } catch { /* 忽略 */ }
    document.body.removeChild(ta)
  }
  copiedId.value = id
  setTimeout(() => { if (copiedId.value === id) copiedId.value = null }, 1500)
}

// 正規化校驗碼:去空白、轉小寫(hex 比對不分大小寫)
function normalize(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase()
}
const expectedNorm = computed(() => normalize(expected.value))

// 針對某個結果,判斷與使用者貼上的校驗碼是否相符
function matchState(item: Item): 'none' | 'match' | 'mismatch' {
  if (!expectedNorm.value || item.status !== 'done') return 'none'
  return normalize(item.hash) === expectedNorm.value ? 'match' : 'mismatch'
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-5">
      <div>
        <label class="field-label">選擇要驗證的檔案(可多選)</label>
        <div
          class="rounded-2xl border-2 border-dashed p-6 text-center transition"
          :class="dragOver ? 'border-brand-400 bg-brand-50/60' : 'border-line'"
          @dragover.prevent="dragOver = true"
          @dragleave.prevent="dragOver = false"
          @drop.prevent="onDrop"
        >
          <p class="mb-3 text-sm text-ink-500">把檔案拖到這裡,或</p>
          <input id="fc-file" type="file" multiple class="hidden" @change="onFiles" />
          <label for="fc-file" class="btn-primary inline-block cursor-pointer">選擇檔案</label>
        </div>
        <p class="field-hint">檔案只在你的瀏覽器計算雜湊,不會上傳到任何伺服器。</p>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label">雜湊演算法</label>
          <select v-model="algo" class="field-input">
            <option value="SHA-256">SHA-256(最常用,建議)</option>
            <option value="SHA-1">SHA-1(舊版軟體常見)</option>
            <option value="SHA-512">SHA-512</option>
          </select>
          <p class="field-hint">換演算法後,請重新加入檔案再計算。</p>
        </div>
        <div>
          <label class="field-label">官方校驗碼(選填,貼上自動比對)</label>
          <input
            v-model="expected"
            type="text"
            placeholder="貼上官方公布的校驗碼,自動標示是否相符"
            class="field-input font-mono"
          />
        </div>
      </div>

      <div v-if="items.length" class="flex justify-end">
        <button class="text-sm text-ink-400 hover:text-red-500" @click="clearAll">清空結果</button>
      </div>
    </div>

    <div v-if="items.length" class="space-y-3">
      <div
        v-for="it in items"
        :key="it.id"
        class="card p-4 space-y-2"
        :class="{
          'ring-2 ring-emerald-400': matchState(it) === 'match',
          'ring-2 ring-red-400': matchState(it) === 'mismatch',
        }"
      >
        <div class="flex items-center gap-3">
          <div class="min-w-0 flex-1">
            <div class="truncate font-medium text-ink-900">{{ it.name }}</div>
            <div class="text-sm text-ink-500">{{ fmtSize(it.size) }} · {{ algo }}</div>
          </div>
          <span v-if="matchState(it) === 'match'" class="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">✓ 相符</span>
          <span v-else-if="matchState(it) === 'mismatch'" class="shrink-0 rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-600">✗ 不相符</span>
        </div>

        <div v-if="it.status === 'hashing'" class="text-sm text-ink-500">計算中…(大檔需要一點時間)</div>
        <div v-else-if="it.status === 'error'" class="text-sm text-red-600">{{ it.error }}</div>
        <div v-else-if="it.status === 'done'" class="flex items-center gap-2">
          <code class="min-w-0 flex-1 break-all rounded-lg border border-line bg-paper px-2 py-1.5 font-mono text-xs text-ink-900 sm:text-sm">{{ it.hash }}</code>
          <button
            class="shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm text-ink-700 transition hover:border-brand-300 hover:text-brand-700"
            @click="copy(it.hash, it.id)"
          >
            {{ copiedId === it.id ? '已複製 ✓' : '複製' }}
          </button>
        </div>

        <p v-if="matchState(it) === 'mismatch'" class="text-sm text-red-600">
          ⚠️ 校驗碼不相符!檔案可能在下載過程被竄改或下載不完整,<strong>請勿安裝</strong>,改從官方頁面重新下載。
        </p>
      </div>
    </div>

    <LegalNote title="校驗碼是什麼?怎麼用來防詐騙?">
      <ul class="list-disc pl-5 space-y-1">
        <li>校驗碼(雜湊值)是檔案的「指紋」:檔案只要被改動一個位元,算出來的值就完全不同。</li>
        <li>用途:下載安裝檔後,把這裡算出的值和<strong>官方網站公布的校驗碼</strong>比對。<strong>一致</strong>代表檔案完整、沒被掉包;<strong>不一致</strong>代表檔案被竄改或下載不全,千萬別安裝。</li>
        <li>本站「<router-link to="/downloads" class="text-brand-700 underline">防詐騙下載中心</router-link>」部分軟體有附 SHA-256,可直接貼來比對。</li>
        <li>全程使用瀏覽器內建的 Web Crypto 在你電腦計算,<strong>檔案不上傳</strong>,機密檔案也能安心驗證。</li>
        <li>提醒:超大型檔案(數 GB)需讀進記憶體計算,在記憶體較小的裝置上可能失敗,屬正常現象。</li>
      </ul>
    </LegalNote>
  </div>
</template>
