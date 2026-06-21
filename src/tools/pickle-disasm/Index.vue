<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parsePickleInput, disassemblePickle, type PickleResult } from '@/features/pickle'
import PickleTree from './PickleTree.vue'

/*
  Python pickle 反組譯器 —— 只讀不執行,把 .pkl 位元組逐個 opcode 拆給你看,並在不呼叫任何
  建構式的前提下重建資料結構,先看清楚一個 pickle 裝了什麼、會去 import / 呼叫哪些東西。
  全程在你瀏覽器解析,不連網、不上傳。
*/
const raw = ref('')
const fileResult = ref<{ bytes: Uint8Array | null; format: string; error?: string } | null>(null)
const fileName = ref('')
const view = ref<'value' | 'ops'>('value')

// 範例:pickle.dumps({'user':'admin','roles':['a','b'],'level':7}, protocol=4) 的 base64
const SAMPLE = 'gASVMgAAAAAAAAB9lCiMBHVzZXKUjAVhZG1pbpSMBXJvbGVzlF2UKIwBYZSMAWKUZYwFbGV2ZWyUSwd1Lg=='

const parsed = computed<{ format: string; bytes: Uint8Array | null; error?: string; ready: boolean }>(() => {
  if (fileResult.value) return { format: fileResult.value.format, bytes: fileResult.value.bytes, error: fileResult.value.error, ready: true }
  if (!raw.value.trim()) return { format: '', bytes: null, ready: false }
  const r = parsePickleInput(raw.value)
  return { format: r.format, bytes: r.bytes, error: r.error, ready: true }
})

const result = computed<PickleResult | null>(() => {
  if (!parsed.value.bytes) return null
  return disassemblePickle(parsed.value.bytes)
})

// 整支 pickle 是否含危險 opcode(GLOBAL / REDUCE / 物件建構)
const hasDanger = computed(() => result.value?.ops.some((o) => ['GLOBAL', 'STACK_GLOBAL', 'REDUCE', 'NEWOBJ', 'NEWOBJ_EX', 'INST', 'OBJ', 'BUILD'].includes(o.name)) ?? false)

async function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  fileName.value = f.name
  raw.value = ''
  const buf = await f.arrayBuffer()
  fileResult.value = { bytes: new Uint8Array(buf), format: '檔案' }
}
function clearFile() { fileResult.value = null; fileName.value = '' }
function onPaste() { fileResult.value = null; fileName.value = '' }
</script>

