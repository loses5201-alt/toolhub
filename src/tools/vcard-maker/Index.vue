<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parseTable } from '@/features/mailMerge'
import {
  buildVCard,
  buildVCards,
  tableToContacts,
  type Contact,
} from '@/features/vcard'

/*
  vCard 聯絡人產生器 —— 把單一聯絡人,或一份 Excel/CSV 通訊錄,做成 .vcf 檔,
  直接匯入 iPhone / Android / Google / Apple / Outlook 聯絡人。
  線上 CSV→vCard 轉換器要你上傳含姓名電話的個資名單;本工具全程在你瀏覽器處理、不上傳。
*/

type Mode = 'single' | 'batch'
const mode = ref<Mode>('single')

// ---- 單筆 ----
const form = reactive<Contact>({
  name: '',
  cell: '',
  phone: '',
  email: '',
  org: '',
  title: '',
  address: '',
  birthday: '',
  url: '',
  note: '',
})
const singleVcf = computed(() => buildVCard(form))
const singleFilename = computed(() => safeName((form.name || '聯絡人').trim()) + '.vcf')

// ---- 批次 ----
const tableText = ref(
  '姓名,手機,Email,公司,職稱\n王小明,0912345678,ming@example.com,好棒公司,工程師\n李美麗,0922000111,mei@example.com,好棒公司,經理',
)
const batch = computed(() => {
  const table = parseTable(tableText.value)
  if (table.headers.length === 0) {
    return { ok: false as const, error: '請貼上通訊錄(第一列為欄位名)' }
  }
  const r = tableToContacts(table)
  return { ok: true as const, ...r, vcf: buildVCards(r.contacts) }
})

function safeName(s: string): string {
  return (s.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'contacts').slice(0, 60)
}

