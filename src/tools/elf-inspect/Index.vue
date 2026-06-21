<script setup lang="ts">
import { ref } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parseElf, type ElfInfo } from '@/features/elf'

/*
  ELF 執行檔(Linux / BSD)檢視器 —— 拿到來路不明的 Linux 執行檔 / .so,不必在機器上跑就能看清楚:
  幾位元、大小端、CPU、是執行檔還是函式庫、是否 PIE、NX / RELRO 防護、動態還是靜態連結、
  用到哪些共享函式庫、動態載入器是誰、有沒有被 strip。全程在你瀏覽器解析,不連網、不上傳、不執行。
*/
const info = ref<ElfInfo | null>(null)
const fileName = ref('')
const fileSize = ref(0)

async function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  fileName.value = f.name
  fileSize.value = f.size
  const buf = await f.arrayBuffer()
  info.value = parseElf(new Uint8Array(buf))
}

function sizeLabel(n: number) { return n > 1048576 ? (n / 1048576).toFixed(2) + ' MB' : n > 1024 ? (n / 1024).toFixed(1) + ' KB' : n + ' B' }
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-3">
      <label class="field-label">開啟 ELF 執行檔(Linux / BSD 的執行檔、.so、.o、core)</label>
      <input type="file" class="block w-full text-sm text-ink-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-200" @change="onFile" />
      <p v-if="fileName" class="field-hint">已載入:<strong>{{ fileName }}</strong> · {{ sizeLabel(fileSize) }}</p>
      <p class="field-hint">檔案全程在你瀏覽器解析,不連網、不上傳、不執行。</p>
    </div>

    <div v-if="info?.error" class="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-sm text-rose-700">
      ⚠️ {{ info.error }}
    </div>

    <template v-if="info && !info.error">
      <!-- 概要 -->
      <div class="card p-5 space-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <span class="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-700">ELF{{ info.class }} · {{ info.endian.split('(')[0] }}</span>
          <span class="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs text-ink-600">{{ info.linkage }}</span>
          <span v-if="info.pie" class="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs text-emerald-700">PIE</span>
          <span v-if="info.stripped === true" class="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs text-ink-600">已 strip(無符號)</span>
          <span v-else-if="info.stripped === false" class="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs text-ink-600">含符號表</span>
        </div>
        <dl class="grid gap-x-4 gap-y-2 sm:grid-cols-[8rem_1fr] text-sm">
          <dt class="text-ink-500">類型</dt><dd class="text-ink-800">{{ info.type }}</dd>
          <dt class="text-ink-500">目標 CPU</dt><dd class="text-ink-800">{{ info.machine }}</dd>
          <dt class="text-ink-500">作業系統 ABI</dt><dd class="text-ink-800">{{ info.osabi }}</dd>
          <dt class="text-ink-500">進入點</dt><dd class="text-ink-800 font-mono text-xs">{{ info.entry }}</dd>
          <dt v-if="info.interpreter" class="text-ink-500">動態載入器</dt><dd v-if="info.interpreter" class="text-ink-800 font-mono text-xs break-all">{{ info.interpreter }}</dd>
          <dt v-if="info.soname" class="text-ink-500">SONAME</dt><dd v-if="info.soname" class="text-ink-800 font-mono text-xs">{{ info.soname }}</dd>
          <dt v-if="info.runpath" class="text-ink-500">RUNPATH</dt><dd v-if="info.runpath" class="text-ink-800 font-mono text-xs break-all">{{ info.runpath }}</dd>
        </dl>
      </div>

      <!-- 安全防護 -->
      <div class="card p-5 space-y-2">
        <div class="text-sm font-semibold text-ink-700">安全防護(hardening)</div>
        <dl class="grid gap-x-4 gap-y-2 sm:grid-cols-[8rem_1fr] text-sm">
          <dt class="text-ink-500">PIE / ASLR</dt>
          <dd :class="info.pie ? 'text-emerald-700' : 'text-amber-700'">{{ info.pie ? '✅ 啟用(位址隨機化)' : (info.type.includes('可執行檔') ? '⚠️ 否(固定載入位址)' : '不適用') }}</dd>
          <dt class="text-ink-500">NX(堆疊)</dt>
          <dd :class="info.nx.includes('已啟用') ? 'text-emerald-700' : info.nx.includes('可執行') ? 'text-rose-700' : 'text-ink-600'">{{ info.nx }}</dd>
          <dt class="text-ink-500">RELRO</dt>
          <dd :class="info.relro.includes('完整') ? 'text-emerald-700' : info.relro === '無' ? 'text-amber-700' : 'text-ink-700'">{{ info.relro }}</dd>
        </dl>
      </div>

      <!-- 共享函式庫 -->
      <div v-if="info.needed.length" class="card p-5 space-y-2">
        <div class="text-sm font-semibold text-ink-700">會用到的共享函式庫(DT_NEEDED,{{ info.needed.length }})</div>
        <div class="flex flex-wrap gap-1.5">
          <span v-for="d in info.needed" :key="d" class="rounded bg-ink-100 px-2 py-0.5 font-mono text-xs text-ink-700">{{ d }}</span>
        </div>
      </div>

      <!-- 程式標頭 -->
      <div v-if="info.segments.length" class="card p-5 space-y-2">
        <div class="text-sm font-semibold text-ink-700">程式標頭 / 段(segment,{{ info.segments.length }})</div>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="text-ink-400"><tr><th class="py-1 pr-3 font-medium">類型</th><th class="py-1 pr-3 font-medium">權限</th><th class="py-1 pr-3 font-medium">虛擬位址</th><th class="py-1 pr-3 font-medium">檔內大小</th><th class="py-1 font-medium">記憶體大小</th></tr></thead>
            <tbody>
              <tr v-for="(s, i) in info.segments" :key="i" class="border-t border-ink-100">
                <td class="py-1 pr-3 font-mono text-ink-800">{{ s.type }}</td>
                <td class="py-1 pr-3 font-mono" :class="s.flags === 'RWX' ? 'text-rose-700 font-semibold' : 'text-ink-600'">{{ s.flags }}</td>
                <td class="py-1 pr-3 font-mono text-ink-500">{{ s.vaddr }}</td>
                <td class="py-1 pr-3 font-mono text-ink-500">{{ s.fileSize }}</td>
                <td class="py-1 font-mono text-ink-500">{{ s.memSize }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="info.segments.some((s) => s.flags === 'RWX')" class="text-xs text-rose-600">⚠️ 有段同時「可讀可寫可執行(RWX)」—— 自我修改 / 加殼程式常見特徵,請提高警覺。</p>
      </div>

      <!-- 區段 -->
      <div v-if="info.sections.length" class="card p-5 space-y-2">
        <div class="text-sm font-semibold text-ink-700">區段(section,{{ info.sections.length }})</div>
        <div class="flex flex-wrap gap-1.5">
          <span v-for="(s, i) in info.sections" :key="i" class="rounded bg-ink-100 px-2 py-0.5 font-mono text-xs text-ink-700" :title="s.size + ' 位元組'">{{ s.name || '(無名)' }}</span>
        </div>
      </div>
    </template>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>拿到一個來路不明的 <strong>Linux 執行檔 / .so</strong>,不必在機器上跑就能看清楚:<strong>32 還是 64 位元、大小端、給哪種 CPU</strong>(x86-64 / ARM64 / RISC-V…)、是<strong>執行檔還是共享函式庫</strong>。</li>
        <li>檢視<strong>安全防護</strong>:是不是 <strong>PIE</strong>(位址隨機化)、有沒有 <strong>NX</strong>(不可執行堆疊)、<strong>RELRO</strong> 程度 —— 等同 <code>checksec</code>;並標出 RWX 段這類加殼 / 自我修改特徵。</li>
        <li>列出<strong>會用到哪些共享函式庫</strong>(DT_NEEDED)、<strong>動態載入器</strong>(interpreter)、是否<strong>被 strip</strong> 掉符號,可推測程式相依與行為。</li>
        <li>⚠️ 本工具<strong>不是防毒軟體</strong>,只幫你「執行前先看清楚」。檔案<strong>全程在你瀏覽器解析,不連網、不上傳、不執行</strong>。Windows 的 .exe / .dll 請用「EXE / DLL 檢視器」。</li>
      </ul>
    </LegalNote>
  </div>
</template>
