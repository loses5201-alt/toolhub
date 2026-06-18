<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { computeNewNames, type RenameOptions } from '@/features/batchRename'

/*
  批次檔案改名 —— 選一批檔案,套用「尋找取代 / 大小寫 / 前後綴 / 流水號」規則,
  即時預覽舊→新名稱,再打包成 ZIP 下載(瀏覽器無法直接改寫硬碟檔名)。
  全程在你瀏覽器,檔案不上傳。
*/
interface Picked {
  name: string
  file: File
}
const files = ref<Picked[]>([])
const error = ref('')
const busy = ref(false)

const opts = reactive<RenameOptions>({
  find: '',
  replace: '',
  findIgnoreCase: false,
  caseMode: 'none',
  prefix: '',
  suffix: '',
  numbering: false,
  start: 1,
  step: 1,
  pad: 0,
  numberPosition: 'suffix',
  separator: '',
  keepExtension: true,
})

const results = computed(() =>
  computeNewNames(files.value.map((f) => f.name), { ...opts }),
)
const changedCount = computed(() => results.value.filter((r, i) => r.newName !== files.value[i]?.name).length)

function addFiles(list: FileList | null) {
  if (!list) return
  const picked = Array.from(list).map((file) => ({ name: file.name, file }))
  // 依檔名自然排序,讓流水號順序符合直覺
  picked.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant', { numeric: true }))
  files.value = [...files.value, ...picked]
}
function onPick(e: Event) {
  const t = e.target as HTMLInputElement
  addFiles(t.files)
  t.value = ''
}
function onDrop(e: DragEvent) {
  e.preventDefault()
  addFiles(e.dataTransfer?.files ?? null)
}
function removeAt(i: number) {
  files.value = files.value.filter((_, idx) => idx !== i)
}
function clearAll() {
  files.value = []
  error.value = ''
}

