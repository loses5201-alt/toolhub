<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parsePe, type PeInfo } from '@/features/pe'

/*
  Windows 執行檔(.exe / .dll)檢視器 —— 下載到一個 exe 先別急著執行,先看清楚它是什麼:
  幾位元、給哪種 CPU、編譯時間、GUI 還是命令列、有沒有開 ASLR / DEP、是否帶數位簽章、
  會去呼叫哪些系統 DLL。全程在你瀏覽器解析,不連網、不上傳、不執行。
*/
const info = ref<PeInfo | null>(null)
const fileName = ref('')
const fileSize = ref(0)

async function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  fileName.value = f.name
  fileSize.value = f.size
  const buf = await f.arrayBuffer()
  info.value = parsePe(new Uint8Array(buf))
}

const sizeLabel = computed(() => fileSize.value > 1048576 ? (fileSize.value / 1048576).toFixed(2) + ' MB' : (fileSize.value / 1024).toFixed(1) + ' KB')
</script>

<template>
  <div class="space-y-6">
    <div class="rounded-xl border border-amber-300 bg-amber-50/70 p-3 text-sm text-amber-900">
      ⚠️ 本工具<strong>只讀標頭、不執行檔案</strong>。但請注意:即使有數位簽章也<strong>不代表安全</strong>(簽章可能來自惡意者或已失效);
      本工具僅顯示「是否存在簽章」,<strong>不驗證簽章有效性與簽署者</strong>。仍有疑慮請勿執行。
    </div>

    <div class="card p-6 space-y-3">
      <label class="field-label">開啟 Windows 執行檔(.exe / .dll / .sys)</label>
      <input type="file" accept=".exe,.dll,.sys,.scr,.ocx,.cpl,application/vnd.microsoft.portable-executable,application/x-msdownload" class="block w-full text-sm text-ink-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-200" @change="onFile" />
      <p v-if="fileName" class="field-hint">已載入:<strong>{{ fileName }}</strong> · {{ sizeLabel }}</p>
      <p class="field-hint">檔案全程在你瀏覽器解析,不連網、不上傳、不執行。</p>
    </div>

    <div v-if="info?.error" class="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-sm text-rose-700">
      ⚠️ {{ info.error }}
    </div>

    <template v-if="info && !info.error">
      <div class="card p-5 space-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <span class="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-700">{{ info.magic }} · {{ info.bits }} 位元</span>
          <span class="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs text-ink-600">{{ info.isDll ? 'DLL 動態連結庫' : 'EXE 執行檔' }}</span>
          <span
            class="rounded-full px-2.5 py-0.5 text-xs font-semibold"
            :class="info.signed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'"
          >{{ info.signed ? '帶數位簽章(未驗證有效性)' : '未帶數位簽章' }}</span>
        </div>
        <dl class="grid gap-x-4 gap-y-2 sm:grid-cols-[8rem_1fr] text-sm">
          <dt class="text-ink-500">目標 CPU</dt><dd class="text-ink-800">{{ info.machine }}</dd>
          <dt class="text-ink-500">子系統</dt><dd class="text-ink-800">{{ info.subsystem }}</dd>
          <dt class="text-ink-500">編譯時間</dt><dd class="text-ink-800 font-mono text-xs">{{ info.timestamp ? info.timestamp.replace('T', ' ').replace('.000Z', ' UTC') : '未填(0,可能被刻意清除)' }}</dd>
          <dt class="text-ink-500">進入點 RVA</dt><dd class="text-ink-800 font-mono text-xs">0x{{ info.entryPoint.toString(16) }}</dd>
          <dt class="text-ink-500">映像基底</dt><dd class="text-ink-800 font-mono text-xs">{{ info.imageBase }}</dd>
        </dl>
      </div>

      <!-- 安全防護 -->
      <div class="card p-5 space-y-2">
        <div class="text-sm font-semibold text-ink-700">安全防護(DllCharacteristics)</div>
        <div v-if="info.mitigations.length" class="flex flex-wrap gap-1.5">
          <span v-for="m in info.mitigations" :key="m" class="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-700 border border-emerald-200">{{ m }}</span>
        </div>
        <p v-else class="text-sm text-amber-700">⚠️ 未開啟任何常見防護(ASLR / DEP 等),較舊或可疑程式常見。</p>
        <div v-if="info.characteristics.length" class="flex flex-wrap gap-1.5 pt-1">
          <span v-for="c in info.characteristics" :key="c" class="rounded bg-ink-100 px-2 py-0.5 text-xs text-ink-600">{{ c }}</span>
        </div>
      </div>

      <!-- 匯入的 DLL -->
      <div class="card p-5 space-y-2">
        <div class="text-sm font-semibold text-ink-700">會呼叫的系統 DLL（import，{{ info.imports.length }}）</div>
        <div v-if="info.imports.length" class="flex flex-wrap gap-1.5">
          <span v-for="d in info.imports" :key="d" class="rounded bg-ink-100 px-2 py-0.5 font-mono text-xs text-ink-700">{{ d }}</span>
        </div>
        <p v-else class="text-sm text-ink-500">未解析到 import 表(可能是無相依、已加殼 / 壓縮,或匯入表不在標準位置)。</p>
      </div>

      <!-- 區段 -->
      <div class="card p-5 space-y-2">
        <div class="text-sm font-semibold text-ink-700">區段({{ info.sections.length }})</div>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="text-ink-400">
              <tr><th class="py-1 pr-3 font-medium">名稱</th><th class="py-1 pr-3 font-medium">虛擬位址</th><th class="py-1 pr-3 font-medium">虛擬大小</th><th class="py-1 pr-3 font-medium">原始大小</th><th class="py-1 font-medium">屬性</th></tr>
            </thead>
            <tbody>
              <tr v-for="(s, i) in info.sections" :key="i" class="border-t border-ink-100">
                <td class="py-1 pr-3 font-mono text-ink-800">{{ s.name }}</td>
                <td class="py-1 pr-3 font-mono text-ink-500">0x{{ s.vaddr.toString(16) }}</td>
                <td class="py-1 pr-3 font-mono text-ink-500">0x{{ s.vsize.toString(16) }}</td>
                <td class="py-1 pr-3 font-mono text-ink-500">0x{{ s.rawSize.toString(16) }}</td>
                <td class="py-1 text-ink-600">
                  <span v-for="f in s.flags" :key="f" class="mr-1 inline-block rounded bg-ink-100 px-1.5 py-0.5" :class="f === '可執行' && (s.flags.includes('可寫')) ? 'bg-rose-100 text-rose-700' : ''">{{ f }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="info.sections.some((s) => s.flags.includes('可執行') && s.flags.includes('可寫'))" class="text-xs text-rose-600">⚠️ 有區段同時「可寫 + 可執行」—— 加殼或自我修改程式常見特徵,請提高警覺。</p>
      </div>
    </template>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>下載到一個 <code>.exe</code> / <code>.dll</code> 先別急著執行,用這支看清楚它是什麼:<strong>32 還是 64 位元、給哪種 CPU</strong>(x86 / x64 / ARM)、<strong>編譯時間</strong>、是 <strong>GUI 還是命令列</strong>程式。</li>
        <li>看<strong>安全防護</strong>(ASLR / DEP / CFG)有沒有開、<strong>是否帶數位簽章</strong>、會去呼叫<strong>哪些系統 DLL</strong>(import)—— 可推測程式大概會做什麼(網路、登錄檔、加密…)。</li>
        <li>標出「可寫 + 可執行」區段等<strong>加殼 / 自我修改</strong>的可疑特徵。</li>
        <li>⚠️ 本工具<strong>不是防毒軟體</strong>,也<strong>不驗證簽章有效性</strong>;只幫你「執行前先看清楚」。檔案<strong>全程在你瀏覽器解析,不連網、不上傳、不執行</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