function downloadVcf(content: string, filename: string) {
  if (!content) return
  const blob = new Blob([content], { type: 'text/vcard;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const copied = ref(false)
function copySingle() {
  if (!singleVcf.value) return
  navigator.clipboard?.writeText(singleVcf.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="space-y-6">
    <!-- 模式切換 -->
    <div class="flex gap-2">
      <button
        class="rounded-xl px-4 py-2 text-sm font-semibold transition"
        :class="mode === 'single' ? 'bg-brand-600 text-white' : 'bg-ink-50 text-ink-600 hover:bg-ink-100'"
        @click="mode = 'single'"
      >
        單筆聯絡人
      </button>
      <button
        class="rounded-xl px-4 py-2 text-sm font-semibold transition"
        :class="mode === 'batch' ? 'bg-brand-600 text-white' : 'bg-ink-50 text-ink-600 hover:bg-ink-100'"
        @click="mode = 'batch'"
      >
        批次(貼 Excel 名單)
      </button>
    </div>

    <!-- 單筆 -->
    <div v-if="mode === 'single'" class="card p-6 space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="sm:col-span-2">
          <label class="field-label">姓名 *</label>
          <input v-model="form.name" type="text" placeholder="例:王小明" class="field-input" />
        </div>
        <div>
          <label class="field-label">手機</label>
          <input v-model="form.cell" type="tel" placeholder="0912345678" class="field-input" />
        </div>
        <div>
          <label class="field-label">市話 / 其他電話</label>
          <input v-model="form.phone" type="tel" placeholder="02-12345678" class="field-input" />
        </div>
        <div>
          <label class="field-label">Email</label>
          <input v-model="form.email" type="email" placeholder="name@example.com" class="field-input" />
        </div>
        <div>
          <label class="field-label">生日</label>
          <input v-model="form.birthday" type="text" placeholder="1990-05-20" class="field-input" />
        </div>
        <div>
          <label class="field-label">公司 / 單位</label>
          <input v-model="form.org" type="text" placeholder="好棒公司" class="field-input" />
        </div>
        <div>
          <label class="field-label">職稱</label>
          <input v-model="form.title" type="text" placeholder="經理" class="field-input" />
        </div>
        <div class="sm:col-span-2">
          <label class="field-label">地址</label>
          <input v-model="form.address" type="text" placeholder="台北市信義區…" class="field-input" />
        </div>
        <div class="sm:col-span-2">
          <label class="field-label">網址</label>
          <input v-model="form.url" type="url" placeholder="https://…" class="field-input" />
        </div>
        <div class="sm:col-span-2">
          <label class="field-label">備註</label>
          <input v-model="form.note" type="text" placeholder="例:大學同學" class="field-input" />
        </div>
      </div>

      <div v-if="!singleVcf" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
        ⚠️ 請至少填寫姓名(或公司、電話、Email 其一)。
      </div>

      <div v-else class="flex flex-wrap items-center gap-3">
        <button class="rounded-xl bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700" @click="downloadVcf(singleVcf, singleFilename)">
          下載 .vcf
        </button>
        <button class="text-sm text-brand-700 underline hover:text-brand-800" @click="copySingle">
          {{ copied ? '已複製 ✓' : '複製 vCard 文字' }}
        </button>
        <span class="text-sm text-ink-400">檔名:{{ singleFilename }}</span>
      </div>
    </div>

    <!-- 批次 -->
    <div v-else class="card p-6 space-y-4">
      <div>
        <label class="field-label">通訊錄(第一列為欄位名,逗號或 Tab 分隔)</label>
        <textarea v-model="tableText" rows="8" class="field-input font-mono text-sm" />
        <p class="field-hint">
          可直接從 <strong>Excel / Google 試算表</strong>整塊複製貼上。欄位名認得:姓名、手機、市話、Email、公司、職稱、地址、生日、網址、備註(中英文皆可)。全程在你瀏覽器處理,不上傳。
        </p>
      </div>

      <div v-if="!batch.ok" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
        ⚠️ {{ batch.error }}
      </div>

      <template v-else>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span class="text-ink-600">將產生 <strong>{{ batch.usable }}</strong> 張聯絡人卡</span>
          <span class="text-ink-400">對應欄位:{{ batch.mapping.map((m) => m.header).join('、') || '(無)' }}</span>
        </div>

        <div v-if="batch.mapping.length === 0" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
          ⚠️ 沒有任何欄位能對應到聯絡人資訊。請確認第一列是欄位名(例:姓名、手機、Email)。
        </div>
        <div v-else-if="batch.unmatched.length" class="rounded-xl border border-ink-200 bg-ink-50/60 p-3 text-sm text-ink-600">
          ℹ️ 這些欄位沒有對應、會被忽略:<strong>{{ batch.unmatched.join('、') }}</strong>
        </div>

        <div v-if="batch.usable" class="flex flex-wrap items-center gap-3">
          <button class="rounded-xl bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700" @click="downloadVcf(batch.vcf, 'contacts.vcf')">
            下載全部({{ batch.usable }} 筆).vcf
          </button>
          <span class="text-sm text-ink-400">一個 .vcf 檔含所有聯絡人,匯入時一次全進。</span>
        </div>
      </template>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>把一份 <strong>Excel / Google 試算表</strong>的通訊錄(同學會、社團、客戶名單)一次做成 .vcf,匯入手機或 Google 聯絡人,免一個一個手動新增。</li>
        <li>產生的 .vcf 是標準 vCard 3.0 格式,<strong>iPhone、Android、Google、Apple、Outlook</strong> 都能直接匯入。</li>
        <li>匯入方式:把 .vcf 用 email 寄給自己再點開、或在 Google 聯絡人選「匯入」、iPhone 用「檔案」App 點開即可。</li>
        <li>本工具<strong>不連網、不上傳、不寄送</strong>,含姓名電話的個資名單只留在你的瀏覽器 —— 線上轉換器則要你把整份名單上傳。</li>
      </ul>
    </LegalNote>
  </div>
</template>
