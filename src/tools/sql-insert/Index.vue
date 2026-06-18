<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  parseTable,
  inferTypes,
  generateSQL,
  type Dialect,
} from '@/features/sqlInsert'

/*
  表格資料 → SQL 語法產生器 —— 貼上 CSV/TSV(第一列為欄位名),產生 INSERT(可一併 CREATE TABLE)。
  字串引號跳脫、空值轉 NULL、數字不加引號、前導 0 保留為字串、各資料庫方言識別字引號 —— 全部處理乾淨。
  全程在你的瀏覽器,可能含個資的資料不上傳。
*/
const input = ref('id,name,price,active\n1,小明,99.5,true\n2,O\'Brien,120,false\n3,小華,,true')
const tableName = ref('users')
const dialect = ref<Dialect>('mysql')
const delim = ref<'auto' | ',' | '\t'>('auto')
const multiRow = ref(true)
const batchSize = ref(100)
const emptyAsNull = ref(true)
const inferTypesOn = ref(true)
const createTable = ref(false)

const dialects: { id: Dialect; label: string }[] = [
  { id: 'mysql', label: 'MySQL' },
  { id: 'postgres', label: 'PostgreSQL' },
  { id: 'sqlite', label: 'SQLite' },
  { id: 'standard', label: '標準 SQL' },
]

const typeLabel: Record<string, string> = {
  int: '整數',
  decimal: '小數',
  bool: '布林',
  string: '文字',
}

const resolvedDelim = computed(() => {
  if (delim.value !== 'auto') return delim.value
  const firstLine = input.value.split('\n')[0] ?? ''
  return firstLine.includes('\t') ? '\t' : ','
})

const table = computed(() => parseTable(input.value, resolvedDelim.value))
const colTypes = computed(() => inferTypes(table.value, inferTypesOn.value))

const sql = computed(() =>
  generateSQL(table.value, {
    tableName: tableName.value,
    dialect: dialect.value,
    multiRow: multiRow.value,
    batchSize: Math.max(1, Math.floor(batchSize.value) || 1),
    emptyAsNull: emptyAsNull.value,
    inferTypes: inferTypesOn.value,
    createTable: createTable.value,
  }),
)

const rowCount = computed(() => table.value.rows.length)

const copied = ref(false)
function copy() {
  navigator.clipboard?.writeText(sql.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
function download() {
  const blob = new Blob([sql.value], { type: 'text/sql;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  const safe = (tableName.value.trim() || 'data').replace(/[^\w一-龥-]+/g, '_')
  a.download = `${safe}.sql`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">表格資料(第一列為欄位名)</label>
        <textarea v-model="input" rows="7" class="field-input font-mono text-sm" spellcheck="false" />
        <p class="field-hint">
          可直接從 <strong>Excel / Google 試算表</strong>整塊複製貼上(會用 Tab 分隔)。全程在你的瀏覽器處理,不上傳。
        </p>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label">資料表名稱</label>
          <input v-model="tableName" class="field-input" placeholder="my_table" />
        </div>
        <div>
          <label class="field-label">資料庫方言</label>
          <select v-model="dialect" class="field-input">
            <option v-for="d in dialects" :key="d.id" :value="d.id">{{ d.label }}</option>
          </select>
        </div>
      </div>

      <div>
        <label class="field-label">分隔符號</label>
        <div class="flex gap-2">
          <button
            v-for="opt in [{ v: 'auto', t: '自動' }, { v: ',', t: '逗號' }, { v: '\t', t: 'Tab' }]"
            :key="opt.v"
            type="button"
            class="rounded-lg border px-3 py-1.5 text-sm transition"
            :class="delim === opt.v ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600 hover:bg-ink-50'"
            @click="delim = opt.v as 'auto' | ',' | '\t'"
          >
            {{ opt.t }}
          </button>
        </div>
      </div>

      <div class="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <label class="inline-flex items-center gap-2"><input v-model="createTable" type="checkbox" />一併產生 CREATE TABLE</label>
        <label class="inline-flex items-center gap-2"><input v-model="multiRow" type="checkbox" />多列合併成一句 INSERT</label>
        <label class="inline-flex items-center gap-2"><input v-model="emptyAsNull" type="checkbox" />空欄位視為 NULL</label>
        <label class="inline-flex items-center gap-2"><input v-model="inferTypesOn" type="checkbox" />自動判斷數字型別</label>
        <label v-if="multiRow" class="inline-flex items-center gap-2">
          每句最多
          <input v-model.number="batchSize" type="number" min="1" class="w-20 rounded-lg border border-ink-200 px-2 py-1" />
          列
        </label>
      </div>
    </div>

    <div v-if="rowCount === 0" class="card p-6 text-center text-ink-500">
      請在上方貼上至少一列資料(含表頭)。
    </div>

    <template v-else>
      <div class="card p-4">
        <div class="mb-2 text-xs font-semibold text-ink-400">欄位型別判斷</div>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="(h, i) in table.headers"
            :key="i"
            class="rounded-lg bg-ink-50 px-2.5 py-1 text-sm text-ink-700"
          >
            {{ h }}
            <span class="ml-1 text-xs text-ink-400">{{ typeLabel[colTypes[i]] }}</span>
          </span>
        </div>
      </div>

      <div class="card p-4 space-y-2">
        <div class="flex items-center gap-3">
          <span class="text-sm text-ink-600">共 <strong>{{ rowCount }}</strong> 筆資料</span>
          <button class="ml-auto text-sm text-brand-700 underline hover:text-brand-800" @click="copy">
            {{ copied ? '已複製 ✓' : '複製 SQL' }}
          </button>
          <button class="text-sm text-brand-700 underline hover:text-brand-800" @click="download">下載 .sql</button>
        </div>
        <textarea
          :value="sql"
          readonly
          rows="12"
          class="field-input font-mono text-xs leading-relaxed"
          spellcheck="false"
          @focus="(e) => (e.target as HTMLTextAreaElement).select()"
        />
      </div>
    </template>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>把 Excel / 試算表 / CSV 的資料,一鍵變成可直接貼進資料庫執行的 <strong>INSERT</strong> 語句,免手刻、免一筆筆打。</li>
        <li>自動處理容易出錯的細節:字串單引號跳脫(<code>'</code> → <code>''</code>)、空欄轉 <strong>NULL</strong>、數字不加引號;
          但<strong>開頭是 0 的「數字」</strong>(電話、統編、郵遞區號)會保留為文字,不被當成數值而掉開頭。</li>
        <li>支援 MySQL / PostgreSQL / SQLite / 標準 SQL 的識別字引號與布林寫法;可一併產生 <strong>CREATE TABLE</strong>。</li>
        <li>本工具<strong>不連網、不上傳</strong>,可能含個資的資料只留在你的瀏覽器。產生的語法請自行確認再執行。</li>
      </ul>
    </LegalNote>
  </div>
</template>