async function downloadZip() {
  if (files.value.length === 0) return
  busy.value = true
  error.value = ''
  try {
    const { buildZip } = await import('@/features/zipStudio')
    const res = results.value
    const items = await Promise.all(
      files.value.map(async (f, i) => ({
        name: res[i].newName,
        data: new Uint8Array(await f.file.arrayBuffer()),
      })),
    )
    // level 0 = STORE:相片/影片等多半已壓縮,不再耗時壓縮
    const bytes = await buildZip(items, { level: 0 })
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/zip' }))
    const a = document.createElement('a')
    a.href = url
    a.download = '改名結果.zip'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (err) {
    error.value = '打包失敗:' + (err as Error).message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 sm:p-6 space-y-5">
      <!-- 選檔 -->
      <div
        class="rounded-xl border-2 border-dashed border-line bg-stone-50/60 p-6 text-center transition hover:border-brand-400"
        @drop="onDrop"
        @dragover.prevent
      >
        <label class="cursor-pointer">
          <input type="file" multiple class="hidden" @change="onPick" />
          <p class="font-semibold text-ink-800">點此選擇檔案,或把檔案拖進來</p>
          <p class="field-hint mt-1">可一次選多個。檔案只在你的瀏覽器處理,不會上傳。</p>
        </label>
      </div>

      <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

      <!-- 規則 -->
      <div v-if="files.length > 0" class="space-y-4 rounded-xl border border-line bg-stone-50/60 p-4 text-sm">
        <p class="font-semibold text-ink-700">改名規則(可疊加)</p>

        <div class="flex flex-wrap items-center gap-3">
          <span class="text-ink-700">尋找</span>
          <input v-model="opts.find" type="text" placeholder="原檔名中的文字" class="w-40 rounded-lg border border-line bg-white px-2 py-1.5" />
          <span class="text-ink-700">取代成</span>
          <input v-model="opts.replace" type="text" placeholder="(留空=刪除)" class="w-40 rounded-lg border border-line bg-white px-2 py-1.5" />
          <label class="flex items-center gap-2">
            <input v-model="opts.findIgnoreCase" type="checkbox" class="accent-brand-600 h-4 w-4" />
            <span class="text-ink-700">忽略大小寫</span>
          </label>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <span class="text-ink-700">前綴</span>
          <input v-model="opts.prefix" type="text" placeholder="加在最前" class="w-32 rounded-lg border border-line bg-white px-2 py-1.5" />
          <span class="text-ink-700">後綴</span>
          <input v-model="opts.suffix" type="text" placeholder="加在副檔名前" class="w-32 rounded-lg border border-line bg-white px-2 py-1.5" />
          <label class="flex items-center gap-2">
            <span class="text-ink-700">大小寫</span>
            <select v-model="opts.caseMode" class="rounded-lg border border-line bg-white px-2 py-1.5">
              <option value="none">不變</option>
              <option value="lower">全部小寫</option>
              <option value="upper">全部大寫</option>
            </select>
          </label>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <label class="flex items-center gap-2">
            <input v-model="opts.numbering" type="checkbox" class="accent-brand-600 h-4 w-4" />
            <span class="text-ink-700">加流水號</span>
          </label>
          <template v-if="opts.numbering">
            <select v-model="opts.numberPosition" class="rounded-lg border border-line bg-white px-2 py-1.5">
              <option value="suffix">放在後面</option>
              <option value="prefix">放在前面</option>
            </select>
            <label class="flex items-center gap-1">
              <span class="text-ink-600">起始</span>
              <input v-model.number="opts.start" type="number" class="w-16 rounded-lg border border-line bg-white px-2 py-1.5" />
            </label>
            <label class="flex items-center gap-1">
              <span class="text-ink-600">遞增</span>
              <input v-model.number="opts.step" type="number" class="w-16 rounded-lg border border-line bg-white px-2 py-1.5" />
            </label>
            <label class="flex items-center gap-1">
              <span class="text-ink-600">補零位數</span>
              <input v-model.number="opts.pad" type="number" min="0" class="w-16 rounded-lg border border-line bg-white px-2 py-1.5" />
            </label>
            <label class="flex items-center gap-1">
              <span class="text-ink-600">分隔</span>
              <input v-model="opts.separator" type="text" placeholder="如 _ 或 -" class="w-16 rounded-lg border border-line bg-white px-2 py-1.5" />
            </label>
          </template>
        </div>
      </div>

      <!-- 預覽 -->
      <div v-if="files.length > 0">
        <div class="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <label class="field-label !mb-0">
            預覽<span class="ml-2 text-sm font-normal text-ink-400">共 {{ files.length }} 個,{{ changedCount }} 個有改名</span>
          </label>
          <div class="flex gap-3 text-sm">
            <button :disabled="busy" class="rounded-lg bg-brand-600 px-4 py-1.5 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50" @click="downloadZip">
              {{ busy ? '打包中…' : '下載 ZIP(已改名)' }}
            </button>
            <button class="text-ink-400 underline hover:text-red-500" @click="clearAll">清空</button>
          </div>
        </div>
        <div class="overflow-x-auto rounded-xl border border-line">
          <table class="min-w-full text-sm">
            <thead class="bg-stone-100 text-ink-700">
              <tr>
                <th class="px-3 py-2 text-left font-semibold">原檔名</th>
                <th class="px-3 py-2 text-left font-semibold">新檔名</th>
                <th class="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(f, i) in files" :key="i" class="border-t border-line/60 odd:bg-white even:bg-stone-50/50">
                <td class="max-w-[16rem] truncate px-3 py-1.5 text-ink-500" :title="f.name">{{ f.name }}</td>
                <td
                  class="max-w-[16rem] truncate px-3 py-1.5"
                  :class="results[i]?.newName !== f.name ? 'font-medium text-brand-700' : 'text-ink-700'"
                  :title="results[i]?.newName"
                >{{ results[i]?.newName }}</td>
                <td class="px-3 py-1.5 text-right">
                  <button class="text-ink-300 hover:text-red-500" title="移除" @click="removeAt(i)">✕</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="field-hint">瀏覽器不能直接改你硬碟上的檔名,所以改名結果會打包成一個 ZIP 讓你下載、解壓即得改名後的檔案。</p>
      </div>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>一次把整批照片、文件<strong>加上統一前綴/後綴、流水號(可補零)、改大小寫,或把檔名裡的某段文字換掉</strong>。</li>
        <li>例:把 <code>DSC0001.JPG…</code> 改成 <code>2026旅遊_001.jpg…</code>,或把一堆 <code>報告 final.docx</code> 統一去掉「 final」。</li>
        <li>會<strong>即時預覽</strong>每個檔的新名稱,算出來同名時自動加 <code>(2)</code> 不覆蓋;副檔名預設保留不動。</li>
        <li><strong>不上傳</strong>:檔案全程留在你電腦,只把改名結果打包成 ZIP 供下載。</li>
        <li>需要把多個檔打包/解壓請用「ZIP 工坊」;大檔切小請用「檔案分割 / 合併」。</li>
      </ul>
    </LegalNote>
  </div>
</template>
