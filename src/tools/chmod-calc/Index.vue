<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  parseOctal,
  permsToOctal,
  permsToSymbolic,
  describe,
  describeSpecial,
  type Perms,
} from '@/features/chmod'

/*
  chmod 權限計算機 —— 八進位(755)↔ 符號(rwxr-xr-x)互轉,含 setuid / setgid / sticky。
  用核取方塊勾選每個身分的讀/寫/執行,即時看到八進位、符號與白話說明。
  全程在你的瀏覽器計算,不連網、不上傳。
*/

// 以核取方塊為單一狀態來源
const owner = ref({ r: true, w: true, x: true })
const group = ref({ r: true, w: false, x: true })
const other = ref({ r: true, w: false, x: true })
const setuid = ref(false)
const setgid = ref(false)
const sticky = ref(false)

const octalInput = ref('755')

function tripletBits(t: { r: boolean; w: boolean; x: boolean }): number {
  return (t.r ? 4 : 0) | (t.w ? 2 : 0) | (t.x ? 1 : 0)
}

const perms = computed<Perms>(() => ({
  special: (setuid.value ? 4 : 0) | (setgid.value ? 2 : 0) | (sticky.value ? 1 : 0),
  owner: tripletBits(owner.value),
  group: tripletBits(group.value),
  other: tripletBits(other.value),
}))

const octal = computed(() => permsToOctal(perms.value))
const octal4 = computed(() => permsToOctal(perms.value, false))
const symbolic = computed(() => permsToSymbolic(perms.value))
const lines = computed(() => describe(perms.value))
const specialLines = computed(() => describeSpecial(perms.value))

// 由八進位輸入反向設定核取方塊
function applyOctal() {
  const r = parseOctal(octalInput.value)
  if (!r.ok || !r.perms) return
  const p = r.perms
  owner.value = { r: !!(p.owner & 4), w: !!(p.owner & 2), x: !!(p.owner & 1) }
  group.value = { r: !!(p.group & 4), w: !!(p.group & 2), x: !!(p.group & 1) }
  other.value = { r: !!(p.other & 4), w: !!(p.other & 2), x: !!(p.other & 1) }
  setuid.value = !!(p.special & 4)
  setgid.value = !!(p.special & 2)
  sticky.value = !!(p.special & 1)
}

const octalError = computed(() =>
  octalInput.value.trim() === '' ? '' : parseOctal(octalInput.value).ok ? '' : parseOctal(octalInput.value).error,
)

const roles = computed(() => [
  { name: '擁有者 (u)', model: owner },
  { name: '群組 (g)', model: group },
  { name: '其他人 (o)', model: other },
])

const presets = [
  { oct: '644', label: '一般檔案' },
  { oct: '755', label: '可執行/目錄' },
  { oct: '600', label: '私密檔' },
  { oct: '777', label: '全開放(不建議)' },
  { oct: '700', label: '只有自己' },
]

function applyPreset(oct: string) {
  octalInput.value = oct
  applyOctal()
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* 忽略 */
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-5">
      <!-- 八進位輸入 -->
      <div>
        <label class="field-label">輸入八進位(會反向勾選下方權限)</label>
        <div class="flex flex-wrap items-center gap-2">
          <input
            v-model="octalInput"
            class="field-input w-32 font-mono text-lg"
            placeholder="755"
            spellcheck="false"
            @input="applyOctal"
          />
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="p in presets"
              :key="p.oct"
              type="button"
              class="rounded-md border border-ink-200 px-2 py-1 text-xs text-ink-500 transition hover:bg-ink-50"
              @click="applyPreset(p.oct)"
            >
              <span class="font-mono">{{ p.oct }}</span> {{ p.label }}
            </button>
          </div>
        </div>
        <p v-if="octalError" class="mt-2 text-sm text-amber-700">⚠️ {{ octalError }}</p>
      </div>

      <!-- 權限格 -->
      <div class="overflow-x-auto">
        <table class="w-full text-center text-sm">
          <thead>
            <tr class="text-ink-400">
              <th class="py-1 text-left font-medium">身分</th>
              <th class="py-1 font-medium">讀 (r/4)</th>
              <th class="py-1 font-medium">寫 (w/2)</th>
              <th class="py-1 font-medium">執行 (x/1)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="role in roles" :key="role.name" class="border-t border-line">
              <td class="py-2 text-left font-medium text-ink-700">{{ role.name }}</td>
              <td><input v-model="role.model.value.r" type="checkbox" class="h-5 w-5 rounded" /></td>
              <td><input v-model="role.model.value.w" type="checkbox" class="h-5 w-5 rounded" /></td>
              <td><input v-model="role.model.value.x" type="checkbox" class="h-5 w-5 rounded" /></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 特殊位元 -->
      <div class="flex flex-wrap gap-4 text-sm text-ink-600">
        <label class="flex items-center gap-1.5"><input v-model="setuid" type="checkbox" class="rounded" /> setuid (4)</label>
        <label class="flex items-center gap-1.5"><input v-model="setgid" type="checkbox" class="rounded" /> setgid (2)</label>
        <label class="flex items-center gap-1.5"><input v-model="sticky" type="checkbox" class="rounded" /> sticky (1)</label>
      </div>
    </div>

    <!-- 結果 -->
    <div class="card p-6 space-y-3">
      <div class="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          class="rounded-lg bg-ink-50 px-4 py-3 text-left transition hover:bg-ink-100"
          title="點一下複製"
          @click="copy(octal)"
        >
          <div class="text-xs font-semibold text-ink-400">八進位</div>
          <div class="font-mono text-2xl text-ink-800">{{ octal }}</div>
          <div class="font-mono text-xs text-ink-400">chmod {{ octal }} 檔名 · 完整 {{ octal4 }}</div>
        </button>
        <button
          type="button"
          class="rounded-lg bg-ink-50 px-4 py-3 text-left transition hover:bg-ink-100"
          title="點一下複製"
          @click="copy(symbolic)"
        >
          <div class="text-xs font-semibold text-ink-400">符號 (symbolic)</div>
          <div class="font-mono text-2xl text-ink-800">{{ symbolic }}</div>
          <div class="font-mono text-xs text-ink-400">ls -l 顯示的後 9 碼</div>
        </button>
      </div>

      <div class="rounded-lg border border-line p-3 text-sm">
        <div v-for="ln in lines" :key="ln.role" class="flex justify-between py-0.5">
          <span class="text-ink-500">{{ ln.role }}</span>
          <span class="font-mono text-ink-700">{{ ln.can }}</span>
        </div>
      </div>

      <ul v-if="specialLines.length" class="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
        <li v-for="s in specialLines" :key="s" class="py-0.5">⚠️ {{ s }}</li>
      </ul>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>把 <code>chmod</code> 的<strong>八進位數字</strong>(如 755)和 <code>ls -l</code> 的<strong>符號表示</strong>(rwxr-xr-x)雙向對照,不必死背。</li>
        <li>勾選每個身分(擁有者/群組/其他人)的<strong>讀 r、寫 w、執行 x</strong>,即時看到對應數字與指令。</li>
        <li>支援 <strong>setuid / setgid / sticky</strong> 特殊位元,並用白話說明它們的作用與風險。</li>
        <li>常見權限一鍵帶入(644 一般檔、755 可執行/目錄、600 私密檔…)。</li>
        <li>全程<strong>在你的瀏覽器</strong>計算,<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