<template>
  <div class="space-y-6">
    <div class="rounded-xl border border-amber-300 bg-amber-50/70 p-3 text-sm text-amber-900">
      ⚠️ <strong>安全提醒</strong>:Python 的 <code>pickle.load()</code> 會在反序列化時<strong>執行</strong>資料裡指定的程式碼,
      載入來路不明的 <code>.pkl</code> 等同執行陌生程式。本工具<strong>只讀不執行</strong>,讓你在打開前先看清楚內容。
    </div>

    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">開啟 pickle 檔(.pkl / .pickle)</label>
        <input type="file" accept=".pkl,.pickle,.pck,application/octet-stream" class="block w-full text-sm text-ink-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-200" @change="onFile" />
        <p v-if="fileName" class="field-hint">已載入:<strong>{{ fileName }}</strong> · <button type="button" class="text-brand-700 hover:underline" @click="clearFile">清除</button></p>
      </div>
      <div class="text-center text-xs text-ink-400">— 或 —</div>
      <div>
        <label class="field-label">貼上 pickle 內容</label>
        <textarea
          v-model="raw"
          rows="5"
          class="field-input font-mono text-sm"
          placeholder="貼上 pickle 的 hex / base64,或 protocol 0 的文字 pickle"
          spellcheck="false"
          @input="onPaste"
        ></textarea>
        <p class="field-hint">可貼 hex、base64,或 protocol 0 文字 pickle。全程在你瀏覽器解析,內容不上傳。</p>
      </div>
      <button type="button" class="text-sm text-brand-700 hover:underline" @click="raw = SAMPLE; onPaste()">
        載入範例(含巢狀 list / dict 的 pickle)
      </button>
    </div>

    <div v-if="parsed.ready && parsed.error && !parsed.bytes" class="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-sm text-rose-700">
      ⚠️ {{ parsed.error }}
    </div>

    <div v-if="result" class="card p-5 space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex flex-wrap items-center gap-2 text-sm">
          <span class="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-700">{{ parsed.format }}</span>
          <span v-if="result.protocol !== null" class="text-ink-500">protocol {{ result.protocol }}</span>
          <span class="text-ink-400 text-xs">{{ result.ops.length }} 個 opcode</span>
          <span v-if="hasDanger" class="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700">含 GLOBAL / REDUCE,謹慎</span>
        </div>
        <div class="inline-flex rounded-lg border border-ink-200 p-0.5 text-xs">
          <button type="button" class="rounded-md px-2.5 py-1 font-medium" :class="view === 'value' ? 'bg-brand-100 text-brand-700' : 'text-ink-500'" @click="view = 'value'">重建結構</button>
          <button type="button" class="rounded-md px-2.5 py-1 font-medium" :class="view === 'ops' ? 'bg-brand-100 text-brand-700' : 'text-ink-500'" @click="view = 'ops'">opcode 反組譯</button>
        </div>
      </div>

      <div v-if="result.error" class="rounded-lg border border-amber-200 bg-amber-50/60 p-2 text-xs text-amber-800">
        ⚠️ 解析中止:{{ result.error }}(以下為已成功解析的部分)
      </div>

      <div v-if="view === 'value'" class="overflow-x-auto">
        <PickleTree v-if="result.value" :nodes="[result.value]" :depth="0" />
        <p v-else class="text-sm text-ink-500">沒有可重建的頂層值。</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-xs font-mono">
          <thead class="text-ink-400">
            <tr><th class="py-1 pr-3 font-medium">offset</th><th class="py-1 pr-3 font-medium">opcode</th><th class="py-1 font-medium">引數</th></tr>
          </thead>
          <tbody>
            <tr v-for="(o, i) in result.ops" :key="i" class="border-t border-ink-100">
              <td class="py-1 pr-3 text-ink-400">{{ o.offset }}</td>
              <td class="py-1 pr-3" :class="['GLOBAL', 'STACK_GLOBAL', 'REDUCE', 'NEWOBJ', 'NEWOBJ_EX', 'INST', 'OBJ', 'BUILD'].includes(o.name) ? 'font-semibold text-rose-700' : 'text-ink-800'">{{ o.name }}</td>
              <td class="py-1 text-ink-600 break-all">{{ o.arg }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>把 <strong>Python pickle</strong>(<code>.pkl</code> / <code>.pickle</code>)逐個 <strong>opcode</strong> 拆給你看(等同 <code>pickletools.dis</code>),並在<strong>不執行任何程式碼</strong>的前提下重建出 list / tuple / dict / set / 數字 / 字串等資料結構。</li>
        <li><strong>安全用途</strong>:<code>pickle.load()</code> 會在反序列化時執行資料指定的程式碼,載入來路不明的 .pkl(常見於 ML 模型權重、Django / Celery 任務、快取)等同執行陌生程式。本工具讓你<strong>先看清楚</strong>它會去 <code>import</code> 哪些模組、呼叫哪些函式(<code>GLOBAL</code> / <code>REDUCE</code> 會標紅)。</li>
        <li>支援 pickle <strong>protocol 0~5</strong> 的 opcode;可上傳檔案,或貼 hex / base64 / protocol 0 文字 pickle。</li>
        <li>檔案<strong>全程在你瀏覽器解析,不連網、不上傳</strong>。需要其他二進位格式請用 CBOR / MessagePack / Bencode 解碼器。</li>
      </ul>
    </LegalNote>
  </div>
</template>
